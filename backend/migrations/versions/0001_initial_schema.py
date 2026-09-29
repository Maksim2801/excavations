"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_meta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=64), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=True),
    )
    op.bulk_insert(
        sa.table("app_meta", sa.column("key", sa.String), sa.column("value", sa.Text)),
        [{"key": "schema", "value": "archaeology-field-inventory"}],
    )


def downgrade() -> None:
    op.drop_table("app_meta")
