import json

from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.models import IdempotencyRecord


def replay(db: Session, user_id: int, endpoint: str, key: str | None):
    if not key:
        return None
    row = (
        db.query(IdempotencyRecord)
        .filter_by(user_id=user_id, endpoint=endpoint, idempotency_key=key[:128])
        .one_or_none()
    )
    if row is None:
        return None
    return JSONResponse(status_code=row.status_code, content=json.loads(row.response_json))


def remember(db: Session, user_id: int, endpoint: str, key: str | None, status_code: int, payload: dict) -> None:
    if not key:
        return
    db.add(
        IdempotencyRecord(
            user_id=user_id,
            endpoint=endpoint,
            idempotency_key=key[:128],
            status_code=status_code,
            response_json=json.dumps(payload, ensure_ascii=False, default=str),
        )
    )
    db.commit()
