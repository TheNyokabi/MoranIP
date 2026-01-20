"""Add workspace_type to tenant_onboarding

Revision ID: f1g2h3i4j5k6
Revises: e8f9a0b1c2d3
Create Date: 2026-01-09 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f1g2h3i4j5k6'
down_revision = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add workspace_type column to tenant_onboarding table
    op.add_column('tenant_onboarding', 
        sa.Column('workspace_type', sa.String(50), nullable=True)
    )
    
    # Update status column to include PAUSED status (if not already there)
    # Note: The status column already exists, we're just documenting the new status
    # ALTER TYPE would be needed if using ENUM, but since it's String, no migration needed
    
    # Create index for faster lookups by workspace_type
    op.create_index('idx_onboarding_workspace_type', 'tenant_onboarding', ['workspace_type'])


def downgrade() -> None:
    op.drop_index('idx_onboarding_workspace_type', table_name='tenant_onboarding')
    op.drop_column('tenant_onboarding', 'workspace_type')
