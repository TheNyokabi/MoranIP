"""
Plugin and Webhook Database Models

Models for:
- Marketplace plugins
- Tenant plugin installations
- Webhooks
- Webhook deliveries
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint, Text, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .iam import Base


def generate_uuid():
    return uuid.uuid4()


class MarketplacePlugin(Base):
    """Plugin available in the marketplace"""
    __tablename__ = "marketplace_plugins"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    
    # Identity
    code = Column(String(100), unique=True, nullable=False)  # Unique identifier
    name = Column(String(200), nullable=False)
    version = Column(String(20), nullable=False)
    
    # Categorization
    plugin_type = Column(String(50), nullable=False)  # payment_provider, shipping, etc.
    category = Column(String(50), nullable=True)  # Subcategory
    tags = Column(ARRAY(String), default=[])
    
    # Description
    short_description = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    
    # Media
    icon_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    screenshots = Column(ARRAY(String), default=[])
    
    # Author
    author_name = Column(String(200), nullable=False)
    author_email = Column(String(255), nullable=True)
    author_website = Column(String(500), nullable=True)
    
    # Links
    documentation_url = Column(String(500), nullable=True)
    support_url = Column(String(500), nullable=True)
    source_url = Column(String(500), nullable=True)  # For open source plugins
    
    # Pricing
    is_free = Column(Boolean, default=True)
    price = Column(Numeric(10, 2), default=0)
    price_currency = Column(String(3), default="USD")
    billing_period = Column(String(20), nullable=True)  # monthly, yearly, one_time
    trial_days = Column(Integer, default=0)
    
    # Requirements
    min_platform_version = Column(String(20), default="1.0.0")
    required_permissions = Column(ARRAY(String), default=[])
    dependencies = Column(ARRAY(String), default=[])
    
    # Settings schema
    settings_schema = Column(JSONB, nullable=True)
    
    # Stats
    total_installs = Column(Integer, default=0)
    active_installs = Column(Integer, default=0)
    avg_rating = Column(Numeric(3, 2), default=0)
    total_reviews = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), default="pending")  # pending, approved, rejected, deprecated
    is_verified = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    
    # Metadata
    changelog = Column(Text, nullable=True)
    release_notes = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    published_at = Column(TIMESTAMP(timezone=True), nullable=True)


class PluginInstallation(Base):
    """Tenant plugin installation"""
    __tablename__ = "plugin_installations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    plugin_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_plugins.id"), nullable=False)
    
    # Version info
    installed_version = Column(String(20), nullable=False)
    available_version = Column(String(20), nullable=True)  # For update notification
    
    # Status
    status = Column(String(20), default="installed")  # installed, enabled, disabled, error
    
    # Configuration
    settings = Column(JSONB, default={})
    
    # License/Subscription
    license_key = Column(String(255), nullable=True)
    subscription_id = Column(String(100), nullable=True)
    subscription_status = Column(String(20), nullable=True)
    subscription_expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Trial
    is_trial = Column(Boolean, default=False)
    trial_ends_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Audit
    installed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    installed_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    last_enabled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_disabled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'plugin_id', name='unique_plugin_per_tenant'),
    )


class PluginReview(Base):
    """Plugin reviews"""
    __tablename__ = "plugin_reviews"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    plugin_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_plugins.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Review
    rating = Column(Integer, nullable=False)  # 1-5
    title = Column(String(200), nullable=True)
    review = Column(Text, nullable=True)
    
    # Response
    developer_response = Column(Text, nullable=True)
    developer_responded_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Status
    is_verified_purchase = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('plugin_id', 'user_id', name='unique_review_per_user'),
    )


class Webhook(Base):
    """Webhook configurations"""
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Configuration
    name = Column(String(200), nullable=False)
    url = Column(String(1000), nullable=False)
    secret = Column(String(255), nullable=False)
    
    # Events (stored as array)
    events = Column(ARRAY(String), nullable=False)
    
    # Headers
    custom_headers = Column(JSONB, default={})
    
    # Settings
    timeout_seconds = Column(Integer, default=30)
    max_retries = Column(Integer, default=3)
    retry_interval_seconds = Column(Integer, default=60)
    rate_limit_per_minute = Column(Integer, default=60)
    
    # Status
    status = Column(String(20), default="active")  # active, inactive, suspended, failed
    
    # Stats
    last_triggered_at = Column(TIMESTAMP(timezone=True), nullable=True)
    consecutive_failures = Column(Integer, default=0)
    total_deliveries = Column(Integer, default=0)
    successful_deliveries = Column(Integer, default=0)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class WebhookDelivery(Base):
    """Webhook delivery records"""
    __tablename__ = "webhook_deliveries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Event
    event = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # pending, sent, delivered, failed, retrying
    
    # Response
    response_status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    
    # Retry
    attempt_number = Column(Integer, default=1)
    next_retry_at = Column(TIMESTAMP(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    delivered_at = Column(TIMESTAMP(timezone=True), nullable=True)


class WebhookLog(Base):
    """Aggregated webhook logs for analytics"""
    __tablename__ = "webhook_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("webhooks.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Period
    log_date = Column(DateTime, nullable=False)
    
    # Aggregated stats
    total_deliveries = Column(Integer, default=0)
    successful_deliveries = Column(Integer, default=0)
    failed_deliveries = Column(Integer, default=0)
    avg_response_time_ms = Column(Integer, nullable=True)
    
    # Event breakdown
    events_breakdown = Column(JSONB, default={})  # {"order.created": 10, "invoice.paid": 5}
    
    __table_args__ = (
        UniqueConstraint('webhook_id', 'log_date', name='unique_webhook_daily_log'),
    )
