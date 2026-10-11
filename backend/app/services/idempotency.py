import hashlib
import json

from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import IdempotencyRecord


def fingerprint(body):
    return hashlib.sha256(json.dumps(body, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest() if body is not None else None


def replay(db: Session, user_id: int, endpoint: str, key: str | None, request_body=None):
    if not key:
        return None
    row = (
        db.query(IdempotencyRecord)
        .filter_by(user_id=user_id, endpoint=endpoint, idempotency_key=key[:128])
        .one_or_none()
    )
    if row is None:
        return None
    if row.request_hash and row.request_hash != fingerprint(request_body):
        raise AppError(409, "Этот запрос уже сохранён с другими данными. Откройте сохранённую запись или начните новую карточку.")
    payload = json.loads(row.response_json)
    if payload.get("excavation_id"):
        from app.services.domain import get_excavation
        get_excavation(db, payload["excavation_id"])
    return JSONResponse(status_code=row.status_code, content=payload)


def remember(db: Session, user_id: int, endpoint: str, key: str | None, status_code: int, payload: dict, request_body=None) -> None:
    if not key:
        return
    db.add(
        IdempotencyRecord(
            user_id=user_id,
            endpoint=endpoint,
            idempotency_key=key[:128],
            status_code=status_code,
            request_hash=fingerprint(request_body),
            response_json=json.dumps(payload, ensure_ascii=False, default=str),
        )
    )
    db.commit()
