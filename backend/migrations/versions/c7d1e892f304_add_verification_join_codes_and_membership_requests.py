"""add verification join codes and membership requests

Revision ID: c7d1e892f304
Revises: a3f7c2e81b05
Create Date: 2026-10-16 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d1e892f304'
down_revision: Union[str, None] = 'a3f7c2e81b05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_platform_admin to users
    op.add_column('users', sa.Column('is_platform_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 2. Add verification & join code columns to organizations
    op.add_column('organizations', sa.Column('verification_status', sa.String(length=20), nullable=False, server_default='pending'))
    op.add_column('organizations', sa.Column('rejection_reason', sa.String(length=500), nullable=True))
    op.add_column('organizations', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('organizations', sa.Column('verified_by', sa.Uuid(), nullable=True))
    op.add_column('organizations', sa.Column('join_code_hash', sa.String(length=255), nullable=True))
    op.add_column('organizations', sa.Column('join_code_created_at', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key('fk_organizations_verified_by_users', 'organizations', 'users', ['verified_by'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_organizations_verification_status'), 'organizations', ['verification_status'], unique=False)
    op.create_index(op.f('ix_organizations_join_code_hash'), 'organizations', ['join_code_hash'], unique=False)

    # 3. Create membership_requests table
    op.create_table(
        'membership_requests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('role', sa.String(length=20), nullable=False, server_default='member'),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('decided_by', sa.Uuid(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_membership_request_status'),
        sa.CheckConstraint("role IN ('owner', 'admin', 'manager', 'staff', 'member')", name='ck_membership_request_role'),
        sa.ForeignKeyConstraint(['decided_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_membership_requests_organization_id'), 'membership_requests', ['organization_id'], unique=False)
    op.create_index(op.f('ix_membership_requests_user_id'), 'membership_requests', ['user_id'], unique=False)
    op.create_index(op.f('ix_membership_requests_status'), 'membership_requests', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_membership_requests_status'), table_name='membership_requests')
    op.drop_index(op.f('ix_membership_requests_user_id'), table_name='membership_requests')
    op.drop_index(op.f('ix_membership_requests_organization_id'), table_name='membership_requests')
    op.drop_table('membership_requests')

    op.drop_index(op.f('ix_organizations_join_code_hash'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_verification_status'), table_name='organizations')
    op.drop_constraint('fk_organizations_verified_by_users', 'organizations', type_='foreignkey')
    op.drop_column('organizations', 'join_code_created_at')
    op.drop_column('organizations', 'join_code_hash')
    op.drop_column('organizations', 'verified_by')
    op.drop_column('organizations', 'verified_at')
    op.drop_column('organizations', 'rejection_reason')
    op.drop_column('organizations', 'verification_status')

    op.drop_column('users', 'is_platform_admin')
