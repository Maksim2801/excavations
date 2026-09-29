import json

from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import GnssPointType, Material, MeasurementMethodDict, PhotoType, PlanColorScheme, User
from app.services.audit_service import write_audit


def _dump_material(row: Material) -> dict:
    return {"id": row.id, "name": row.name, "code": row.code, "color": row.color, "is_active": row.is_active}


def list_dictionaries(db: Session) -> dict:
    return {
        "materials": [_dump_material(row) for row in db.query(Material).order_by(Material.name).all()],
        "photo_types": [
            {"id": row.id, "code": row.code, "name": row.name, "is_active": row.is_active}
            for row in db.query(PhotoType).order_by(PhotoType.name).all()
        ],
        "gnss_point_types": [
            {"id": row.id, "code": row.code, "name": row.name, "is_active": row.is_active}
            for row in db.query(GnssPointType).order_by(GnssPointType.name).all()
        ],
        "measurement_methods": [
            {"id": row.id, "code": row.code, "name": row.name, "is_active": row.is_active}
            for row in db.query(MeasurementMethodDict).order_by(MeasurementMethodDict.name).all()
        ],
        "color_schemes": [_dump_scheme(row) for row in db.query(PlanColorScheme).order_by(PlanColorScheme.id).all()],
    }


def create_material(db: Session, data, actor: User) -> dict:
    name = data.name.strip()
    if db.query(Material).filter(Material.name.ilike(name)).first():
        raise AppError(409, "Такой материал уже есть в справочнике")
    row = Material(name=name, code=(data.code or None), color=data.color or "#5c6b73", is_active=True)
    db.add(row)
    db.flush()
    write_audit(db, user_id=actor.id, action="create", entity="material", entity_id=row.id, details=name)
    db.commit()
    db.refresh(row)
    return _dump_material(row)


def update_material(db: Session, material_id: int, data, actor: User) -> dict:
    row = db.get(Material, material_id)
    if row is None:
        raise AppError(404, "Материал не найден")
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"]:
        row.name = payload["name"].strip()
    if "code" in payload:
        row.code = payload["code"]
    if "color" in payload and payload["color"]:
        row.color = payload["color"]
    if "is_active" in payload and payload["is_active"] is not None:
        row.is_active = payload["is_active"]
    write_audit(db, user_id=actor.id, action="update", entity="material", entity_id=row.id, details=row.name)
    db.commit()
    db.refresh(row)
    return _dump_material(row)


def _dump_scheme(row: PlanColorScheme) -> dict:
    try:
        mapping = json.loads(row.mapping_json or "{}")
    except json.JSONDecodeError:
        mapping = {}
    return {
        "id": row.id,
        "name": row.name,
        "mode": row.mode,
        "mapping": mapping,
        "is_default": row.is_default,
        "is_active": row.is_active,
    }


def update_color_scheme(db: Session, scheme_id: int, data, actor: User) -> dict:
    row = db.get(PlanColorScheme, scheme_id)
    if row is None:
        raise AppError(404, "Цветовая схема не найдена")
    payload = data.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"]:
        row.name = payload["name"].strip()
    if "mode" in payload and payload["mode"]:
        if payload["mode"] not in {"material", "layer"}:
            raise AppError(400, "Режим схемы: material или layer")
        row.mode = payload["mode"]
    if "mapping" in payload and payload["mapping"] is not None:
        row.mapping_json = json.dumps(payload["mapping"], ensure_ascii=False)
    if payload.get("is_default"):
        db.query(PlanColorScheme).update({PlanColorScheme.is_default: False})
        row.is_default = True
    if "is_active" in payload and payload["is_active"] is not None:
        row.is_active = payload["is_active"]
    write_audit(db, user_id=actor.id, action="update", entity="color_scheme", entity_id=row.id, details=row.name)
    db.commit()
    db.refresh(row)
    return _dump_scheme(row)


def update_named(
    db: Session,
    model,
    item_id: int,
    data,
    actor: User,
    entity: str,
) -> dict:
    row = db.get(model, item_id)
    if row is None:
        raise AppError(404, "Запись справочника не найдена")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("name"):
        row.name = payload["name"].strip()
    if "is_active" in payload and payload["is_active"] is not None:
        row.is_active = payload["is_active"]
    write_audit(db, user_id=actor.id, action="update", entity=entity, entity_id=row.id, details=row.name)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "code": row.code, "name": row.name, "is_active": row.is_active}
