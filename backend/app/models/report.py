from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    excavation_id: Mapped[int | None] = mapped_column(ForeignKey("excavations.id", ondelete="SET NULL"), nullable=True)
    report_type: Mapped[str] = mapped_column(String(50))
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    format: Mapped[str] = mapped_column(String(16))
    filters_json: Mapped[str] = mapped_column(Text, default="{}")
    columns_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(16), default="draft")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReportTemplate(Base):
    __tablename__ = "report_templates"
    __table_args__ = (UniqueConstraint("created_by_id", "name", name="uq_template_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    filters_json: Mapped[str] = mapped_column(Text, default="{}")
    columns_json: Mapped[str] = mapped_column(Text, default="[]")
    sort_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
