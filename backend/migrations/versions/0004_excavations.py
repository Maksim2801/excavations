"""excavations

Revision ID: 0004_excavations
Revises: 0003_users
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2.types import Geometry

revision = "0004_excavations"
down_revision = "0003_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "excavations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("center_north", sa.Float(), nullable=False),
        sa.Column("center_east", sa.Float(), nullable=False),
        sa.Column("center_elev", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("area_m2", sa.Float(), nullable=True),
        sa.Column("grid_step_m", sa.Float(), nullable=True, server_default="5"),
        sa.Column("boundaries", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("geom", Geometry(geometry_type="POINTZ", srid=0), nullable=True),
        sa.CheckConstraint("status IN ('active', 'archived')", name="ck_excavations_status"),
        sa.UniqueConstraint("code", "year", name="uq_excavation_code_year"),
    )
    op.create_index("ix_excavations_code", "excavations", ["code"])
    op.create_index("ix_excavations_year", "excavations", ["year"])
    op.create_index("ix_excavations_status", "excavations", ["status"])
    op.create_index("ix_excavations_geom", "excavations", ["geom"], postgresql_using="gist")


def downgrade() -> None:
    op.drop_index("ix_excavations_geom", table_name="excavations")
    op.drop_index("ix_excavations_status", table_name="excavations")
    op.drop_index("ix_excavations_year", table_name="excavations")
    op.drop_index("ix_excavations_code", table_name="excavations")
    op.drop_table("excavations")
