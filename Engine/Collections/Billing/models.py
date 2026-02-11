from sqlalchemy import (
    Column, String, Date, Numeric, ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    currency = Column(String, nullable=False)
    snapshot = Column(JSON, nullable=False)
    
    total = Column(Numeric(12, 2), nullable=False)
    
    __table_args__ = (
        UniqueConstraint(
            'subscription_id', 
            'period_start', 
            'period_end', 
            name='uq_invoice_subscription_period'),
    )
    
    lines = relationship("InvoiceLine", back_populates="invoice")
    
    

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    code = Column(String, nullable=False)  
    amount = Column(Numeric(12, 2), nullable=False)
    tax = Column(Numeric(12, 2), nullable=False)
    
    invoice = relationship("Invoice", back_populates="lines")