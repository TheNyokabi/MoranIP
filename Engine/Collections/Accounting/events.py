from datetime import datetime
from pydantic import BaseModel
from typing import List


class BaseAccountingEvent(BaseModel):
    event_type: str
    occurred_at: datetime
    workspace_id: str


class InvoiceGeneratedEvent(BaseAccountingEvent):
    event_type: str = "invoice.generated"
    invoice_id: str
    customer_id: str
    total_amount: float
    currency: str
    line_items: List[dict]


class InvoicePostedEvent(BaseAccountingEvent):
    event_type: str = "invoice.posted"
    invoice_id: str
    posting_date: datetime


class SubscriptionBilledEvent(BaseAccountingEvent):
    event_type: str = "subscription.billed"
    subscription_id: str
    invoice_id: str
    amount: float
