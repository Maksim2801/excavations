import logging

from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger("archaeology.audit")


def write_audit(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    details: str | None = None,
    commit: bool = False,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=details,
        )
    )
    logger.info("audit user=%s action=%s entity=%s id=%s %s", user_id, action, entity, entity_id, details or "")
    if commit:
        db.commit()
