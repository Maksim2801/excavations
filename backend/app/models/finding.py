from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Finding(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("excavation_id", "code", "number", name="uq_finding_code_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    excavation_id: Mapped[int] = mapped_column(ForeignKey("excavations.id", ondelete="RESTRICT"), index=True)
    layer_id: Mapped[int | None] = mapped_column(ForeignKey("layers.id", ondelete="RESTRICT"), nullable=True, index=True)
    full_desc: Mapped[str | None] = mapped_column(Text, nullable=True)
    gnss_point_id: Mapped[int | None] = mapped_column(ForeignKey("gnss_points.id", ondelete="SET NULL"), nullable=True, index=True)
    pt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    code: Mapped[str] = mapped_column(String(100), index=True)
    number: Mapped[int] = mapped_column(Integer, index=True)
    north: Mapped[float | None] = mapped_column(Float, nullable=True)
    east: Mapped[float | None] = mapped_column(Float, nullable=True)
    elev: Mapped[float | None] = mapped_column(Float, nullable=True)
    square: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    material: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    find_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    vessel_part: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ornament: Mapped[str | None] = mapped_column(Text, nullable=True)
    surface_color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fracture_color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fabric: Mapped[str | None] = mapped_column(String(255), nullable=True)
    temper: Mapped[str | None] = mapped_column(String(255), nullable=True)
    surface_treatment: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    depth_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    length_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    thickness_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurement_method: Mapped[str] = mapped_column(String(16), default="none", index=True)
    photo_present: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    record_status: Mapped[str] = mapped_column(String(16), default="draft")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    geom = mapped_column(Geometry(geometry_type="POINTZ", srid=0), nullable=True)

    excavation = relationship("Excavation", back_populates="findings")
    layer = relationship("Layer", back_populates="findings")
    photos = relationship("Photo", back_populates="finding", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="finding", cascade="all, delete-orphan")
