"""
Cash Management Models

Tracks cash movement in POS including:
- Opening and closing balances
- Cash transactions during shifts
- Discrepancy detection and logging
- Employee accountability

Author: MoranERP Team
"""

from sqlalchemy import (
    Column, String, Text, Numeric, Boolean, Integer,
    DateTime, ForeignKey, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from ..database import Base


def generate_uuid():
    return uuid.uuid4()


class CashSessionStatus(enum.Enum):
    OPEN = "open"
    CLOSING = "closing"  # User initiated close, pending manager approval
    CLOSED = "closed"
    RECONCILED = "reconciled"  # Discrepancy resolved


class DiscrepancyStatus(enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    WAIVED = "waived"  # Management decided to waive
    PAYROLL_DEDUCTION = "payroll_deduction"


class CashSession(Base):
    """
    Represents a cash drawer session for a POS terminal.
    
    Each cashier opens a session at the start of their shift,
    records transactions, and closes at the end with a reconciliation.
    """
    __tablename__ = "cash_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Session identification
    session_number = Column(String(50), nullable=False)  # Auto-generated
    pos_profile_id = Column(String(100), nullable=True)  # ERPNext POS Profile
    pos_terminal_id = Column(String(100), nullable=True)
    warehouse_id = Column(String(100), nullable=True)
    
    # User (cashier)
    cashier_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    cashier_name = Column(String(200), nullable=True)
    
    # Status
    status = Column(String(20), default="open")  # open, closing, closed, reconciled
    
    # === OPENING ===
    opened_at = Column(DateTime, default=datetime.utcnow)
    opening_balance = Column(Numeric(15, 2), nullable=False, default=0)
    opening_notes = Column(Text, nullable=True)
    opening_verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # === DURING SESSION ===
    # Calculated fields updated after each transaction
    total_cash_sales = Column(Numeric(15, 2), default=0)
    total_card_sales = Column(Numeric(15, 2), default=0)
    total_mpesa_sales = Column(Numeric(15, 2), default=0)
    total_credit_sales = Column(Numeric(15, 2), default=0)
    total_refunds = Column(Numeric(15, 2), default=0)
    total_payouts = Column(Numeric(15, 2), default=0)  # Cash paid out (not sales)
    total_payins = Column(Numeric(15, 2), default=0)  # Cash added (float, etc.)
    
    invoice_count = Column(Integer, default=0)
    
    # === CLOSING ===
    closed_at = Column(DateTime, nullable=True)
    closing_balance = Column(Numeric(15, 2), nullable=True)  # Physical count
    expected_cash = Column(Numeric(15, 2), nullable=True)  # Calculated expected
    closing_notes = Column(Text, nullable=True)
    closing_verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # === DISCREPANCY ===
    has_discrepancy = Column(Boolean, default=False)
    discrepancy_amount = Column(Numeric(15, 2), nullable=True)
    discrepancy_type = Column(String(20), nullable=True)  # "short" or "over"
    
    # === RECONCILIATION ===
    reconciled_at = Column(DateTime, nullable=True)
    reconciled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reconciliation_notes = Column(Text, nullable=True)
    
    # Breakdown of denominations (optional)
    opening_denominations = Column(JSONB, nullable=True)
    closing_denominations = Column(JSONB, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    transactions = relationship("CashTransaction", back_populates="session", cascade="all, delete-orphan")
    discrepancies = relationship("CashDiscrepancy", back_populates="session", cascade="all, delete-orphan")


class CashTransaction(Base):
    """
    Individual cash movement within a session.
    
    Every cash-related activity is logged here for complete audit trail.
    """
    __tablename__ = "cash_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    
    # Transaction identification
    transaction_number = Column(String(50), nullable=False)
    
    # Type of transaction
    transaction_type = Column(String(30), nullable=False)
    # Types: sale_cash, sale_card, sale_mpesa, sale_credit, refund_cash, refund_card,
    #        payin, payout, float_add, float_remove, adjustment
    
    # Amount
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="KES")
    
    # Direction
    direction = Column(String(10), nullable=False)  # "in" or "out"
    
    # Running balance after this transaction
    running_balance = Column(Numeric(15, 2), nullable=True)
    
    # Reference to source document
    reference_type = Column(String(50), nullable=True)  # "POS Invoice", "Payment Entry", etc.
    reference_id = Column(String(100), nullable=True)
    
    # Customer (if applicable)
    customer_id = Column(String(100), nullable=True)
    customer_name = Column(String(200), nullable=True)
    
    # User who performed the transaction
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("CashSession", back_populates="transactions")


class CashDiscrepancy(Base):
    """
    Records and tracks cash discrepancies for accountability.
    
    When closing balance doesn't match expected, a discrepancy is created.
    The system tracks resolution including potential payroll deductions.
    """
    __tablename__ = "cash_discrepancies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("cash_sessions.id"), nullable=False)
    
    # Discrepancy identification
    discrepancy_number = Column(String(50), nullable=False)
    
    # Type and amount
    discrepancy_type = Column(String(20), nullable=False)  # "short" or "over"
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="KES")
    
    # Expected vs Actual
    expected_amount = Column(Numeric(15, 2), nullable=False)
    actual_amount = Column(Numeric(15, 2), nullable=False)
    
    # Responsible employee
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    employee_name = Column(String(200), nullable=True)
    
    # Status tracking
    status = Column(String(30), default="pending")  # From DiscrepancyStatus enum
    
    # Investigation
    investigated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    investigation_date = Column(DateTime, nullable=True)
    investigation_notes = Column(Text, nullable=True)
    
    # Employee acknowledgment
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledgment_notes = Column(Text, nullable=True)
    employee_explanation = Column(Text, nullable=True)
    
    # Resolution
    resolution_type = Column(String(30), nullable=True)
    # Types: repayment, payroll_deduction, waived, error_found, fraud_confirmed
    
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    # If payroll deduction
    deduction_amount = Column(Numeric(15, 2), nullable=True)
    deduction_scheduled_date = Column(DateTime, nullable=True)
    deduction_completed = Column(Boolean, default=False)
    payroll_reference = Column(String(100), nullable=True)
    
    # Disciplinary action
    disciplinary_action = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    session = relationship("CashSession", back_populates="discrepancies")


class CashDenomination(Base):
    """
    Standard cash denominations for the currency.
    Used for detailed cash counting during opening/closing.
    """
    __tablename__ = "cash_denominations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    currency = Column(String(3), default="KES")
    denomination_type = Column(String(10), nullable=False)  # "note" or "coin"
    value = Column(Numeric(10, 2), nullable=False)
    name = Column(String(50), nullable=False)  # e.g., "1000 Shilling Note"
    
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class CashSettings(Base):
    """
    Tenant-level cash management settings.
    """
    __tablename__ = "cash_settings"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    
    # Session requirements
    require_opening_verification = Column(Boolean, default=True)
    require_closing_verification = Column(Boolean, default=True)
    require_denomination_count = Column(Boolean, default=False)
    
    # Float settings
    default_float_amount = Column(Numeric(15, 2), default=5000)  # Default opening balance
    minimum_float_amount = Column(Numeric(15, 2), default=1000)
    maximum_float_amount = Column(Numeric(15, 2), default=50000)
    
    # Discrepancy thresholds
    auto_flag_discrepancy_above = Column(Numeric(15, 2), default=100)  # Auto-flag if above this
    require_explanation_above = Column(Numeric(15, 2), default=50)  # Require explanation
    tolerance_amount = Column(Numeric(15, 2), default=10)  # Ignore small discrepancies
    
    # Accountability
    enable_auto_payroll_deduction = Column(Boolean, default=False)
    max_auto_deduction_amount = Column(Numeric(15, 2), default=1000)
    deduction_requires_acknowledgment = Column(Boolean, default=True)
    
    # Notifications
    notify_manager_on_discrepancy = Column(Boolean, default=True)
    manager_notification_threshold = Column(Numeric(15, 2), default=500)
    
    # Session rules
    allow_multiple_open_sessions = Column(Boolean, default=False)
    auto_close_after_hours = Column(Integer, nullable=True)  # Auto-close session after X hours
    
    # Currency
    default_currency = Column(String(3), default="KES")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
