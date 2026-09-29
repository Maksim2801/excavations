"""measurements

Revision ID: 0008_measurements
Revises: 0007_photos
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_measurements"
down_revision = "0007_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("finding_id", sa.Integer(), sa.ForeignKey("findings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("photo_id", sa.Integer(), sa.ForeignKey("photos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("measurement_type", sa.String(length=50), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("result_source", sa.String(length=32), nullable=False),
        sa.Column("detection_status", sa.String(length=40), nullable=True),
        sa.Column("scale_pixel_distance", sa.Float(), nullable=True),
        sa.Column("scale_mm", sa.Float(), nullable=True),
        sa.Column("object_pixel_distance", sa.Float(), nullable=True),
        sa.Column("result_mm", sa.Float(), nullable=False),
        sa.Column("points_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_measurements_finding_id", "measurements", ["finding_id"])


def downgrade() -> None:
    op.drop_index("ix_measurements_finding_id", table_name="measurements")
    op.drop_table("measurements")
