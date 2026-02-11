from pydantic import BaseModel
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any


class InvoiceLineOut(BaseModel):
    code: str
    amount: Decimal
    tax: Decimal

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: UUID
    subscription_id: UUID
    entity_id: UUID

    period_start: date
    period_end: date

    currency: str
    snapshot: Dict[str, Any]
    total: Decimal

    lines: List[InvoiceLineOut]

    class Config:
        from_attributes = True


class GenerateInvoiceIn(BaseModel):
    subscription_id: UUID
    billing_date: date
