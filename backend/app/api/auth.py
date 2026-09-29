from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token
from app.database import get_db
from app.models import User
from app.schemas.io import LoginIn, RegisterIn, TokenOut
from app.services.audit_service import write_audit
from app.services.user_service import authenticate, register_user, user_dict

router = APIRouter()


def _token(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.role),
        "token_type": "bearer",
        "user": user_dict(user),
    }


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    user = register_user(db, data)
    return _token(user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    return _token(authenticate(db, data.username, data.password))


@router.post("/token")
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate(db, form.username, form.password)
    return {"access_token": create_access_token(user.id, user.role), "token_type": "bearer"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    write_audit(db, user_id=user.id, action="logout", entity="user", entity_id=user.id, commit=True)
    return {"status": "ok"}
