"""reports and dictionaries

Revision ID: 0010_reports_dict
Revises: 0009_gnss
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_reports_dict"
down_revision = "0009_gnss"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("excavation_id", sa.Integer(), sa.ForeignKey("excavations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("format", sa.String(length=16), nullable=False),
        sa.Column("filters_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("columns_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "report_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("filters_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("columns_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("sort_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("created_by_id", "name", name="uq_template_owner_name"),
    )
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#5c6b73"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "plan_color_schemes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("mapping_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "gnss_point_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "photo_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "measurement_methods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.bulk_insert(
        sa.table(
            "materials",
            sa.column("name", sa.String),
            sa.column("code", sa.String),
            sa.column("color", sa.String),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {"name": "керамика", "code": "ceramic", "color": "#2f6b4f", "is_active": True},
            {"name": "металл", "code": "metal", "color": "#a16207", "is_active": True},
            {"name": "кость", "code": "bone", "color": "#c4a574", "is_active": True},
            {"name": "камень", "code": "stone", "color": "#5c6b73", "is_active": True},
            {"name": "стекло", "code": "glass", "color": "#3d7ea6", "is_active": True},
            {"name": "кремень", "code": "flint", "color": "#6b5b4b", "is_active": True},
            {"name": "дерево", "code": "wood", "color": "#7a5a3a", "is_active": True},
            {"name": "глина", "code": "clay", "color": "#8d5a4a", "is_active": True},
        ],
    )
    op.bulk_insert(
        sa.table(
            "gnss_point_types",
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {"code": "corner", "name": "Угловая", "is_active": True},
            {"code": "control", "name": "Контрольная", "is_active": True},
            {"code": "auxiliary", "name": "Вспомогательная", "is_active": True},
        ],
    )
    op.bulk_insert(
        sa.table(
            "photo_types",
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {"code": "finding", "name": "Находка", "is_active": True},
            {"code": "layer", "name": "Пласт", "is_active": True},
            {"code": "excavation", "name": "Раскоп", "is_active": True},
            {"code": "detail", "name": "Деталь", "is_active": True},
        ],
    )
    op.bulk_insert(
        sa.table(
            "measurement_methods",
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {"code": "none", "name": "Не указан", "is_active": True},
            {"code": "photo", "name": "По фото", "is_active": True},
            {"code": "manual", "name": "Ручное", "is_active": True},
        ],
    )
    op.bulk_insert(
        sa.table(
            "plan_color_schemes",
            sa.column("name", sa.String),
            sa.column("mode", sa.String),
            sa.column("mapping_json", sa.Text),
            sa.column("is_default", sa.Boolean),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {
                "name": "По материалу",
                "mode": "material",
                "mapping_json": "{}",
                "is_default": True,
                "is_active": True,
            },
            {
                "name": "По пластам",
                "mode": "layer",
                "mapping_json": '{"palette":["#8c3a2f","#2f6b4f","#3d7ea6","#a16207","#6b4c7a","#4f6b4a"]}',
                "is_default": False,
                "is_active": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("measurement_methods")
    op.drop_table("photo_types")
    op.drop_table("gnss_point_types")
    op.drop_table("plan_color_schemes")
    op.drop_table("materials")
    op.drop_table("report_templates")
    op.drop_table("reports")
