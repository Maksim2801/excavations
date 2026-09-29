from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import User
from app.services.plan_service import build_plan

router = APIRouter()


@router.get("")
def get_plan(
    excavation_id: int,
    layer_id: int | None = None,
    view: str = "ne",
    color_by: str | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return build_plan(db, excavation_id, layer_id, view, color_by)
