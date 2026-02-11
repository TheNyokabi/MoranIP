from sqlalchemy import Column, String, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(String, primary_key=True)
    workspace_id = Column(String, index=True, nullable=False)
    
    entity_id = Column(String, ForeignKey("entities.id"), nullable=False)
    plan_code = Column(String, nullable=False)
    
    status = Column(String, default="active")
    # active | Suspended | Cancelled
    
    start_date = Column(Date, nullable=False)
    next_invoice_date = Column(Date, nullable=False)
    
    auto_suspend = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())