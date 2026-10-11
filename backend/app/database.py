from collections.abc import Generator

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@event.listens_for(Session, "do_orm_execute")
def restrict_field_excavations(state):
    """Request-scoped row access, including lists, relationships and direct ORM lookups.

    Raw SQL must first resolve its excavation through services.domain.get_excavation.
    Background jobs have no request actor and are intentionally not scoped.
    """
    actor = state.session.info.get("actor")
    if not state.is_select or actor is None or actor["role"] != "field_archaeologist":
        return
    from sqlalchemy.orm import with_loader_criteria
    from app.models import Excavation, ExcavationMember, Finding, Layer, Photo, GNSSPoint
    allowed = select(ExcavationMember.excavation_id).where(ExcavationMember.user_id == actor["id"])
    statement = state.statement.options(with_loader_criteria(Excavation, Excavation.id.in_(allowed), include_aliases=True))
    for model in (Finding, Layer, Photo, GNSSPoint):
        statement = statement.options(with_loader_criteria(model, model.excavation_id.in_(allowed), include_aliases=True))
    state.statement = statement
