"""add notification comment source

Revision ID: 9c7e4a2b6d11
Revises: 8b6f2d1e4c90
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c7e4a2b6d11"
down_revision: Union[str, None] = "8b6f2d1e4c90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("source_comment_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_notifications_source_comment",
        "notifications",
        "comments",
        ["source_comment_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_notifications_source_comment_id",
        "notifications",
        ["source_comment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_source_comment_id", table_name="notifications")
    op.drop_constraint("fk_notifications_source_comment", "notifications", type_="foreignkey")
    op.drop_column("notifications", "source_comment_id")
