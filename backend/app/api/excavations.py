from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_supervisor
from app.database import get_db
from app.models import User
from app.schemas.io import ExcavationIn, ExcavationUpdate
from app.services.excavation_service import (
    archive_excavation,
    create_excavation,
    delete_excavation,
    excavation_checks,
    excavation_dict,
    list_excavations,
    restore_excavation,
    update_excavation,
)
from app.services.domain import get_excavation
from app.services.layer_service import list_layers
from app.services.idempotency import remember, replay

router = APIRouter()


@router.get("")
def get_excavations(status: str | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_excavations(db, status)


@router.post("")
def post_excavation(
    data: ExcavationIn,
    actor: User = Depends(require_supervisor),
    db: Session = Depends(get_db),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    cached = replay(db, actor.id, "POST /api/excavations", idempotency_key)
    if cached:
        return cached
    payload = jsonable_encoder(create_excavation(db, data, actor))
    remember(db, actor.id, "POST /api/excavations", idempotency_key, 200, payload)
    return payload


@router.get("/{excavation_id}")
def get_one(excavation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return excavation_dict(db, get_excavation(db, excavation_id))


@router.get("/{excavation_id}/layers")
def excavation_layers(excavation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_layers(db, excavation_id)


@router.get("/{excavation_id}/checks")
def checks(excavation_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return excavation_checks(db, excavation_id)


@router.put("/{excavation_id}")
def put_excavation(excavation_id: int, data: ExcavationUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_excavation(db, excavation_id, data, actor)


@router.delete("/{excavation_id}")
def remove(excavation_id: int, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    delete_excavation(db, excavation_id, actor)
    return {"status": "deleted"}


@router.post("/{excavation_id}/archive")
def archive(excavation_id: int, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return archive_excavation(db, excavation_id, actor)


@router.post("/{excavation_id}/restore")
def restore(excavation_id: int, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return restore_excavation(db, excavation_id, actor)
