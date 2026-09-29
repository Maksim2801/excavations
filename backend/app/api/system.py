from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.dependencies import require_supervisor
from app.database import get_db
from app.models import AuditLog, User

router = APIRouter()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    postgis = db.execute(text("SELECT PostGIS_Version()")).scalar()
    return {"status": "ok", "database": "postgresql", "postgis": postgis}


@router.get("/audit")
def audit(limit: int = 100, _: User = Depends(require_supervisor), db: Session = Depends(get_db)):
    limit = min(max(limit, 1), 500)
    rows = (
        db.query(AuditLog, User.username)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": username,
            "action": log.action,
            "entity": log.entity,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at,
        }
        for log, username in rows
    ]
