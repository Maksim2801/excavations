"""findings

Revision ID: 0006_findings
Revises: 0005_layers
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2.types import Geometry

revision = "0006_findings"
down_revision = "0005_layers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("layer_id", sa.Integer(), sa.ForeignKey("layers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("pt", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("north", sa.Float(), nullable=True),
        sa.Column("east", sa.Float(), nullable=True),
        sa.Column("elev", sa.Float(), nullable=True),
        sa.Column("square", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("material", sa.String(length=255), nullable=True),
        sa.Column("find_type", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("vessel_part", sa.String(length=100), nullable=True),
        sa.Column("ornament", sa.Text(), nullable=True),
        sa.Column("surface_color", sa.String(length=100), nullable=True),
        sa.Column("fracture_color", sa.String(length=100), nullable=True),
        sa.Column("fabric", sa.String(length=255), nullable=True),
        sa.Column("temper", sa.String(length=255), nullable=True),
        sa.Column("surface_treatment", sa.String(length=255), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("depth_cm", sa.Float(), nullable=True),
        sa.Column("length_mm", sa.Float(), nullable=True),
        sa.Column("width_mm", sa.Float(), nullable=True),
        sa.Column("thickness_mm", sa.Float(), nullable=True),
        sa.Column("measurement_method", sa.String(length=16), nullable=False, server_default="none"),
        sa.Column("photo_present", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("record_status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("geom", Geometry(geometry_type="POINTZ", srid=0), nullable=True),
        sa.CheckConstraint(
            "measurement_method IN ('none', 'photo', 'manual')",
            name="ck_findings_method",
        ),
        sa.UniqueConstraint("excavation_id", "code", "number", name="uq_finding_code_number"),
    )
    op.create_index("ix_findings_excavation_id", "findings", ["excavation_id"])
    op.create_index("ix_findings_layer_id", "findings", ["layer_id"])
    op.create_index("ix_findings_code", "findings", ["code"])
    op.create_index("ix_findings_number", "findings", ["number"])
    op.create_index("ix_findings_square", "findings", ["square"])
    op.create_index("ix_findings_material", "findings", ["material"])
    op.create_index("ix_findings_method", "findings", ["measurement_method"])
    op.create_index("ix_findings_geom", "findings", ["geom"], postgresql_using="gist")
    op.create_index(
        "uq_findings_pt",
        "findings",
        ["excavation_id", "pt"],
        unique=True,
        postgresql_where=sa.text("pt IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_findings_pt", table_name="findings")
    op.drop_index("ix_findings_geom", table_name="findings")
    op.drop_index("ix_findings_method", table_name="findings")
    op.drop_index("ix_findings_material", table_name="findings")
    op.drop_index("ix_findings_square", table_name="findings")
    op.drop_index("ix_findings_number", table_name="findings")
    op.drop_index("ix_findings_code", table_name="findings")
    op.drop_index("ix_findings_layer_id", table_name="findings")
    op.drop_index("ix_findings_excavation_id", table_name="findings")
    op.drop_table("findings")
