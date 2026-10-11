import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.constants import ROLE_CAMERA, ROLE_FIELD, ROLE_SUPERVISOR
from app.database import get_db
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_error = HTTPException(
        status_code=401,
        detail="Недействительный или просроченный токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise credentials_error
    user = db.get(User, user_id)
    if user is None:
        raise credentials_error
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Учётная запись отключена")
    db.info["actor"] = {"id": user.id, "role": user.role}
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав для этой операции")
        return user

    return dependency


require_field = require_roles(ROLE_FIELD, ROLE_CAMERA, ROLE_SUPERVISOR)
require_camera = require_roles(ROLE_CAMERA, ROLE_SUPERVISOR)
require_supervisor = require_roles(ROLE_SUPERVISOR)
