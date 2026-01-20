"""add_rbac_schema

Revision ID: 10cd5ff2d3c3
Revises: fc75fd1695eb
Create Date: 2026-01-06 06:02:19.927984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '10cd5ff2d3c3'
down_revision: Union[str, None] = 'fc75fd1695eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('role_code', sa.String(length=50), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('level', sa.String(length=20), nullable=False),  # SYSTEM, TENANT, CUSTOM
        sa.Column('scope', sa.String(length=20), nullable=False),  # SYSTEM, TENANT
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('tenant_id', sa.UUID(), nullable=True),  # Only for CUSTOM roles
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_code'),
        sa.UniqueConstraint('code'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE')
    )
    op.create_index('idx_roles_code', 'roles', ['code'])
    op.create_index('idx_roles_tenant_id', 'roles', ['tenant_id'])
    
    # Create permissions table
    op.create_table(
        'permissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('permission_code', sa.String(length=50), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('module', sa.String(length=50), nullable=False),
        sa.Column('resource', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('risk_level', sa.String(length=20), nullable=False, server_default='LOW'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('permission_code'),
        sa.UniqueConstraint('code')
    )
    op.create_index('idx_permissions_code', 'permissions', ['code'])
    op.create_index('idx_permissions_module', 'permissions', ['module'])
    
    # Create role_permissions junction table
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('role_id', 'permission_id', name='unique_role_permission')
    )
    op.create_index('idx_role_permissions_role_id', 'role_permissions', ['role_id'])
    op.create_index('idx_role_permissions_permission_id', 'role_permissions', ['permission_id'])
    
    # Create user_roles table
    op.create_table(
        'user_roles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),  # Nullable for SUPER_ADMIN
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('assigned_by', sa.UUID(), nullable=True),
        sa.Column('assigned_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('user_id', 'tenant_id', 'role_id', name='unique_user_tenant_role')
    )
    op.create_index('idx_user_roles_user_id', 'user_roles', ['user_id'])
    op.create_index('idx_user_roles_tenant_id', 'user_roles', ['tenant_id'])
    op.create_index('idx_user_roles_role_id', 'user_roles', ['role_id'])
    op.create_index('idx_user_roles_active', 'user_roles', ['is_active'])
    
    # Create permission_overrides table
    op.create_table(
        'permission_overrides',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('grant_type', sa.String(length=10), nullable=False),  # GRANT or REVOKE
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('granted_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ondelete='SET NULL')
    )
    op.create_index('idx_permission_overrides_user_tenant', 'permission_overrides', ['user_id', 'tenant_id'])
    op.create_index('idx_permission_overrides_permission_id', 'permission_overrides', ['permission_id'])
    
    # Create role_audit_log table
    op.create_table(
        'role_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('target_user_id', sa.UUID(), nullable=True),
        sa.Column('role_id', sa.UUID(), nullable=True),
        sa.Column('permission_id', sa.UUID(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='SET NULL')
    )
    op.create_index('idx_role_audit_log_user_id', 'role_audit_log', ['user_id'])
    op.create_index('idx_role_audit_log_tenant_id', 'role_audit_log', ['tenant_id'])
    op.create_index('idx_role_audit_log_action', 'role_audit_log', ['action'])
    op.create_index('idx_role_audit_log_created_at', 'role_audit_log', ['created_at'])
    
    # Add primary_role_id to memberships table
    op.add_column('memberships', sa.Column('primary_role_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_memberships_primary_role', 'memberships', 'roles', ['primary_role_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_memberships_primary_role_id', 'memberships', ['primary_role_id'])


def downgrade() -> None:
    # Drop in reverse order
    op.drop_index('idx_memberships_primary_role_id', 'memberships')
    op.drop_constraint('fk_memberships_primary_role', 'memberships', type_='foreignkey')
    op.drop_column('memberships', 'primary_role_id')
    
    op.drop_index('idx_role_audit_log_created_at', 'role_audit_log')
    op.drop_index('idx_role_audit_log_action', 'role_audit_log')
    op.drop_index('idx_role_audit_log_tenant_id', 'role_audit_log')
    op.drop_index('idx_role_audit_log_user_id', 'role_audit_log')
    op.drop_table('role_audit_log')
    
    op.drop_index('idx_permission_overrides_permission_id', 'permission_overrides')
    op.drop_index('idx_permission_overrides_user_tenant', 'permission_overrides')
    op.drop_table('permission_overrides')
    
    op.drop_index('idx_user_roles_active', 'user_roles')
    op.drop_index('idx_user_roles_role_id', 'user_roles')
    op.drop_index('idx_user_roles_tenant_id', 'user_roles')
    op.drop_index('idx_user_roles_user_id', 'user_roles')
    op.drop_table('user_roles')
    
    op.drop_index('idx_role_permissions_permission_id', 'role_permissions')
    op.drop_index('idx_role_permissions_role_id', 'role_permissions')
    op.drop_table('role_permissions')
    
    op.drop_index('idx_permissions_module', 'permissions')
    op.drop_index('idx_permissions_code', 'permissions')
    op.drop_table('permissions')
    
    op.drop_index('idx_roles_tenant_id', 'roles')
    op.drop_index('idx_roles_code', 'roles')
    op.drop_table('roles')
