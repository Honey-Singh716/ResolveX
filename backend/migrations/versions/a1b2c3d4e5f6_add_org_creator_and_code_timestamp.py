"""add org creator provenance and organization_code_created_at

Revision ID: a1b2c3d4e5f6
Revises: f8a5b7c9d012
Create Date: 2026-10-31 00:00:00.000000

Adds two columns to the organizations table:
  - created_by (UUID, FK → users.id SET NULL): preserves original creator
    even after ownership transfers.
  - organization_code_created_at (DateTime tz): records when the permanent
    organization identity code was first provisioned.

Both columns are nullable so that existing rows are unaffected and no data
backfill is required.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str = "f8a5b7c9d012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add created_by FK column
    op.add_column(
        "organizations",
        sa.Column(
            "created_by",
            sa.Uuid(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_organizations_created_by_users",
        "organizations",
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_organizations_created_by"),
        "organizations",
        ["created_by"],
        unique=False,
    )

    # Add organization_code_created_at
    op.add_column(
        "organizations",
        sa.Column(
            "organization_code_created_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "organization_code_created_at")
    op.drop_index(
        op.f("ix_organizations_created_by"),
        table_name="organizations",
    )
    op.drop_constraint(
        "fk_organizations_created_by_users",
        "organizations",
        type_="foreignkey",
    )
    op.drop_column("organizations", "created_by")
