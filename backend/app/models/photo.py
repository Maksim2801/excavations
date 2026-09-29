from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    finding_id: Mapped[int | None] = mapped_column(ForeignKey("findings.id", ondelete="CASCADE"), nullable=True, index=True)
    layer_id: Mapped[int | None] = mapped_column(ForeignKey("layers.id", ondelete="CASCADE"), nullable=True, index=True)
    excavation_id: Mapped[int | None] = mapped_column(ForeignKey("excavations.id", ondelete="CASCADE"), nullable=True, index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    thumb_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    original_name: Mapped[str] = mapped_column(String(255))
    photo_type: Mapped[str] = mapped_column(String(50), default="finding")
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    shot_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    has_scale: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    finding = relationship("Finding", back_populates="photos")
    layer = relationship("Layer", back_populates="photos")
    excavation = relationship("Excavation", back_populates="photos")
    measurements = relationship("Measurement", back_populates="photo")
