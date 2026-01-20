"""Add Security and Notification Settings

Revision ID: e8f9a0b1c2d3
Revises: a2b3c4d5e6f7
Create Date: 2026-01-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'e8f9a0b1c2d3'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenant_security_settings table
    op.create_table(
        'tenant_security_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('min_password_length', sa.Integer(), nullable=False, server_default='8'),
        sa.Column('require_uppercase', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('require_lowercase', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('require_numbers', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('require_special_chars', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('password_expiry_days', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('session_timeout_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('max_concurrent_sessions', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('require_mfa', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ip_whitelist_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ip_whitelist', postgresql.JSONB, nullable=True, server_default='[]'),
        sa.Column('block_suspicious_activity', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_audit_log', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('log_failed_login_attempts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('log_sensitive_operations', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_tenant_security_settings_tenant_id')
    )

    # Create tenant_notification_settings table
    op.create_table(
        'tenant_notification_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_new_user_invite', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_role_changes', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_payment_received', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_invoice_generated', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_order_status_change', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_low_stock_alert', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('email_monthly_report', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_new_messages', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_task_assignments', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_approval_requests', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('in_app_system_updates', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sms_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sms_order_confirmation', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sms_payment_received', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sms_important_alerts', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('push_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('push_instant_alerts', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('push_daily_summary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quiet_hours_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('quiet_hours_start', sa.String(5), nullable=False, server_default='22:00'),
        sa.Column('quiet_hours_end', sa.String(5), nullable=False, server_default='08:00'),
        sa.Column('digest_frequency', sa.String(10), nullable=False, server_default='daily'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_tenant_notification_settings_tenant_id')
    )

    # Create indexes for faster lookups
    op.create_index('idx_tenant_security_settings_tenant', 'tenant_security_settings', ['tenant_id'])
    op.create_index('idx_tenant_notification_settings_tenant', 'tenant_notification_settings', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('idx_tenant_notification_settings_tenant', table_name='tenant_notification_settings')
    op.drop_index('idx_tenant_security_settings_tenant', table_name='tenant_security_settings')
    op.drop_table('tenant_notification_settings')
    op.drop_table('tenant_security_settings')
