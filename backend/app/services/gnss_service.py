import io
import logging

import pandas as pd
from sqlalchemy.orm import Session

from app.constants import GNSS_TYPE_LABELS, GNSS_TYPES
from app.errors import AppError
from app.models import GNSSPoint, User
from app.services.audit_service import write_audit
from app.services.domain import ensure_writable, get_excavation
from app.utils.geometry import point_element
from app.utils.validators import validate_coordinates

logger = logging.getLogger("archaeology.gnss")

_HEADER_MAP = {
    "north": "north",
    "n": "north",
    "север": "north",
    "northing": "north",
    "y": "north",
    "east": "east",
    "e": "east",
    "восток": "east",
    "easting": "east",
    "x": "east",
    "elev": "elev",
    "elevation": "elev",
    "z": "elev",
    "h": "elev",
    "высота": "elev",
    "point_type": "point_type",
    "type": "point_type",
    "тип": "point_type",
    "comment": "comment",
    "комментарий": "comment",
}
_TYPE_MAP = {
    "corner": "corner",
    "угловая": "corner",
    "угол": "corner",
    "control": "control",
    "контрольная": "control",
    "auxiliary": "auxiliary",
    "вспомогательная": "auxiliary",
}


def point_dict(point: GNSSPoint) -> dict:
    return {
        "id": point.id,
        "excavation_id": point.excavation_id,
        "north": point.north,
        "east": point.east,
        "elev": point.elev,
        "point_type": point.point_type,
        "point_type_label": GNSS_TYPE_LABELS.get(point.point_type, point.point_type),
        "comment": point.comment,
        "source_name": point.source_name,
        "created_at": point.created_at,
    }


def list_points(db: Session, excavation_id: int | None = None) -> list[dict]:
    query = db.query(GNSSPoint).order_by(GNSSPoint.id.asc())
    if excavation_id:
        get_excavation(db, excavation_id)
        query = query.filter(GNSSPoint.excavation_id == excavation_id)
    return [point_dict(point) for point in query.all()]


def parse_gnss_csv(data: bytes) -> list[dict]:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise AppError(400, "Не удалось прочитать файл. Сохраните CSV в кодировке UTF-8.")
    if not text.strip():
        raise AppError(400, "Файл CSV пуст")
    frame = pd.read_csv(io.StringIO(text), sep=None, engine="python")
    if frame.empty:
        raise AppError(400, "В файле нет строк с точками")
    renamed = {}
    for column in frame.columns:
        key = str(column).strip().lower()
        renamed[column] = _HEADER_MAP.get(key, key)
    frame = frame.rename(columns=renamed)
    missing = [name for name in ("north", "east", "elev") if name not in frame.columns]
    if missing:
        raise AppError(400, "В CSV нет обязательных колонок North, East и Elev")
    rows = []
    for index, record in frame.iterrows():
        rows.append(_validate_row(int(index) + 2, record))
    return rows


def _validate_row(line: int, record) -> dict:
    errors = []
    north = pd.to_numeric(record.get("north"), errors="coerce")
    east = pd.to_numeric(record.get("east"), errors="coerce")
    elev = pd.to_numeric(record.get("elev"), errors="coerce")
    raw_type = record.get("point_type")
    if raw_type is None or (isinstance(raw_type, float) and pd.isna(raw_type)) or str(raw_type).strip() == "":
        point_type = "auxiliary"
    else:
        point_type = _TYPE_MAP.get(str(raw_type).strip().lower())
        if point_type not in GNSS_TYPES:
            errors.append("неизвестный тип точки")
            point_type = None
    comment = record.get("comment")
    if comment is None or (isinstance(comment, float) and pd.isna(comment)):
        comment = None
    else:
        comment = str(comment).strip() or None
    try:
        north, east, elev = validate_coordinates(
            None if pd.isna(north) else float(north),
            None if pd.isna(east) else float(east),
            None if pd.isna(elev) else float(elev),
            required=True,
        )
    except AppError as exc:
        errors.append(exc.detail)
        north = east = elev = None
    return {
        "line": line,
        "north": north,
        "east": east,
        "elev": elev,
        "point_type": point_type,
        "comment": comment,
        "status": "ok" if not errors else "error",
        "errors": errors,
    }


def preview_csv(db: Session, excavation_id: int, data: bytes) -> dict:
    get_excavation(db, excavation_id)
    rows = parse_gnss_csv(data)
    return _summary(excavation_id, rows)


def import_points(db: Session, excavation_id: int, points: list, actor: User, source_name: str | None) -> dict:
    excavation = get_excavation(db, excavation_id)
    ensure_writable(excavation)
    checked = []
    for index, point in enumerate(points, start=1):
        raw = {
            "north": point.north,
            "east": point.east,
            "elev": point.elev,
            "point_type": point.point_type,
            "comment": point.comment,
        }
        checked.append(_validate_row(index, raw))
    valid = [row for row in checked if row["status"] == "ok"]
    invalid = [row for row in checked if row["status"] == "error"]
    if not valid:
        raise AppError(400, "Нет корректных строк для импорта. Исправьте ошибки и повторите загрузку.")
    for row in valid:
        db.add(
            GNSSPoint(
                excavation_id=excavation.id,
                north=row["north"],
                east=row["east"],
                elev=row["elev"],
                point_type=row["point_type"],
                comment=row["comment"],
                source_name=source_name,
                created_by_id=actor.id,
                geom=point_element(row["east"], row["north"], row["elev"]),
            )
        )
    write_audit(
        db,
        user_id=actor.id,
        action="gnss_import",
        entity="excavation",
        entity_id=excavation.id,
        details=f"imported={len(valid)}; rejected={len(invalid)}",
    )
    db.commit()
    logger.info("gnss import excavation=%s ok=%s bad=%s", excavation.id, len(valid), len(invalid))
    summary = _summary(excavation.id, checked)
    summary["imported"] = len(valid)
    return summary


def delete_point(db: Session, point_id: int, actor: User) -> None:
    point = db.get(GNSSPoint, point_id)
    if point is None:
        raise AppError(404, "GNSS-точка не найдена")
    ensure_writable(get_excavation(db, point.excavation_id))
    write_audit(db, user_id=actor.id, action="delete", entity="gnss_point", entity_id=point.id)
    db.delete(point)
    db.commit()


def _summary(excavation_id: int, rows: list[dict]) -> dict:
    valid = sum(1 for row in rows if row["status"] == "ok")
    return {
        "excavation_id": excavation_id,
        "valid_count": valid,
        "error_count": len(rows) - valid,
        "rows": rows,
    }
