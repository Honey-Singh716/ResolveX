"""add permanent organization and encrypted invitation codes

Revision ID: b4e1f7a2c903
Revises: 9c7e4a2b6d11
"""

from alembic import op
import sqlalchemy as sa


revision = "b4e1f7a2c903"
down_revision = "9c7e4a2b6d11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("join_code_encrypted", sa.String(length=500), nullable=True))
    op.add_column("organizations", sa.Column("organization_code", sa.String(length=32), nullable=True))
    op.create_index("ix_organizations_organization_code", "organizations", ["organization_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_organizations_organization_code", table_name="organizations")
    op.drop_column("organizations", "organization_code")
    op.drop_column("organizations", "join_code_encrypted")
