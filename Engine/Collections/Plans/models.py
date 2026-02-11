from sqlalchemy import Column, String, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base

class Plan(Base):
    __tablename__ = "plans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String, nullable=False, default="USD")
    
    charges = Column(JSON, nullable=False)  # e.g., {"monthly": 10.00, "yearly": 100.00}
    tax_profile = Column(Json, nullable=False)  # e.g., {"tax_rate": 0.15, "tax_code": "STANDARD"}
