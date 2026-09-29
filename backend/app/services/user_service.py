from sqlalchemy.orm import Session

from app.auth.security import hash_password, verify_password
from app.constants import ROLE_FIELD, ROLE_LABELS, ROLE_SUPERVISOR, ROLES
from app.errors import AppError
from app.models import User
from app.services.audit_service import write_audit


def user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role),
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


def create_user_record(
    db: Session,
    *,
    username: str,
    password: str,
    full_name: str,
    role: str,
    email: str | None = None,
    actor_id: int | None = None,
) -> User:
    username = username.strip()
    if db.query(User).filter(User.username == username).first():
        raise AppError(409, "Пользователь с таким именем уже зарегистрирован")
    if email:
        email = email.strip().lower()
        if db.query(User).filter(User.email == email).first():
            raise AppError(409, "Пользователь с такой почтой уже зарегистрирован")
    if role not in ROLES:
        raise AppError(400, "Неизвестная роль")
    user = User(
        username=username,
        email=email or None,
        full_name=full_name.strip(),
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    write_audit(db, user_id=actor_id or user.id, action="create", entity="user", entity_id=user.id, details=user.username)
    db.commit()
    db.refresh(user)
    return user


def register_user(db: Session, data) -> User:
    return create_user_record(
        db,
        username=data.username,
        password=data.password,
        full_name=data.full_name,
        role=ROLE_FIELD,
        email=data.email,
    )


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username.strip()).one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        write_audit(db, user_id=None, action="login_failed", entity="user", details=username.strip(), commit=True)
        raise AppError(401, "Неверное имя пользователя или пароль")
    if not user.is_active:
        raise AppError(403, "Учётная запись отключена")
    write_audit(db, user_id=user.id, action="login", entity="user", entity_id=user.id, commit=True)
    return user


def list_users(db: Session) -> list[dict]:
    return [user_dict(user) for user in db.query(User).order_by(User.username).all()]


def update_user(db: Session, user_id: int, data, actor: User) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise AppError(404, "Пользователь не найден")
    payload = data.model_dump(exclude_unset=True)
    if "role" in payload and payload["role"] is not None:
        if payload["role"] not in ROLES:
            raise AppError(400, "Неизвестная роль")
        if user.id == actor.id and payload["role"] != ROLE_SUPERVISOR and actor.role == ROLE_SUPERVISOR:
            others = (
                db.query(User)
                .filter(User.role == ROLE_SUPERVISOR, User.is_active.is_(True), User.id != user.id)
                .count()
            )
            if others == 0:
                raise AppError(409, "Нельзя снять роль руководителя с единственной активной учётной записи")
        user.role = payload["role"]
    if "is_active" in payload and payload["is_active"] is not None:
        if user.id == actor.id and payload["is_active"] is False:
            raise AppError(409, "Нельзя отключить собственную учётную запись")
        user.is_active = payload["is_active"]
    if payload.get("full_name"):
        user.full_name = payload["full_name"].strip()
    if "email" in payload:
        user.email = payload["email"].strip().lower() if payload["email"] else None
    if payload.get("password"):
        user.hashed_password = hash_password(payload["password"])
    write_audit(db, user_id=actor.id, action="update", entity="user", entity_id=user.id, details=user.username)
    db.commit()
    db.refresh(user)
    return user_dict(user)
