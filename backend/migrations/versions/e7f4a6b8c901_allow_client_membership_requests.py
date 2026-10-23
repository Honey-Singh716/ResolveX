"""allow client membership requests

Revision ID: e7f4a6b8c901
Revises: d6e3f9a5b812
"""

from alembic import op


revision = "e7f4a6b8c901"
down_revision = "d6e3f9a5b812"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_membership_request_role",
        "membership_requests",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_request_role",
        "membership_requests",
        "role IN ('owner', 'admin', 'manager', 'staff', 'member', 'client')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_membership_request_role",
        "membership_requests",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_request_role",
        "membership_requests",
        "role IN ('owner', 'admin', 'manager', 'staff', 'member')",
    )
