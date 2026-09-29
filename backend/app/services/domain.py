from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.constants import (
    EXCAVATION_ARCHIVED,
    ISSUE_COORDINATES,
    ISSUE_DIMENSIONS,
    ISSUE_INCOMPLETE,
    ISSUE_LAYER,
    ISSUE_PHOTO,
    RECORD_COMPLETE,
    RECORD_DRAFT,
)
from app.errors import AppError
from app.models import Excavation, Finding, Layer, Material
from app.utils.geometry import point_element
from app.utils.validators import validate_coordinates, validate_dimension


def touch(obj) -> None:
    obj.updated_at = datetime.now(timezone.utc)


def get_excavation(db: Session, excavation_id: int) -> Excavation:
    excavation = db.get(Excavation, excavation_id)
    if excavation is None:
        raise AppError(404, "Раскоп не найден")
    return excavation


def get_layer(db: Session, layer_id: int) -> Layer:
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise AppError(404, "Пласт не найден")
    return layer


def get_finding(db: Session, finding_id: int) -> Finding:
    finding = db.get(Finding, finding_id)
    if finding is None:
        raise AppError(404, "Находка не найдена")
    return finding


def ensure_writable(excavation: Excavation) -> None:
    if excavation.status == EXCAVATION_ARCHIVED:
        raise AppError(409, "Раскоп архивирован. Изменение данных запрещено.")


def ensure_material(db: Session, material: str | None) -> str | None:
    if material is None:
        return None
    cleaned = material.strip()
    if not cleaned:
        return None
    row = (
        db.query(Material)
        .filter(Material.is_active.is_(True))
        .all()
    )
    for item in row:
        if item.name.lower() == cleaned.lower():
            return item.name
    raise AppError(400, f"Материал «{cleaned}» отсутствует в справочнике")


def bind_layer(db: Session, excavation_id: int, layer_id: int | None) -> Layer | None:
    if layer_id is None:
        return None
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise AppError(400, "Указанный пласт не существует")
    if layer.excavation_id != excavation_id:
        raise AppError(400, "Нельзя привязать пласт другого раскопа")
    return layer


def apply_coordinates(obj, north, east, elev) -> None:
    if north is None and east is None and elev is None:
        obj.north = None
        obj.east = None
        obj.elev = None
        obj.geom = None
        return
    if north is None or east is None or elev is None:
        raise AppError(400, "Укажите координаты North, East и Elev вместе")
    north, east, elev = validate_coordinates(north, east, elev, required=True)
    obj.north = north
    obj.east = east
    obj.elev = elev
    obj.geom = point_element(east, north, elev)


def apply_dimensions(obj, length_mm, width_mm, thickness_mm) -> None:
    obj.length_mm = validate_dimension("длина", length_mm)
    obj.width_mm = validate_dimension("ширина", width_mm)
    obj.thickness_mm = validate_dimension("толщина", thickness_mm)


def refresh_record_status(finding: Finding) -> None:
    complete = all(
        [
            finding.layer_id is not None,
            finding.north is not None,
            finding.east is not None,
            finding.elev is not None,
            finding.length_mm is not None,
            finding.width_mm is not None,
            finding.thickness_mm is not None,
            finding.photo_present,
            bool(finding.code),
            finding.number is not None,
        ]
    )
    finding.record_status = RECORD_COMPLETE if complete else RECORD_DRAFT


def finding_issues(finding: Finding) -> list[str]:
    issues: list[str] = []
    if finding.north is None or finding.east is None or finding.elev is None:
        issues.append(ISSUE_COORDINATES)
    if finding.length_mm is None or finding.width_mm is None or finding.thickness_mm is None:
        issues.append(ISSUE_DIMENSIONS)
    if not finding.photo_present:
        issues.append(ISSUE_PHOTO)
    if finding.layer_id is None:
        issues.append(ISSUE_LAYER)
    if finding.record_status != RECORD_COMPLETE:
        issues.append(ISSUE_INCOMPLETE)
    return issues
