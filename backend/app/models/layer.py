from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Layer(Base):
    __tablename__ = "layers"
    __table_args__ = (
        UniqueConstraint("excavation_id", "number", name="uq_layer_excavation_number"),
        CheckConstraint("top_elev >= bottom_elev", name="ck_layers_elev"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    excavation_id: Mapped[int] = mapped_column(ForeignKey("excavations.id", ondelete="RESTRICT"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    top_elev: Mapped[float] = mapped_column(Float)
    bottom_elev: Mapped[float] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="open")
    surface_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    inclusions: Mapped[str | None] = mapped_column(Text, nullable=True)
    interpretation: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    excavation = relationship("Excavation", back_populates="layers")
    findings = relationship("Finding", back_populates="layer")
    photos = relationship("Photo", back_populates="layer")
