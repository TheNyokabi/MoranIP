"""add_tenant_erp_modules

Revision ID: df7029d6841d
Revises: 0928f53cdc52
Create Date: 2026-01-06 14:54:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'df7029d6841d'
down_revision: Union[str, None] = '0928f53cdc52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create tenant_erp_modules table
    op.create_table(
        'tenant_erp_modules',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_code', sa.String(50), nullable=False),  # e.g., 'inventory', 'pos', 'manufacturing'
        sa.Column('module_name', sa.String(100), nullable=False),  # e.g., 'Inventory Management'
        sa.Column('is_enabled', sa.Boolean, nullable=False, default=True),
        sa.Column('configuration', JSONB, nullable=True),  # Module-specific config
        sa.Column('enabled_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('enabled_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()')),
        sa.UniqueConstraint('tenant_id', 'module_code', name='unique_tenant_module')
    )
    
    # Create index for faster lookups
    op.create_index('idx_tenant_erp_modules_tenant', 'tenant_erp_modules', ['tenant_id'])
    op.create_index('idx_tenant_erp_modules_enabled', 'tenant_erp_modules', ['tenant_id', 'is_enabled'])
    
    # Create tenant_erp_config table for ERPNext site configuration
    op.create_table(
        'tenant_erp_config',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('erp_site_name', sa.String(100), nullable=False, unique=True),  # Uses tenant_code
        sa.Column('erp_company_name', sa.String(200), nullable=False),
        sa.Column('erp_api_key', sa.String(200), nullable=True),
        sa.Column('erp_api_secret', sa.String(200), nullable=True),
        sa.Column('is_provisioned', sa.Boolean, nullable=False, default=False),
        sa.Column('provisioned_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('configuration', JSONB, nullable=True),  # Additional ERP config
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    op.create_index('idx_tenant_erp_config_site', 'tenant_erp_config', ['erp_site_name'])


def downgrade() -> None:
    op.drop_index('idx_tenant_erp_config_site')
    op.drop_table('tenant_erp_config')
    op.drop_index('idx_tenant_erp_modules_enabled')
    op.drop_index('idx_tenant_erp_modules_tenant')
    op.drop_table('tenant_erp_modules')
