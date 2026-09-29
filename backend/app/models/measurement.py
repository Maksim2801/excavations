from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_id: Mapped[int] = mapped_column(ForeignKey("findings.id", ondelete="CASCADE"), index=True)
    photo_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id", ondelete="SET NULL"), nullable=True)
    measurement_type: Mapped[str] = mapped_column(String(50))
    method: Mapped[str] = mapped_column(String(16))
    result_source: Mapped[str] = mapped_column(String(32))
    detection_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    scale_pixel_distance: Mapped[float | None] = mapped_column(Float, nullable=True)
    scale_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    object_pixel_distance: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_mm: Mapped[float] = mapped_column(Float)
    points_json: Mapped[str] = mapped_column(Text, default="{}")
    accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    finding = relationship("Finding", back_populates="measurements")
    photo = relationship("Photo", back_populates="measurements")
