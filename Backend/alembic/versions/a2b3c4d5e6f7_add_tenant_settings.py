"""Add TenantSettings model

Revision ID: a2b3c4d5e6f7
Revises: bffefa522f1e
Create Date: 2026-01-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'bffefa522f1e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenant_settings table
    op.create_table(
        'tenant_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('legal_name', sa.String(255), nullable=True),
        sa.Column('business_type', sa.String(100), nullable=True),
        sa.Column('registration_number', sa.String(100), nullable=True),
        sa.Column('tax_id', sa.String(100), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('street_address', sa.String(255), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state_province', sa.String(100), nullable=True),
        sa.Column('postal_code', sa.String(20), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='KES'),
        sa.Column('fiscal_year_start_month', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('accounting_method', sa.String(50), nullable=False, server_default='accrual'),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('employees_count', sa.Integer(), nullable=True),
        sa.Column('annual_revenue', sa.String(50), nullable=True),
        sa.Column('enable_invoicing', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_pos', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_inventory', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_hr', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_projects', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('logo_url', sa.String(255), nullable=True),
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Africa/Nairobi'),
        sa.Column('setup_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_tenant_settings_tenant_id')
    )


def downgrade() -> None:
    op.drop_table('tenant_settings')
