"""Add provisioning fields to tenant_onboarding and tenants

Revision ID: add_provisioning_fields
Revises: f1g2h3i4j5k6
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_provisioning_fields'
down_revision = 'f1g2h3i4j5k6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add provisioning fields to tenant_onboarding table
    op.add_column('tenant_onboarding',
        sa.Column('provisioning_type', sa.String(20), nullable=True)
    )
    op.add_column('tenant_onboarding',
        sa.Column('provisioning_config', postgresql.JSONB, nullable=True)
    )
    op.add_column('tenant_onboarding',
        sa.Column('provisioning_steps', postgresql.JSONB, nullable=True)
    )
    op.add_column('tenant_onboarding',
        sa.Column('provisioning_metadata', postgresql.JSONB, nullable=True)
    )
    
    # Add provisioning fields to tenants table
    op.add_column('tenants',
        sa.Column('provisioning_status', sa.String(20), server_default='NOT_PROVISIONED', nullable=False)
    )
    op.add_column('tenants',
        sa.Column('provisioned_at', sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.add_column('tenants',
        sa.Column('provisioning_error', sa.Text(), nullable=True)
    )
    
    # Create indexes
    op.create_index(
        'idx_tenant_onboarding_provisioning_status',
        'tenant_onboarding',
        ['tenant_id', 'status'],
        postgresql_where=sa.text('provisioning_type IS NOT NULL')
    )
    op.create_index(
        'idx_tenants_provisioning_status',
        'tenants',
        ['provisioning_status']
    )
    
    # Data migration: Set provisioning_status = 'NOT_PROVISIONED' for existing tenants
    op.execute("""
        UPDATE tenants
        SET provisioning_status = 'NOT_PROVISIONED'
        WHERE provisioning_status IS NULL
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_tenants_provisioning_status', table_name='tenants')
    op.drop_index('idx_tenant_onboarding_provisioning_status', table_name='tenant_onboarding')
    
    # Drop columns from tenants table
    op.drop_column('tenants', 'provisioning_error')
    op.drop_column('tenants', 'provisioned_at')
    op.drop_column('tenants', 'provisioning_status')
    
    # Drop columns from tenant_onboarding table
    op.drop_column('tenant_onboarding', 'provisioning_metadata')
    op.drop_column('tenant_onboarding', 'provisioning_steps')
    op.drop_column('tenant_onboarding', 'provisioning_config')
    op.drop_column('tenant_onboarding', 'provisioning_type')
