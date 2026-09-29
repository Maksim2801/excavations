import json
import logging

from sqlalchemy.orm import Session

from app.constants import METHOD_PHOTO, SOURCE_AUTO, SOURCE_USER_POINTS
from app.errors import AppError
from app.models import Measurement, User
from app.services.audit_service import write_audit
from app.services.domain import ensure_writable, get_finding, refresh_record_status, touch
from app.services.finding_service import finding_detail_dict, _load_detail
from app.services.photo_analysis import STATUS_DETECTED, detect_scale_marker
from app.services.photo_service import get_photo
from app.utils.files import resolve_storage_path
from app.utils.measurement import calculate_measurement

logger = logging.getLogger("archaeology.measure")


def _points(points):
    if not points:
        return points
    dumped = []
    for point in points:
        dumped.append(point.model_dump() if hasattr(point, "model_dump") else point)
    return dumped

_FIELDS = {"length": "length_mm", "width": "width_mm", "thickness": "thickness_mm"}


def measure_finding(db: Session, finding_id: int, data, actor: User) -> dict:
    finding = get_finding(db, finding_id)
    ensure_writable(finding.excavation)
    if data.measurement_type not in _FIELDS:
        raise AppError(400, "Тип измерения должен быть length, width или thickness")
    photo = get_photo(db, data.photo_id)
    if photo.finding_id != finding.id:
        raise AppError(400, "Измерение по фото возможно только по фотографии этой находки")
    path = resolve_storage_path(photo.file_path)
    if not path.exists():
        raise AppError(404, "Файл фотографии отсутствует на диске")

    detected = detect_scale_marker(str(path))
    scale_points = _points(data.scale_points)
    object_points = _points(data.object_points)
    result_source = SOURCE_USER_POINTS
    if not scale_points:
        if detected["status"] != STATUS_DETECTED:
            return {
                "measurement_id": None,
                "finding_id": finding.id,
                "photo_id": photo.id,
                "measurement_type": data.measurement_type,
                "result_mm": None,
                "scale_pixel_distance": None,
                "object_pixel_distance": None,
                "scale_mm": data.scale_mm,
                "mm_per_pixel": None,
                "method": METHOD_PHOTO,
                "result_source": SOURCE_AUTO,
                "detection_status": detected["status"],
                "points": {"scale_points": detected["points"], "object_points": object_points},
                "accepted": False,
                "message": detected["message"],
                "finding": None,
            }
        scale_points = detected["points"]
        result_source = SOURCE_AUTO

    try:
        calculated = calculate_measurement(scale_points, object_points, data.scale_mm)
    except ValueError as exc:
        raise AppError(400, str(exc)) from exc

    points = json.loads(calculated["points_json"])
    points["detection_status"] = detected["status"]
    points["detection_points"] = detected["points"]
    row = Measurement(
        finding_id=finding.id,
        photo_id=photo.id,
        measurement_type=data.measurement_type,
        method=METHOD_PHOTO,
        result_source=result_source,
        detection_status=detected["status"],
        scale_pixel_distance=calculated["scale_pixel_distance"],
        scale_mm=data.scale_mm,
        object_pixel_distance=calculated["object_pixel_distance"],
        result_mm=calculated["result_mm"],
        points_json=json.dumps(points, ensure_ascii=False),
        accepted=bool(data.accept),
        created_by_id=actor.id,
    )
    db.add(row)
    if data.accept:
        setattr(finding, _FIELDS[data.measurement_type], calculated["result_mm"])
        finding.measurement_method = METHOD_PHOTO
        finding.updated_by_id = actor.id
        touch(finding)
        refresh_record_status(finding)
    db.flush()
    write_audit(
        db,
        user_id=actor.id,
        action="measure",
        entity="measurement",
        entity_id=row.id,
        details=f"{data.measurement_type}:{calculated['result_mm']}",
    )
    db.commit()
    logger.info(
        "measurement finding=%s type=%s result=%s source=%s status=%s",
        finding.id,
        data.measurement_type,
        calculated["result_mm"],
        result_source,
        detected["status"],
    )
    detail = finding_detail_dict(_load_detail(db, finding.id))
    return {
        "measurement_id": row.id,
        "finding_id": finding.id,
        "photo_id": photo.id,
        "measurement_type": data.measurement_type,
        "result_mm": calculated["result_mm"],
        "scale_pixel_distance": calculated["scale_pixel_distance"],
        "object_pixel_distance": calculated["object_pixel_distance"],
        "scale_mm": data.scale_mm,
        "mm_per_pixel": calculated["mm_per_pixel"],
        "method": METHOD_PHOTO,
        "result_source": result_source,
        "detection_status": detected["status"],
        "points": points,
        "accepted": bool(data.accept),
        "message": detected["message"] if result_source == SOURCE_AUTO else "Размер рассчитан по указанным точкам.",
        "finding": detail,
    }
