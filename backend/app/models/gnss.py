from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GNSSPoint(Base):
    __tablename__ = "gnss_points"

    id: Mapped[int] = mapped_column(primary_key=True)
    excavation_id: Mapped[int] = mapped_column(ForeignKey("excavations.id", ondelete="RESTRICT"), index=True)
    north: Mapped[float] = mapped_column(Float)
    east: Mapped[float] = mapped_column(Float)
    elev: Mapped[float] = mapped_column(Float)
    point_type: Mapped[str] = mapped_column(String(32), index=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    geom = mapped_column(Geometry(geometry_type="POINTZ", srid=0), nullable=True)

    excavation = relationship("Excavation", back_populates="gnss_points")
