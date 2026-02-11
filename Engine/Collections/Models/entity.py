from sqlalchemy import Column, String, Boolean, JSON, DATETIME
from sqlalchemy.sql import func
from app.database import Base

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, index=True, nullable=False)
   
    type = Column(String, nullable=False)  
    # eg customer, device, account, user
    
    external_ref = Column(String, nullable=True)
    # ERP customer ID, Mikrotik username etc
    
    active = Column(Boolean, default=True)
    
    metadata_json = Column(JSON, default=dict)
    
    created_at = Column(DATETIME(timezone=True), server_default=func.now())