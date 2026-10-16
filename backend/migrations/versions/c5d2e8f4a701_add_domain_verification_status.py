"""add explicit organization domain verification state

Revision ID: c5d2e8f4a701
Revises: b4e1f7a2c903
"""

from alembic import op
import sqlalchemy as sa


revision = "c5d2e8f4a701"
down_revision = "b4e1f7a2c903"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("domain_verification_status", sa.String(length=20), nullable=True),
    )
    op.execute(
        "UPDATE organizations SET domain_verification_status = "
        "CASE WHEN verification_status = 'approved' THEN 'verified' ELSE 'pending' END"
    )
    op.alter_column("organizations", "domain_verification_status", nullable=False)
    op.create_index(
        "ix_organizations_domain_verification_status",
        "organizations",
        ["domain_verification_status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_organizations_domain_verification_status",
        table_name="organizations",
    )
    op.drop_column("organizations", "domain_verification_status")
