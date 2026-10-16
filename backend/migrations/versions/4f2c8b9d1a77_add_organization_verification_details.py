"""add organization verification details

Revision ID: 4f2c8b9d1a77
Revises: c7d1e892f304
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4f2c8b9d1a77"
down_revision: Union[str, None] = "c7d1e892f304"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("official_email_domain", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("official_website", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("proof_document_reference", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "organizations",
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
    )

    op.execute(
        sa.text(
            "UPDATE organizations "
            "SET official_email_domain = 'unknown.invalid', "
            "official_website = 'https://example.invalid', "
            "proof_document_reference = 'legacy-record', "
            "contact_phone = 'not-provided' "
            "WHERE official_email_domain IS NULL"
        )
    )

    op.alter_column("organizations", "official_email_domain", nullable=False)
    op.alter_column("organizations", "official_website", nullable=False)
    op.alter_column("organizations", "proof_document_reference", nullable=False)
    op.alter_column("organizations", "contact_phone", nullable=False)


def downgrade() -> None:
    op.drop_column("organizations", "contact_phone")
    op.drop_column("organizations", "proof_document_reference")
    op.drop_column("organizations", "official_website")
    op.drop_column("organizations", "official_email_domain")
