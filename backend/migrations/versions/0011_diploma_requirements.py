"""Excavation assignments, full descriptions and GNSS provenance."""
from alembic import op
import sqlalchemy as sa

revision = "0011_diploma"
down_revision = "0010_reports_dict"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("idempotency_keys", sa.Column("request_hash", sa.String(64), nullable=True))
    op.create_table("excavation_members",
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))
    op.create_index("ix_excavation_members_user_id", "excavation_members", ["user_id"])
    op.add_column("findings", sa.Column("full_desc", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("gnss_point_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_findings_gnss_point", "findings", "gnss_points", ["gnss_point_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_findings_gnss_point_id", "findings", ["gnss_point_id"])
    op.execute("UPDATE layers SET description = coalesce(description, '') || ' Цвет грунта: ' || color, color = NULL WHERE color IS NOT NULL AND color !~ '^#[0-9a-fA-F]{6}$'")
    # No automatic grants for existing users: supervisor explicitly assigns excavation access.


def downgrade():
    op.drop_column("idempotency_keys", "request_hash")
    op.drop_index("ix_findings_gnss_point_id", table_name="findings")
    op.drop_constraint("fk_findings_gnss_point", "findings", type_="foreignkey")
    op.drop_column("findings", "gnss_point_id")
    op.drop_column("findings", "full_desc")
    op.drop_table("excavation_members")
