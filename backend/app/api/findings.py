from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_camera, require_field
from app.database import get_db
from app.models import User
from app.schemas.io import CoordinatesIn, DimensionsIn, FindingIn, FindingUpdate, MeasureIn
from app.services.finding_service import (
    create_finding,
    delete_finding,
    finding_detail_dict,
    list_findings,
    update_coordinates,
    update_dimensions,
    update_finding,
    _load_detail,
)
from app.services.idempotency import remember, replay
from app.services.measurement_service import measure_finding

router = APIRouter()


@router.get("")
def get_findings(
    excavation_id: int | None = None,
    layer_id: int | None = None,
    code: str | None = None,
    material: str | None = None,
    square: str | None = None,
    find_type: str | None = None,
    measurement_method: str | None = None,
    photo_present: bool | None = None,
    number_from: int | None = None,
    number_to: int | None = None,
    elev_from: float | None = None,
    elev_to: float | None = None,
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = "code",
    order: str = "asc",
    page: int = 1,
    page_size: int = 50,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_findings(
        db,
        {
            "excavation_id": excavation_id,
            "layer_id": layer_id,
            "code": code,
            "material": material,
            "square": square,
            "find_type": find_type,
            "measurement_method": measurement_method,
            "photo_present": photo_present,
            "number_from": number_from,
            "number_to": number_to,
            "elev_from": elev_from,
            "elev_to": elev_to,
            "q": q,
            "date_from": date_from,
            "date_to": date_to,
            "sort": sort,
            "order": order,
            "page": page,
            "page_size": page_size,
        },
    )


@router.post("")
def post_finding(
    data: FindingIn,
    actor: User = Depends(require_field),
    db: Session = Depends(get_db),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key", max_length=128)] = None,
):
    if idempotency_key:
        # Hold the request lock until both finding and replay record are committed.
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"finding:{actor.id}:{idempotency_key}"})
    cached = replay(db, actor.id, "POST /api/findings", idempotency_key, data.model_dump())
    if cached:
        return cached
    payload = jsonable_encoder(create_finding(db, data, actor, commit=False))
    remember(db, actor.id, "POST /api/findings", idempotency_key, 200, payload, data.model_dump())
    db.commit()
    return payload


@router.get("/{finding_id}")
def get_one(finding_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return finding_detail_dict(_load_detail(db, finding_id))


@router.put("/{finding_id}")
def put_finding(finding_id: int, data: FindingUpdate, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    return update_finding(db, finding_id, data, actor)


@router.delete("/{finding_id}")
def remove(finding_id: int, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    delete_finding(db, finding_id, actor)
    return {"status": "deleted"}


@router.put("/{finding_id}/coordinates")
def put_coordinates(finding_id: int, data: CoordinatesIn, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    return update_coordinates(db, finding_id, data, actor)


@router.put("/{finding_id}/dimensions")
def put_dimensions(finding_id: int, data: DimensionsIn, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    return update_dimensions(db, finding_id, data, actor)


@router.post("/{finding_id}/measure")
def measure(finding_id: int, data: MeasureIn, actor: User = Depends(require_field), db: Session = Depends(get_db)):
    return measure_finding(db, finding_id, data, actor)
