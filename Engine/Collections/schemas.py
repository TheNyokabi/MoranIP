from pydantic import BaseModel
from typing import List, Optional

class CollectionsWorkspaceSetup(BaseModel):
    workspace_id: str
    country: str
    currency: str
    fiscal_year_start_month: int = 1
    allow_partial_payments: bool = True
    
class AccountSchema(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    currency: str
    account_metadata: Optional[str] = None
    
    
class TaxRuleSchema(BaseModel):
    tax_code: str
    rate: float
    tax_account_code: str
    effective_from: str
    
class ChargeSchema(BaseModel):
    charge_code: str
    amount: float
    currency: str
    revenue_account_code: str
    
class CollectionPlanSchema(BaseModel):
    plan_code: str
    frequency: str
    due_after_days: int
    charges: List[str]  # List of charge codes