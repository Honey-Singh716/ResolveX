"""add ownership transfer and deletion lifecycle fields

Revision ID: d6e3f9a5b812
Revises: c5d2e8f4a701
"""

from alembic import op
import sqlalchemy as sa


revision = "d6e3f9a5b812"
down_revision = "c5d2e8f4a701"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("deletion_scheduled_for", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("deletion_requested_by", sa.Uuid(), nullable=True))
    op.add_column("organizations", sa.Column("ownership_transfer_target_id", sa.Uuid(), nullable=True))
    op.add_column("organizations", sa.Column("ownership_transfer_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_organizations_deletion_requested_by_users",
        "organizations",
        "users",
        ["deletion_requested_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_organizations_ownership_transfer_target_users",
        "organizations",
        "users",
        ["ownership_transfer_target_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_organizations_ownership_transfer_target_users", "organizations", type_="foreignkey")
    op.drop_constraint("fk_organizations_deletion_requested_by_users", "organizations", type_="foreignkey")
    op.drop_column("organizations", "archived_at")
    op.drop_column("organizations", "ownership_transfer_requested_at")
    op.drop_column("organizations", "ownership_transfer_target_id")
    op.drop_column("organizations", "deletion_requested_by")
    op.drop_column("organizations", "deletion_scheduled_for")
    op.drop_column("organizations", "deletion_requested_at")
