from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Excavation, Finding, Layer, Photo, User
from app.services.audit_service import write_audit
from app.services.domain import ensure_writable, get_excavation, get_layer, touch
from app.utils.files import resolve_storage_path


def layer_dict(db: Session, layer: Layer) -> dict:
    excavation = layer.excavation or db.get(Excavation, layer.excavation_id)
    return {
        "id": layer.id,
        "excavation_id": layer.excavation_id,
        "excavation_code": excavation.code if excavation else None,
        "number": layer.number,
        "top_elev": layer.top_elev,
        "bottom_elev": layer.bottom_elev,
        "description": layer.description,
        "color": layer.color,
        "status": layer.status,
        "surface_description": layer.surface_description,
        "inclusions": layer.inclusions,
        "interpretation": layer.interpretation,
        "note": layer.note,
        "finding_count": db.query(func.count(Finding.id)).filter(Finding.layer_id == layer.id).scalar() or 0,
        "photo_count": db.query(func.count(Photo.id)).filter(Photo.layer_id == layer.id).scalar() or 0,
        "created_at": layer.created_at,
        "updated_at": layer.updated_at,
    }


def _check_elev(top: float, bottom: float) -> None:
    if top < bottom:
        raise AppError(400, "Верхняя отметка пласта не может быть ниже нижней")


def list_layers(db: Session, excavation_id: int | None = None) -> list[dict]:
    query = db.query(Layer).order_by(Layer.excavation_id.asc(), Layer.number.asc())
    if excavation_id:
        get_excavation(db, excavation_id)
        query = query.filter(Layer.excavation_id == excavation_id)
    return [layer_dict(db, layer) for layer in query.all()]


def create_layer(db: Session, data, actor: User) -> dict:
    excavation = get_excavation(db, data.excavation_id)
    ensure_writable(excavation)
    _check_elev(data.top_elev, data.bottom_elev)
    if db.query(Layer).filter(Layer.excavation_id == excavation.id, Layer.number == data.number).first():
        raise AppError(409, "Пласт с таким номером уже есть в раскопе")
    layer = Layer(
        excavation_id=excavation.id,
        number=data.number,
        top_elev=data.top_elev,
        bottom_elev=data.bottom_elev,
        description=data.description,
        color=data.color,
        status=data.status or "open",
        surface_description=data.surface_description,
        inclusions=data.inclusions,
        interpretation=data.interpretation,
        note=data.note,
        excavation=excavation,
    )
    db.add(layer)
    db.flush()
    write_audit(db, user_id=actor.id, action="create", entity="layer", entity_id=layer.id, details=str(layer.number))
    db.commit()
    db.refresh(layer)
    return layer_dict(db, layer)


def update_layer(db: Session, layer_id: int, data, actor: User) -> dict:
    layer = get_layer(db, layer_id)
    excavation = get_excavation(db, layer.excavation_id)
    ensure_writable(excavation)
    payload = data.model_dump(exclude_unset=True)
    if "number" in payload and payload["number"] is not None:
        duplicate = (
            db.query(Layer)
            .filter(Layer.excavation_id == layer.excavation_id, Layer.number == payload["number"], Layer.id != layer.id)
            .first()
        )
        if duplicate:
            raise AppError(409, "Пласт с таким номером уже есть в раскопе")
        layer.number = payload["number"]
    top = payload.get("top_elev", layer.top_elev)
    bottom = payload.get("bottom_elev", layer.bottom_elev)
    _check_elev(top, bottom)
    layer.top_elev = top
    layer.bottom_elev = bottom
    for field in ("description", "color", "status", "surface_description", "inclusions", "interpretation", "note"):
        if field in payload:
            setattr(layer, field, payload[field])
    if layer.status not in {"open", "recorded", "closed"}:
        raise AppError(400, "Неизвестный статус пласта")
    touch(layer)
    write_audit(db, user_id=actor.id, action="update", entity="layer", entity_id=layer.id, details=str(layer.number))
    db.commit()
    db.refresh(layer)
    return layer_dict(db, layer)


def delete_layer(db: Session, layer_id: int, actor: User) -> None:
    layer = get_layer(db, layer_id)
    excavation = get_excavation(db, layer.excavation_id)
    ensure_writable(excavation)
    finding_count = db.query(func.count(Finding.id)).filter(Finding.layer_id == layer.id).scalar() or 0
    if finding_count:
        raise AppError(409, f"Нельзя удалить пласт: к нему привязаны находки ({finding_count}).")
    for photo in db.query(Photo).filter(Photo.layer_id == layer.id).all():
        for relative in (photo.file_path, photo.thumb_path):
            if not relative:
                continue
            path = resolve_storage_path(relative)
            if path.exists():
                path.unlink()
    write_audit(db, user_id=actor.id, action="delete", entity="layer", entity_id=layer.id, details=str(layer.number))
    db.delete(layer)
    db.commit()
