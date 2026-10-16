"""add notification target path

Revision ID: 8b6f2d1e4c90
Revises: 4f2c8b9d1a77
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b6f2d1e4c90"
down_revision: Union[str, None] = "4f2c8b9d1a77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("target_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "target_path")
