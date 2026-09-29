from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Excavation(Base):
    __tablename__ = "excavations"
    __table_args__ = (UniqueConstraint("code", "year", name="uq_excavation_code_year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    center_north: Mapped[float] = mapped_column(Float)
    center_east: Mapped[float] = mapped_column(Float)
    center_elev: Mapped[float] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    area_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    grid_step_m: Mapped[float | None] = mapped_column(Float, nullable=True, default=5)
    boundaries: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    geom = mapped_column(Geometry(geometry_type="POINTZ", srid=0), nullable=True)

    layers = relationship("Layer", back_populates="excavation")
    findings = relationship("Finding", back_populates="excavation")
    photos = relationship("Photo", back_populates="excavation")
    gnss_points = relationship("GNSSPoint", back_populates="excavation")
