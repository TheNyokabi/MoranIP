"""
Customer and Supplier Portal Models

Models for:
- Portal users (customers/suppliers with portal access)
- Portal sessions
- Portal activity tracking
- Self-service features
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint, Text, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .iam import Base


def generate_uuid():
    return uuid.uuid4()


class PortalUser(Base):
    """Users with portal access (customers or suppliers)"""
    __tablename__ = "portal_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Link to contact/customer/supplier in ERPNext
    contact_id = Column(String(100), nullable=True)  # ERPNext Contact
    customer_id = Column(String(100), nullable=True)  # ERPNext Customer
    supplier_id = Column(String(100), nullable=True)  # ERPNext Supplier
    
    # Portal type
    portal_type = Column(String(20), nullable=False)  # customer, supplier
    
    # Authentication
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=True)
    
    # Profile
    full_name = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    
    # Preferences
    language = Column(String(10), default="en")
    timezone = Column(String(50), default="Africa/Nairobi")
    notification_preferences = Column(JSONB, default={})
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    
    # Security
    last_login_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Permissions (for customers)
    can_view_orders = Column(Boolean, default=True)
    can_place_orders = Column(Boolean, default=True)
    can_view_invoices = Column(Boolean, default=True)
    can_make_payments = Column(Boolean, default=True)
    can_request_quotes = Column(Boolean, default=True)
    can_view_statements = Column(Boolean, default=True)
    
    # Permissions (for suppliers)
    can_view_purchase_orders = Column(Boolean, default=True)
    can_confirm_orders = Column(Boolean, default=True)
    can_update_delivery = Column(Boolean, default=True)
    can_submit_invoices = Column(Boolean, default=True)
    can_manage_catalog = Column(Boolean, default=True)
    
    # Credit info (for customers)
    credit_limit = Column(Numeric(15, 2), default=0)
    credit_balance = Column(Numeric(15, 2), default=0)
    
    # Metadata
    custom_fields = Column(JSONB, default={})
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', 'portal_type', name='unique_portal_user_email'),
    )


class PortalSession(Base):
    """Portal user sessions"""
    __tablename__ = "portal_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Session info
    token_hash = Column(String(255), nullable=False)
    device_info = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    last_activity_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))


class PortalActivity(Base):
    """Track portal user activities"""
    __tablename__ = "portal_activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Activity info
    activity_type = Column(String(50), nullable=False)  # login, view_order, place_order, download_invoice, etc.
    description = Column(String(500), nullable=True)
    
    # Reference
    reference_type = Column(String(50), nullable=True)  # Sales Order, Sales Invoice, etc.
    reference_id = Column(String(100), nullable=True)
    
    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    activity_data = Column(JSONB, default={})
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))


class PortalQuoteRequest(Base):
    """Quote requests from customers"""
    __tablename__ = "portal_quote_requests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Request details
    request_number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    # Items
    items = Column(JSONB, nullable=False)  # [{"item_code": "...", "qty": 10, "notes": "..."}]
    
    # Delivery
    required_by = Column(DateTime, nullable=True)
    delivery_address = Column(Text, nullable=True)
    
    # Status
    status = Column(String(20), default="pending")  # pending, quoted, accepted, rejected, expired
    
    # Response
    quotation_id = Column(String(100), nullable=True)  # ERPNext Quotation
    quoted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    quoted_total = Column(Numeric(15, 2), nullable=True)
    quote_valid_until = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Rejection reason
    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class PortalOrder(Base):
    """Orders placed through customer portal"""
    __tablename__ = "portal_orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Reference to ERPNext
    sales_order_id = Column(String(100), nullable=True)
    
    # Order details
    order_number = Column(String(50), nullable=False)
    items = Column(JSONB, nullable=False)
    
    # Totals
    subtotal = Column(Numeric(15, 2), default=0)
    tax_amount = Column(Numeric(15, 2), default=0)
    shipping_amount = Column(Numeric(15, 2), default=0)
    discount_amount = Column(Numeric(15, 2), default=0)
    grand_total = Column(Numeric(15, 2), default=0)
    
    # Shipping
    shipping_address = Column(JSONB, nullable=True)
    shipping_method = Column(String(100), nullable=True)
    requested_delivery_date = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(30), default="draft")  # draft, submitted, confirmed, processing, shipped, delivered, cancelled
    
    # Payment
    payment_status = Column(String(20), default="unpaid")  # unpaid, partial, paid
    payment_method = Column(String(50), nullable=True)
    
    # Notes
    customer_notes = Column(Text, nullable=True)
    internal_notes = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    confirmed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    delivered_at = Column(TIMESTAMP(timezone=True), nullable=True)


class SupplierCatalog(Base):
    """Supplier product catalog"""
    __tablename__ = "supplier_catalogs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Item reference
    supplier_item_code = Column(String(100), nullable=False)
    supplier_item_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Mapping to tenant items
    tenant_item_code = Column(String(100), nullable=True)  # ERPNext Item
    
    # Pricing
    unit_price = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="KES")
    min_order_qty = Column(Integer, default=1)
    price_list = Column(JSONB, nullable=True)  # Volume pricing
    
    # Availability
    is_available = Column(Boolean, default=True)
    lead_time_days = Column(Integer, default=0)
    stock_qty = Column(Integer, nullable=True)
    
    # Category
    category = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    
    # Media
    image_url = Column(String(500), nullable=True)
    specifications = Column(JSONB, default={})
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('portal_user_id', 'supplier_item_code', name='unique_supplier_item'),
    )


class SupplierOrderConfirmation(Base):
    """Supplier confirmations for purchase orders"""
    __tablename__ = "supplier_order_confirmations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Reference
    purchase_order_id = Column(String(100), nullable=False)  # ERPNext Purchase Order
    
    # Confirmation
    status = Column(String(20), default="pending")  # pending, confirmed, rejected, partial
    confirmed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Delivery commitment
    expected_delivery_date = Column(DateTime, nullable=True)
    delivery_notes = Column(Text, nullable=True)
    
    # Item confirmations
    item_confirmations = Column(JSONB, default=[])  # [{"item_code": "...", "confirmed_qty": 10, "notes": "..."}]
    
    # Rejection
    rejection_reason = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class SupplierInvoice(Base):
    """Invoices submitted by suppliers"""
    __tablename__ = "supplier_invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Reference
    purchase_order_id = Column(String(100), nullable=True)  # ERPNext Purchase Order
    purchase_invoice_id = Column(String(100), nullable=True)  # Created ERPNext Purchase Invoice
    
    # Invoice details
    supplier_invoice_number = Column(String(100), nullable=False)
    supplier_invoice_date = Column(DateTime, nullable=False)
    
    # Amounts
    subtotal = Column(Numeric(15, 2), default=0)
    tax_amount = Column(Numeric(15, 2), default=0)
    grand_total = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="KES")
    
    # Items
    items = Column(JSONB, nullable=False)
    
    # Attachments
    invoice_attachment_url = Column(String(500), nullable=True)
    supporting_documents = Column(ARRAY(String), default=[])
    
    # Status
    status = Column(String(20), default="submitted")  # submitted, under_review, approved, rejected, paid
    
    # Review
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Payment
    payment_status = Column(String(20), default="unpaid")
    payment_date = Column(DateTime, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class PortalNotification(Base):
    """Notifications for portal users"""
    __tablename__ = "portal_notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    portal_user_id = Column(UUID(as_uuid=True), ForeignKey("portal_users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Notification details
    notification_type = Column(String(50), nullable=False)  # order_confirmed, invoice_ready, payment_received, etc.
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    
    # Reference
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(String(100), nullable=True)
    action_url = Column(String(500), nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Delivery
    sent_via_email = Column(Boolean, default=False)
    sent_via_sms = Column(Boolean, default=False)
    sent_via_whatsapp = Column(Boolean, default=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
