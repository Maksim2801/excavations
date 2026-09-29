from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_camera, require_field
from app.database import get_db
from app.models import User
from app.schemas.io import LayerIn, LayerUpdate
from app.services.domain import get_layer
from app.services.idempotency import remember, replay
from app.services.layer_service import create_layer, delete_layer, layer_dict, list_layers, update_layer

router = APIRouter()


@router.get("")
def get_layers(excavation_id: int | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_layers(db, excavation_id)


@router.post("")
def post_layer(
    data: LayerIn,
    actor: User = Depends(require_field),
    db: Session = Depends(get_db),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
):
    cached = replay(db, actor.id, "POST /api/layers", idempotency_key)
    if cached:
        return cached
    payload = jsonable_encoder(create_layer(db, data, actor))
    remember(db, actor.id, "POST /api/layers", idempotency_key, 200, payload)
    return payload


@router.get("/{layer_id}")
def get_one(layer_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return layer_dict(db, get_layer(db, layer_id))


@router.put("/{layer_id}")
def put_layer(layer_id: int, data: LayerUpdate, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    return update_layer(db, layer_id, data, actor)


@router.delete("/{layer_id}")
def remove(layer_id: int, actor: User = Depends(require_camera), db: Session = Depends(get_db)):
    delete_layer(db, layer_id, actor)
    return {"status": "deleted"}
