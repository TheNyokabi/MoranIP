from sqlalchemy import Column, String, Boolean, Integer, Float, ForeignKey
from app.database import Base

class WorkspaceCollections(Base):
    __tablename__ = "workspace_collections"

    id = Column(Integer, primary_key=True)
    workspace_id = Column(String, unique=True, index=True)
    enabled = Column(Boolean, default=True)

    country = Column(String)
    currency = Column(String)
    fiscal_year_start_month = Column(Integer)
    allow_partial_payments = Column(Boolean, default=True)
    
   
class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    account_code = Column(String, unique=True, index=True)
    account_name = Column(String)
    account_type = Column(String)
    currency = Column(String)
    account_metadata = Column(String)  # JSON string for additional metadata
    
    
class TaxRule(Base):
    __tablename__ = "tax_rules"

    id = Column(Integer, primary_key=True)
    tax_code = Column(String, unique=True, index=True)
    rate = Column(Float)
    tax_account_code = Column(String, ForeignKey("accounts.account_code"))
    effective_from = Column(String)
    
    
class Charge(Base):
    __tablename__ = "charges"

    id = Column(Integer, primary_key=True)
    charge_code = Column(String, unique=True, index=True)
    amount = Column(Float)
    currency = Column(String)  
    revenue_account_code = Column(String, ForeignKey("accounts.account_code"))
    

class  CollectionPlan(Base):
    __tablename__ = "collection_plans"

    id = Column(Integer, primary_key=True)
    plan_code = Column(String, unique=True, index=True)
    frequency = Column(String)
    due_after_days = Column(Integer)