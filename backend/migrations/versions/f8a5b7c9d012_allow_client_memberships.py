"""allow client organization memberships

Revision ID: f8a5b7c9d012
Revises: e7f4a6b8c901
"""

from alembic import op


revision = "f8a5b7c9d012"
down_revision = "e7f4a6b8c901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_membership_role",
        "memberships",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_role",
        "memberships",
        "role IN ('owner', 'admin', 'manager', 'staff', 'member', 'client')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_membership_role",
        "memberships",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_role",
        "memberships",
        "role IN ('owner', 'admin', 'manager', 'staff', 'member')",
    )
