"""
Tax Models

Comprehensive tax management for Kenya and other jurisdictions:
- VAT (Value Added Tax)
- Withholding Tax
- Corporate Tax
- Excise Duty
- Custom integrations with Chart of Accounts

Author: MoranERP Team
"""

from sqlalchemy import (
    Column, String, Text, Numeric, Boolean, Integer,
    DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from ..database import Base


def generate_uuid():
    return uuid.uuid4()


class TaxType(Base):
    """
    Defines types of taxes applicable (VAT, WHT, Excise, etc.)
    """
    __tablename__ = "tax_types"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Identification
    code = Column(String(20), nullable=False)  # e.g., "VAT", "WHT", "EXCISE"
    name = Column(String(100), nullable=False)  # e.g., "Value Added Tax"
    description = Column(Text, nullable=True)
    
    # Classification
    tax_category = Column(String(30), nullable=False)
    # Categories: sales_tax, purchase_tax, withholding, income_tax, duty, levy
    
    # Behavior
    is_compound = Column(Boolean, default=False)  # Tax on tax
    is_recoverable = Column(Boolean, default=True)  # Can be claimed back (input VAT)
    affects_gross = Column(Boolean, default=True)  # Affects selling price
    
    # Chart of Accounts Integration
    output_account_id = Column(String(100), nullable=True)  # Sales tax payable
    input_account_id = Column(String(100), nullable=True)  # Purchase tax receivable
    expense_account_id = Column(String(100), nullable=True)  # For non-recoverable taxes
    
    # Filing
    filing_frequency = Column(String(20), default="monthly")  # monthly, quarterly, annually
    filing_due_day = Column(Integer, default=20)  # Day of month when filing is due
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    rates = relationship("TaxRate", back_populates="tax_type", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_tax_type_code_per_tenant'),
    )


class TaxRate(Base):
    """
    Tax rates for each tax type.
    Supports multiple rates (standard, reduced, zero-rated, exempt).
    """
    __tablename__ = "tax_rates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    tax_type_id = Column(UUID(as_uuid=True), ForeignKey("tax_types.id"), nullable=False)
    
    # Rate identification
    code = Column(String(30), nullable=False)  # e.g., "STD", "REDUCED", "ZERO", "EXEMPT"
    name = Column(String(100), nullable=False)  # e.g., "Standard Rate 16%"
    description = Column(Text, nullable=True)
    
    # Rate value
    rate_percentage = Column(Numeric(8, 4), nullable=False)  # e.g., 16.0000 for 16%
    rate_type = Column(String(20), default="percentage")  # "percentage" or "fixed"
    fixed_amount = Column(Numeric(15, 2), nullable=True)  # For fixed-rate taxes
    
    # Validity period
    effective_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    effective_to = Column(DateTime, nullable=True)
    
    # Applicability
    applies_to_items = Column(Boolean, default=True)
    applies_to_services = Column(Boolean, default=True)
    
    # Item group restrictions (JSON array of item group codes)
    item_groups = Column(JSONB, nullable=True)  # If set, only applies to these groups
    excluded_item_groups = Column(JSONB, nullable=True)  # Explicitly excluded groups
    
    # Geographic restrictions
    applies_to_regions = Column(JSONB, nullable=True)  # If set, only applies in these regions
    
    # Is this the default rate for new items?
    is_default = Column(Boolean, default=False)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tax_type = relationship("TaxType", back_populates="rates")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'tax_type_id', 'code', name='unique_tax_rate_code_per_type'),
    )


class ItemTaxTemplate(Base):
    """
    Pre-defined tax templates for items.
    E.g., "Standard Taxable", "Zero-Rated Export", "Exempt Medical"
    """
    __tablename__ = "item_tax_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Template identification
    code = Column(String(30), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Tax rates applied by this template (JSON array)
    # [{"tax_type_id": "...", "tax_rate_id": "...", "priority": 1}, ...]
    tax_rates = Column(JSONB, nullable=False, default=list)
    
    # Usage
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_item_tax_template_code'),
    )


class TaxTransaction(Base):
    """
    Records individual tax transactions for reporting and filing.
    """
    __tablename__ = "tax_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Tax classification
    tax_type_id = Column(UUID(as_uuid=True), ForeignKey("tax_types.id"), nullable=False)
    tax_rate_id = Column(UUID(as_uuid=True), ForeignKey("tax_rates.id"), nullable=False)
    
    # Transaction direction
    transaction_type = Column(String(20), nullable=False)  # "output" (sales) or "input" (purchases)
    
    # Source document
    document_type = Column(String(50), nullable=False)  # "POS Invoice", "Sales Invoice", "Purchase Invoice"
    document_id = Column(String(100), nullable=False)
    document_date = Column(DateTime, nullable=False)
    
    # Amounts
    base_amount = Column(Numeric(15, 2), nullable=False)  # Pre-tax amount
    tax_amount = Column(Numeric(15, 2), nullable=False)  # Calculated tax
    currency = Column(String(3), default="KES")
    exchange_rate = Column(Numeric(15, 6), default=1)
    
    # Party details
    party_type = Column(String(20), nullable=True)  # "Customer" or "Supplier"
    party_id = Column(String(100), nullable=True)
    party_name = Column(String(200), nullable=True)
    party_tax_id = Column(String(50), nullable=True)  # KRA PIN for Kenya
    
    # GL posting status
    is_posted = Column(Boolean, default=False)
    gl_entry_id = Column(String(100), nullable=True)
    
    # Filing period
    fiscal_year = Column(String(10), nullable=True)
    period = Column(String(10), nullable=True)  # e.g., "2024-01" for January 2024
    is_filed = Column(Boolean, default=False)
    filed_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WithholdingTaxConfig(Base):
    """
    Configuration for withholding tax obligations.
    """
    __tablename__ = "withholding_tax_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Classification
    category = Column(String(50), nullable=False)
    # Categories: management_fees, consultancy, rent, dividends, interest, royalties, etc.
    
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Rate
    rate_percentage = Column(Numeric(8, 4), nullable=False)  # e.g., 5.0000 for 5%
    
    # Resident vs Non-resident rates
    resident_rate = Column(Numeric(8, 4), nullable=True)
    non_resident_rate = Column(Numeric(8, 4), nullable=True)
    
    # Threshold (no WHT if below this)
    threshold_amount = Column(Numeric(15, 2), nullable=True)
    
    # GL accounts
    payable_account_id = Column(String(100), nullable=True)
    expense_account_id = Column(String(100), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'category', name='unique_wht_category_per_tenant'),
    )


class TaxSettings(Base):
    """
    Tenant-level tax configuration settings.
    """
    __tablename__ = "tax_settings"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    
    # Company tax details
    tax_id = Column(String(50), nullable=True)  # KRA PIN for Kenya
    vat_registration_number = Column(String(50), nullable=True)
    tax_jurisdiction = Column(String(50), default="KE")  # Country code
    
    # Default tax behavior
    default_item_tax_template_id = Column(UUID(as_uuid=True), ForeignKey("item_tax_templates.id"), nullable=True)
    prices_include_tax = Column(Boolean, default=True)  # Are catalog prices tax-inclusive?
    
    # Rounding
    tax_rounding_method = Column(String(20), default="round")  # round, floor, ceil
    tax_rounding_precision = Column(Integer, default=2)
    
    # Filing reminders
    enable_filing_reminders = Column(Boolean, default=True)
    reminder_days_before = Column(Integer, default=5)
    
    # Integration
    enable_etims = Column(Boolean, default=False)  # KRA eTIMS integration
    etims_device_serial = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaxFilingPeriod(Base):
    """
    Tracks tax filing periods and their status.
    """
    __tablename__ = "tax_filing_periods"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    tax_type_id = Column(UUID(as_uuid=True), ForeignKey("tax_types.id"), nullable=False)
    
    # Period
    fiscal_year = Column(String(10), nullable=False)
    period = Column(String(10), nullable=False)  # "2024-01" for monthly, "2024-Q1" for quarterly
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Due date
    filing_due_date = Column(DateTime, nullable=False)
    payment_due_date = Column(DateTime, nullable=True)
    
    # Calculated amounts
    output_tax = Column(Numeric(15, 2), default=0)  # Tax collected on sales
    input_tax = Column(Numeric(15, 2), default=0)  # Tax paid on purchases
    net_tax = Column(Numeric(15, 2), default=0)  # Output - Input (payable if positive)
    
    # Filing status
    status = Column(String(20), default="open")  # open, closed, filed, paid
    
    # Filing details
    filed_at = Column(DateTime, nullable=True)
    filed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    filing_reference = Column(String(100), nullable=True)  # Reference from tax authority
    
    # Payment details
    paid_at = Column(DateTime, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'tax_type_id', 'period', name='unique_filing_period'),
    )
