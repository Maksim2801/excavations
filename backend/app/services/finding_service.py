import json

from sqlalchemy.orm import Session, joinedload, selectinload

from app.constants import METHOD_MANUAL, METHOD_NONE, METHOD_PHOTO, ROLE_CAMERA, ROLE_FIELD, ROLE_SUPERVISOR
from app.errors import AppError
from app.models import Finding, Measurement, User
from app.repositories.findings import apply_filters, apply_sort, base_query
from app.services.audit_service import write_audit
from app.services.domain import (
    apply_coordinates,
    apply_dimensions,
    bind_layer,
    ensure_material,
    ensure_writable,
    finding_issues,
    get_excavation,
    get_finding,
    refresh_record_status,
    touch,
)
from app.utils.files import resolve_storage_path
from app.utils.validators import validate_dimension

TEXT_FIELDS = (
    "square",
    "description",
    "find_type",
    "vessel_part",
    "ornament",
    "surface_color",
    "fracture_color",
    "fabric",
    "temper",
    "surface_treatment",
    "note",
)


def _measurement_dict(row: Measurement) -> dict:
    try:
        points = json.loads(row.points_json) if row.points_json else {}
    except json.JSONDecodeError:
        points = {}
    return {
        "id": row.id,
        "finding_id": row.finding_id,
        "photo_id": row.photo_id,
        "measurement_type": row.measurement_type,
        "method": row.method,
        "result_source": row.result_source,
        "detection_status": row.detection_status,
        "scale_pixel_distance": row.scale_pixel_distance,
        "scale_mm": row.scale_mm,
        "object_pixel_distance": row.object_pixel_distance,
        "result_mm": row.result_mm,
        "points": points,
        "accepted": row.accepted,
        "created_at": row.created_at,
    }


def finding_list_dict(finding: Finding) -> dict:
    return {
        "id": finding.id,
        "excavation_id": finding.excavation_id,
        "excavation_code": finding.excavation.code if finding.excavation else None,
        "excavation_year": finding.excavation.year if finding.excavation else None,
        "layer_id": finding.layer_id,
        "layer_number": finding.layer.number if finding.layer else None,
        "pt": finding.pt,
        "code": finding.code,
        "number": finding.number,
        "north": finding.north,
        "east": finding.east,
        "elev": finding.elev,
        "square": finding.square,
        "description": finding.description,
        "material": finding.material,
        "find_type": finding.find_type,
        "length_mm": finding.length_mm,
        "width_mm": finding.width_mm,
        "thickness_mm": finding.thickness_mm,
        "measurement_method": finding.measurement_method,
        "photo_present": finding.photo_present,
        "record_status": finding.record_status,
        "issues": finding_issues(finding),
        "created_at": finding.created_at,
        "updated_at": finding.updated_at,
    }


def finding_detail_dict(finding: Finding) -> dict:
    data = finding_list_dict(finding)
    data.update(
        {
            "quantity": finding.quantity,
            "vessel_part": finding.vessel_part,
            "ornament": finding.ornament,
            "surface_color": finding.surface_color,
            "fracture_color": finding.fracture_color,
            "fabric": finding.fabric,
            "temper": finding.temper,
            "surface_treatment": finding.surface_treatment,
            "note": finding.note,
            "depth_cm": finding.depth_cm,
            "photos": [
                {
                    "id": photo.id,
                    "finding_id": photo.finding_id,
                    "layer_id": photo.layer_id,
                    "excavation_id": photo.excavation_id,
                    "original_name": photo.original_name,
                    "photo_type": photo.photo_type,
                    "author": photo.author,
                    "shot_date": photo.shot_date,
                    "has_scale": photo.has_scale,
                    "mime_type": photo.mime_type,
                    "size_bytes": photo.size_bytes,
                    "created_at": photo.created_at,
                }
                for photo in finding.photos
            ],
            "measurements": [_measurement_dict(row) for row in finding.measurements],
        }
    )
    return data


def _load_detail(db: Session, finding_id: int) -> Finding:
    finding = (
        db.query(Finding)
        .options(
            joinedload(Finding.excavation),
            joinedload(Finding.layer),
            selectinload(Finding.photos),
            selectinload(Finding.measurements),
        )
        .filter(Finding.id == finding_id)
        .one_or_none()
    )
    if finding is None:
        raise AppError(404, "Находка не найдена")
    return finding


def _ensure_unique(db: Session, excavation_id: int, code: str, number: int, pt: int | None, current_id: int | None = None) -> None:
    duplicate = (
        db.query(Finding)
        .filter(Finding.excavation_id == excavation_id, Finding.code == code, Finding.number == number)
        .first()
    )
    if duplicate and duplicate.id != current_id:
        raise AppError(409, "Находка с таким кодом и номером уже есть в этом раскопе")
    if pt is not None:
        point = db.query(Finding).filter(Finding.excavation_id == excavation_id, Finding.pt == pt).first()
        if point and point.id != current_id:
            raise AppError(409, "Точка Pt с таким номером уже используется в раскопе")


def _guard_photo_dimensions(finding: Finding, payload: dict, user: User) -> None:
    dimension_fields = ("length_mm", "width_mm", "thickness_mm")
    changes_dimensions = any(field in payload for field in dimension_fields)
    method = payload.get("measurement_method")
    if method == METHOD_PHOTO:
        raise AppError(400, "Для режима «по фото» выполните измерение по фотографии")
    if finding.measurement_method == METHOD_PHOTO and user.role == ROLE_FIELD and (changes_dimensions or method == METHOD_MANUAL):
        raise AppError(403, "Перевод измерения из режима «по фото» в ручной доступен камеральному сотруднику")


def _apply_text(finding: Finding, payload: dict) -> None:
    for field in TEXT_FIELDS:
        if field in payload:
            value = payload[field]
            setattr(finding, field, value.strip() if isinstance(value, str) else value)


def list_findings(db: Session, params: dict) -> dict:
    page = max(int(params.get("page") or 1), 1)
    page_size = min(max(int(params.get("page_size") or 50), 1), 200)
    query = apply_sort(apply_filters(base_query(db), params), params.get("sort") or "code", params.get("order") or "asc")
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [finding_list_dict(item) for item in items], "total": total, "page": page, "page_size": page_size}


def create_finding(db: Session, data, actor: User) -> dict:
    excavation = get_excavation(db, data.excavation_id)
    ensure_writable(excavation)
    layer = bind_layer(db, excavation.id, data.layer_id)
    code = data.code.strip()
    _ensure_unique(db, excavation.id, code, data.number, data.pt)
    material = ensure_material(db, data.material)
    if data.quantity is not None and data.quantity < 1:
        raise AppError(400, "Количество должно быть положительным")
    finding = Finding(
        excavation_id=excavation.id,
        layer_id=layer.id if layer else None,
        pt=data.pt,
        code=code,
        number=data.number,
        square=(data.square or None),
        description=data.description,
        material=material,
        find_type=data.find_type,
        quantity=data.quantity or 1,
        vessel_part=data.vessel_part,
        ornament=data.ornament,
        surface_color=data.surface_color,
        fracture_color=data.fracture_color,
        fabric=data.fabric,
        temper=data.temper,
        surface_treatment=data.surface_treatment,
        note=data.note,
        depth_cm=data.depth_cm,
        measurement_method=METHOD_NONE,
        photo_present=False,
        created_by_id=actor.id,
        updated_by_id=actor.id,
        excavation=excavation,
        layer=layer,
    )
    apply_coordinates(finding, data.north, data.east, data.elev)
    apply_dimensions(finding, data.length_mm, data.width_mm, data.thickness_mm)
    if any(value is not None for value in (finding.length_mm, finding.width_mm, finding.thickness_mm)):
        finding.measurement_method = METHOD_MANUAL
    refresh_record_status(finding)
    db.add(finding)
    db.flush()
    write_audit(db, user_id=actor.id, action="create", entity="finding", entity_id=finding.id, details=finding.code)
    db.commit()
    return finding_detail_dict(_load_detail(db, finding.id))


def update_finding(db: Session, finding_id: int, data, actor: User) -> dict:
    finding = _load_detail(db, finding_id)
    ensure_writable(finding.excavation)
    payload = data.model_dump(exclude_unset=True)
    _guard_photo_dimensions(finding, payload, actor)
    excavation_id = finding.excavation_id
    if "excavation_id" in payload and payload["excavation_id"] is not None:
        excavation = get_excavation(db, payload["excavation_id"])
        ensure_writable(excavation)
        excavation_id = excavation.id
        finding.excavation = excavation
        finding.excavation_id = excavation.id
    if "layer_id" in payload:
        layer = bind_layer(db, excavation_id, payload["layer_id"])
        finding.layer = layer
        finding.layer_id = layer.id if layer else None
    elif finding.layer_id is not None:
        bind_layer(db, excavation_id, finding.layer_id)
    code = payload.get("code", finding.code).strip()
    number = payload.get("number", finding.number)
    pt = payload["pt"] if "pt" in payload else finding.pt
    _ensure_unique(db, excavation_id, code, number, pt, finding.id)
    finding.code = code
    finding.number = number
    finding.pt = pt
    if "material" in payload:
        finding.material = ensure_material(db, payload["material"])
    _apply_text(finding, payload)
    if "quantity" in payload and payload["quantity"] is not None:
        if payload["quantity"] < 1:
            raise AppError(400, "Количество должно быть положительным")
        finding.quantity = payload["quantity"]
    if "depth_cm" in payload:
        depth = payload["depth_cm"]
        if depth is not None and depth < 0:
            raise AppError(400, "Глубина не может быть отрицательной")
        finding.depth_cm = depth
    if any(field in payload for field in ("north", "east", "elev")):
        apply_coordinates(
            finding,
            payload.get("north", finding.north),
            payload.get("east", finding.east),
            payload.get("elev", finding.elev),
        )
    if any(field in payload for field in ("length_mm", "width_mm", "thickness_mm")):
        apply_dimensions(
            finding,
            payload.get("length_mm", finding.length_mm),
            payload.get("width_mm", finding.width_mm),
            payload.get("thickness_mm", finding.thickness_mm),
        )
        if finding.measurement_method != METHOD_PHOTO:
            finding.measurement_method = METHOD_MANUAL
    if payload.get("measurement_method") == METHOD_MANUAL and actor.role in {ROLE_CAMERA, ROLE_SUPERVISOR}:
        finding.measurement_method = METHOD_MANUAL
    finding.updated_by_id = actor.id
    touch(finding)
    refresh_record_status(finding)
    write_audit(db, user_id=actor.id, action="update", entity="finding", entity_id=finding.id, details=finding.code)
    db.commit()
    return finding_detail_dict(_load_detail(db, finding.id))


def update_coordinates(db: Session, finding_id: int, data, actor: User) -> dict:
    finding = get_finding(db, finding_id)
    ensure_writable(finding.excavation)
    apply_coordinates(finding, data.north, data.east, data.elev)
    finding.updated_by_id = actor.id
    touch(finding)
    refresh_record_status(finding)
    write_audit(db, user_id=actor.id, action="coordinates", entity="finding", entity_id=finding.id)
    db.commit()
    return finding_detail_dict(_load_detail(db, finding.id))


def update_dimensions(db: Session, finding_id: int, data, actor: User) -> dict:
    finding = get_finding(db, finding_id)
    ensure_writable(finding.excavation)
    payload = data.model_dump(exclude_unset=True)
    _guard_photo_dimensions(finding, payload, actor)
    length = validate_dimension("длина", payload.get("length_mm", finding.length_mm))
    width = validate_dimension("ширина", payload.get("width_mm", finding.width_mm))
    thickness = validate_dimension("толщина", payload.get("thickness_mm", finding.thickness_mm))
    finding.length_mm = length
    finding.width_mm = width
    finding.thickness_mm = thickness
    if payload.get("measurement_method") == METHOD_PHOTO:
        raise AppError(400, "Для режима «по фото» выполните измерение по фотографии")
    finding.measurement_method = METHOD_MANUAL
    for measure_type, value in (("length", length), ("width", width), ("thickness", thickness)):
        if value is None:
            continue
        db.add(
            Measurement(
                finding_id=finding.id,
                measurement_type=measure_type,
                method=METHOD_MANUAL,
                result_source="manual",
                result_mm=value,
                points_json="{}",
                accepted=True,
                created_by_id=actor.id,
            )
        )
    finding.updated_by_id = actor.id
    touch(finding)
    refresh_record_status(finding)
    write_audit(db, user_id=actor.id, action="dimensions", entity="finding", entity_id=finding.id, details=METHOD_MANUAL)
    db.commit()
    return finding_detail_dict(_load_detail(db, finding.id))


def delete_finding(db: Session, finding_id: int, actor: User) -> None:
    finding = _load_detail(db, finding_id)
    ensure_writable(finding.excavation)
    for photo in finding.photos:
        for relative in (photo.file_path, photo.thumb_path):
            if not relative:
                continue
            path = resolve_storage_path(relative)
            if path.exists():
                path.unlink()
    write_audit(db, user_id=actor.id, action="delete", entity="finding", entity_id=finding.id, details=finding.code)
    db.delete(finding)
    db.commit()
