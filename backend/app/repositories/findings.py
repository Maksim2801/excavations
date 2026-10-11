from datetime import datetime, time, timedelta, timezone
from sqlalchemy import or_
from sqlalchemy.orm import Query, Session, contains_eager

from app.models import Excavation, Finding, Layer


def base_query(db: Session) -> Query:
    return (
        db.query(Finding)
        .join(Excavation, Finding.excavation_id == Excavation.id)
        .outerjoin(Layer, Finding.layer_id == Layer.id)
        .options(contains_eager(Finding.excavation), contains_eager(Finding.layer))
    )


def apply_filters(query: Query, params: dict) -> Query:
    if params.get("ids") is not None:
        query = query.filter(Finding.id.in_(params["ids"]))
    for key, is_end in (("date_from", False), ("date_to", True)):
        value = params.get(key)
        if value:
            if isinstance(value, str):
                value = datetime.fromisoformat(value).date()
            boundary = datetime.combine(value, time.min, timezone.utc)
            query = query.filter(Finding.created_at < boundary + timedelta(days=1)) if is_end else query.filter(Finding.created_at >= boundary)
    if params.get("excavation_id"):
        query = query.filter(Finding.excavation_id == params["excavation_id"])
    if params.get("layer_id"):
        query = query.filter(Finding.layer_id == params["layer_id"])
    if params.get("code"):
        query = query.filter(Finding.code.ilike(f"%{params['code'].strip()}%"))
    if params.get("material"):
        query = query.filter(Finding.material.ilike(params["material"].strip()))
    if params.get("square"):
        query = query.filter(Finding.square.ilike(params["square"].strip()))
    if params.get("find_type"):
        query = query.filter(Finding.find_type.ilike(f"%{params['find_type'].strip()}%"))
    if params.get("measurement_method"):
        query = query.filter(Finding.measurement_method == params["measurement_method"])
    if params.get("photo_present") is not None:
        query = query.filter(Finding.photo_present.is_(bool(params["photo_present"])))
    if params.get("number_from") is not None:
        query = query.filter(Finding.number >= params["number_from"])
    if params.get("number_to") is not None:
        query = query.filter(Finding.number <= params["number_to"])
    if params.get("elev_from") is not None:
        query = query.filter(Finding.elev >= params["elev_from"])
    if params.get("elev_to") is not None:
        query = query.filter(Finding.elev <= params["elev_to"])
    if params.get("q"):
        like = f"%{params['q'].strip()}%"
        query = query.filter(
            or_(
                Finding.code.ilike(like),
                Finding.description.ilike(like),
                Finding.material.ilike(like),
                Finding.square.ilike(like),
                Finding.note.ilike(like),
            )
        )
    return query


def apply_sort(query: Query, sort: str, order: str) -> Query:
    columns = {
        "excavation": Excavation.code,
        "material": Finding.material,
        "measurement_method": Finding.measurement_method,
        "photo_present": Finding.photo_present,
        "record_status": Finding.record_status,
        "created_at": Finding.created_at,
        "description": Finding.description,
        "find_type": Finding.find_type,
        "code": Finding.code,
        "number": Finding.number,
        "north": Finding.north,
        "east": Finding.east,
        "elev": Finding.elev,
        "length_mm": Finding.length_mm,
        "width_mm": Finding.width_mm,
        "thickness_mm": Finding.thickness_mm,
        "square": Finding.square,
        "layer": Layer.number,
    }
    direction = "desc" if order == "desc" else "asc"
    if sort == "combined":
        cols = [Layer.number, Finding.square, Finding.number, Finding.id]
        ordered = [col.desc() if direction == "desc" else col.asc() for col in cols]
        return query.order_by(*ordered)
    column = columns.get(sort or "code", Finding.code)
    primary = column.desc() if direction == "desc" else column.asc()
    return query.order_by(primary, Finding.id.asc())
