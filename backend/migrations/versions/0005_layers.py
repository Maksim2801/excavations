"""layers

Revision ID: 0005_layers
Revises: 0004_excavations
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_layers"
down_revision = "0004_excavations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "layers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("top_elev", sa.Float(), nullable=False),
        sa.Column("bottom_elev", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("surface_description", sa.Text(), nullable=True),
        sa.Column("inclusions", sa.Text(), nullable=True),
        sa.Column("interpretation", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("top_elev >= bottom_elev", name="ck_layers_elev"),
        sa.UniqueConstraint("excavation_id", "number", name="uq_layer_excavation_number"),
    )
    op.create_index("ix_layers_excavation_id", "layers", ["excavation_id"])


def downgrade() -> None:
    op.drop_index("ix_layers_excavation_id", table_name="layers")
    op.drop_table("layers")
