from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_supervisor
from app.database import get_db
from app.models import User
from app.schemas.io import RegisterIn, UserUpdate
from app.services.user_service import create_user_record, list_users, update_user, user_dict

router = APIRouter()


@router.get("")
def get_users(_: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return list_users(db)


@router.post("")
def post_user(data: RegisterIn, role: str = "field_archaeologist", actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    user = create_user_record(
        db,
        username=data.username,
        password=data.password,
        full_name=data.full_name,
        role=role,
        email=data.email,
        actor_id=actor.id,
    )
    return user_dict(user)


@router.put("/{user_id}")
def put_user(user_id: int, data: UserUpdate, actor: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    return update_user(db, user_id, data, actor)
