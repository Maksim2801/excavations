"""postgis extension

Revision ID: 0002_postgis
Revises: 0001_initial
Create Date: 2026-09-30
"""

from alembic import op

revision = "0002_postgis"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS postgis")
