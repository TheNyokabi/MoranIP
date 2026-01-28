"""
Enterprise Features Models

Models for:
- White-label/Branding
- Franchise Management
- BI Connectors
- Multi-location Management
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint, Text, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .iam import Base


def generate_uuid():
    return uuid.uuid4()


class TenantBranding(Base):
    """Complete white-label branding for tenants"""
    __tablename__ = "tenant_branding"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    
    # Visual Identity
    primary_color = Column(String(7), default="#3B82F6")  # Hex color
    secondary_color = Column(String(7), default="#10B981")
    accent_color = Column(String(7), default="#F59E0B")
    background_color = Column(String(7), default="#FFFFFF")
    text_color = Column(String(7), default="#1F2937")
    
    # Logo & Media
    logo_url = Column(String(500), nullable=True)
    logo_dark_url = Column(String(500), nullable=True)  # For dark mode
    favicon_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    login_background_url = Column(String(500), nullable=True)
    
    # Company Info
    company_name = Column(String(255), nullable=True)
    tagline = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    support_phone = Column(String(50), nullable=True)
    website_url = Column(String(500), nullable=True)
    
    # Custom Domain
    custom_domain = Column(String(255), nullable=True)
    custom_domain_verified = Column(Boolean, default=False)
    ssl_certificate = Column(Text, nullable=True)
    ssl_private_key = Column(Text, nullable=True)
    
    # Email Branding
    email_logo_url = Column(String(500), nullable=True)
    email_header_color = Column(String(7), default="#3B82F6")
    email_footer_text = Column(Text, nullable=True)
    email_from_name = Column(String(100), nullable=True)
    email_reply_to = Column(String(255), nullable=True)
    
    # Receipt/Invoice Branding
    receipt_logo_url = Column(String(500), nullable=True)
    receipt_header = Column(Text, nullable=True)
    receipt_footer = Column(Text, nullable=True)
    invoice_logo_url = Column(String(500), nullable=True)
    invoice_terms = Column(Text, nullable=True)
    
    # Typography
    font_family = Column(String(100), default="Inter")
    heading_font_family = Column(String(100), nullable=True)
    
    # Advanced Styling
    custom_css = Column(Text, nullable=True)
    border_radius = Column(String(20), default="8px")
    
    # Feature Toggles
    show_powered_by = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class FranchiseGroup(Base):
    """Group of franchise locations"""
    __tablename__ = "franchise_groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    
    # Franchisor (parent tenant)
    franchisor_tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Group Info
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    
    # Branding
    logo_url = Column(String(500), nullable=True)
    
    # Settings
    settings = Column(JSONB, default={})
    
    # Billing
    billing_type = Column(String(50), default="royalty")  # royalty, flat_fee, hybrid
    royalty_percentage = Column(Numeric(5, 2), default=0)
    flat_fee_amount = Column(Numeric(15, 2), default=0)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    # Relationships
    locations = relationship("FranchiseLocation", back_populates="group")
    
    __table_args__ = (
        UniqueConstraint('franchisor_tenant_id', 'code', name='unique_franchise_group_code'),
    )


class FranchiseLocation(Base):
    """Individual franchise location"""
    __tablename__ = "franchise_locations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("franchise_groups.id"), nullable=False)
    
    # Location tenant
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Location Info
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=False)
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state_province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(2), default="KE")
    
    # Contact
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    manager_name = Column(String(255), nullable=True)
    
    # Geolocation
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    
    # Operating Hours
    operating_hours = Column(JSONB, default={})  # {"monday": {"open": "09:00", "close": "18:00"}, ...}
    
    # Performance
    performance_score = Column(Numeric(5, 2), default=0)
    
    # Status
    status = Column(String(20), default="active")  # active, inactive, suspended, pending
    opened_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    # Relationships
    group = relationship("FranchiseGroup", back_populates="locations")
    
    __table_args__ = (
        UniqueConstraint('group_id', 'code', name='unique_location_code'),
    )


class FranchiseReport(Base):
    """Aggregated franchise reports"""
    __tablename__ = "franchise_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    group_id = Column(UUID(as_uuid=True), ForeignKey("franchise_groups.id"), nullable=False)
    
    # Report Period
    report_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Aggregated Metrics
    total_sales = Column(Numeric(15, 2), default=0)
    total_orders = Column(Integer, default=0)
    average_order_value = Column(Numeric(15, 2), default=0)
    total_customers = Column(Integer, default=0)
    
    # By Location
    location_metrics = Column(JSONB, default={})  # {location_id: {sales: x, orders: y}}
    
    # Top Items
    top_items = Column(JSONB, default=[])
    
    # Royalties
    royalties_due = Column(Numeric(15, 2), default=0)
    royalties_paid = Column(Numeric(15, 2), default=0)
    
    generated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))


class BIConnector(Base):
    """Business Intelligence connector configurations"""
    __tablename__ = "bi_connectors"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Connector Info
    name = Column(String(100), nullable=False)
    connector_type = Column(String(50), nullable=False)  # powerbi, tableau, metabase, google_datastudio
    
    # Connection Settings
    connection_settings = Column(JSONB, default={})  # Encrypted connection details
    
    # Sync Settings
    sync_enabled = Column(Boolean, default=True)
    sync_frequency = Column(String(20), default="hourly")  # realtime, hourly, daily
    last_sync_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Data Sources
    enabled_data_sources = Column(ARRAY(String), default=[])  # ["sales", "inventory", "customers"]
    
    # Status
    status = Column(String(20), default="active")  # active, inactive, error
    last_error = Column(Text, nullable=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class DataExport(Base):
    """Scheduled data exports for BI"""
    __tablename__ = "data_exports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    connector_id = Column(UUID(as_uuid=True), ForeignKey("bi_connectors.id"), nullable=True)
    
    # Export Config
    name = Column(String(100), nullable=False)
    data_source = Column(String(50), nullable=False)  # sales, inventory, customers, etc.
    export_format = Column(String(20), default="json")  # json, csv, parquet
    
    # Filter/Transformation
    filters = Column(JSONB, default={})
    transformations = Column(JSONB, default={})
    columns = Column(ARRAY(String), default=[])
    
    # Schedule
    schedule = Column(String(50), nullable=True)  # cron expression
    is_scheduled = Column(Boolean, default=False)
    
    # Destination
    destination_type = Column(String(50), nullable=False)  # s3, gcs, azure_blob, webhook, sftp
    destination_config = Column(JSONB, default={})
    
    # Status
    last_run_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_run_status = Column(String(20), nullable=True)
    last_run_records = Column(Integer, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class DataExportRun(Base):
    """Individual export execution records"""
    __tablename__ = "data_export_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    export_id = Column(UUID(as_uuid=True), ForeignKey("data_exports.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Execution
    started_at = Column(TIMESTAMP(timezone=True), nullable=False)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Results
    status = Column(String(20), default="running")  # running, completed, failed
    records_exported = Column(Integer, default=0)
    file_size_bytes = Column(Integer, nullable=True)
    file_url = Column(String(500), nullable=True)
    
    # Error
    error_message = Column(Text, nullable=True)
    
    # Triggered by
    triggered_by = Column(String(50), default="schedule")  # schedule, manual, api
    triggered_by_user = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
