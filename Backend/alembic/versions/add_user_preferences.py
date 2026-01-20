"""add user preferences table

Revision ID: add_user_preferences
Revises: 
Create Date: 2026-01-10 12:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'add_user_preferences'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Create user_preferences table
    op.create_table(
        'user_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('favorite_workspaces', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('recent_workspaces', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('dashboard_view_mode', sa.String(20), nullable=False, server_default='grid'),
        sa.Column('theme', sa.String(20), nullable=False, server_default='dark'),
        sa.Column('language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('notification_settings', postgresql.JSON, nullable=True, server_default='{}'),
        sa.Column('custom_settings', postgresql.JSON, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    
    # Create index on user_id for faster lookups
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'])
    
    # Create unique constraint to ensure one preference record per user
    op.create_unique_constraint('uq_user_preferences_user_id', 'user_preferences', ['user_id'])


def downgrade():
    op.drop_constraint('uq_user_preferences_user_id', 'user_preferences', type_='unique')
    op.drop_index('ix_user_preferences_user_id', table_name='user_preferences')
    op.drop_table('user_preferences')
