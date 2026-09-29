"""gnss points

Revision ID: 0009_gnss
Revises: 0008_measurements
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2.types import Geometry

revision = "0009_gnss"
down_revision = "0008_measurements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gnss_points",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("north", sa.Float(), nullable=False),
        sa.Column("east", sa.Float(), nullable=False),
        sa.Column("elev", sa.Float(), nullable=False),
        sa.Column("point_type", sa.String(length=32), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("source_name", sa.String(length=255), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("geom", Geometry(geometry_type="POINTZ", srid=0), nullable=True),
        sa.CheckConstraint(
            "point_type IN ('corner', 'control', 'auxiliary')",
            name="ck_gnss_point_type",
        ),
    )
    op.create_index("ix_gnss_points_excavation_id", "gnss_points", ["excavation_id"])
    op.create_index("ix_gnss_points_point_type", "gnss_points", ["point_type"])
    op.create_index("ix_gnss_points_geom", "gnss_points", ["geom"], postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("ix_gnss_points_geom", table_name="gnss_points")
    op.drop_index("ix_gnss_points_point_type", table_name="gnss_points")
    op.drop_index("ix_gnss_points_excavation_id", table_name="gnss_points")
    op.drop_table("gnss_points")
