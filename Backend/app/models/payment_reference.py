"""
Payment Reference Model for Mobile Money Transactions
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.iam import Base


class PaymentReference(Base):
    """Model for tracking mobile money payment references"""

    __tablename__ = "payment_references"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)

    # Transaction details
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # mpesa, airtel_money, t_kash
    provider_transaction_id = Column(String(100), nullable=True)  # From provider
    checkout_request_id = Column(String(100), nullable=True)  # For M-Pesa STK Push
    merchant_request_id = Column(String(100), nullable=True)  # For M-Pesa

    # Payment details
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="KES")
    phone_number = Column(String(20), nullable=False)
    account_reference = Column(String(100), nullable=True)
    transaction_desc = Column(String(255), nullable=True)

    # Status tracking
    status = Column(String(50), default="pending")  # pending, completed, failed, cancelled
    result_code = Column(String(10), nullable=True)
    result_desc = Column(Text, nullable=True)
    mpesa_receipt_number = Column(String(50), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    invoice_id = Column(String(50), nullable=True, index=True)  # Link to POS invoice
    pos_profile_id = Column(String(50), nullable=True)

    # Callback data storage
    callback_data = Column(Text, nullable=True)  # JSON string of full callback

    # Retry tracking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Additional metadata
    payment_metadata = Column(Text, nullable=True)  # JSON string for extra data

    def __repr__(self):
        return f"<PaymentReference(id={self.id}, transaction_id={self.transaction_id}, status={self.status})>"

    @property
    def is_completed(self) -> bool:
        """Check if payment is completed"""
        return self.status == "completed"

    @property
    def is_failed(self) -> bool:
        """Check if payment has failed"""
        return self.status in ["failed", "cancelled"]

    @property
    def can_retry(self) -> bool:
        """Check if payment can be retried"""
        return not self.is_completed and self.retry_count < self.max_retries

    def update_status(self, new_status: str, result_code: str = None, result_desc: str = None):
        """Update payment status"""
        self.status = new_status
        if result_code:
            self.result_code = result_code
        if result_desc:
            self.result_desc = result_desc

        if new_status == "completed":
            self.completed_at = func.now()

    def increment_retry(self):
        """Increment retry count"""
        self.retry_count += 1

    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "transaction_id": self.transaction_id,
            "provider": self.provider,
            "provider_transaction_id": self.provider_transaction_id,
            "checkout_request_id": self.checkout_request_id,
            "merchant_request_id": self.merchant_request_id,
            "amount": self.amount,
            "currency": self.currency,
            "phone_number": self.phone_number,
            "account_reference": self.account_reference,
            "transaction_desc": self.transaction_desc,
            "status": self.status,
            "result_code": self.result_code,
            "result_desc": self.result_desc,
            "mpesa_receipt_number": self.mpesa_receipt_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "invoice_id": self.invoice_id,
            "pos_profile_id": self.pos_profile_id,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries
        }