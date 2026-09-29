"""photos

Revision ID: 0007_photos
Revises: 0006_findings
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_photos"
down_revision = "0006_findings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("finding_id", sa.Integer(), sa.ForeignKey("findings.id", ondelete="CASCADE"), nullable=True),
        sa.Column("layer_id", sa.Integer(), sa.ForeignKey("layers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("thumb_path", sa.String(length=500), nullable=True),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("photo_type", sa.String(length=50), nullable=False, server_default="finding"),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("shot_date", sa.Date(), nullable=True),
        sa.Column("has_scale", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_photos_finding_id", "photos", ["finding_id"])
    op.create_index("ix_photos_layer_id", "photos", ["layer_id"])
    op.create_index("ix_photos_excavation_id", "photos", ["excavation_id"])


def downgrade() -> None:
    op.drop_index("ix_photos_excavation_id", table_name="photos")
    op.drop_index("ix_photos_layer_id", table_name="photos")
    op.drop_index("ix_photos_finding_id", table_name="photos")
    op.drop_table("photos")
