from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import settings
from app.errors import AppError


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise AppError(400, "Пароль должен содержать не меньше 8 символов")
    raw = password.encode("utf-8")
    if len(raw) > 72:
        raise AppError(400, "Пароль слишком длинный")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
