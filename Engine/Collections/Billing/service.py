from uuid import UUID
from datetime import date, datetime
from sqlalchemy.orm import Session

from .models import Invoice, InvoiceLine
from Engine.Collections.Subscriptions.models import Subscription
from Engine.Collections.Plans.models import Plan
from Engine.Collections.Billing.utils import (
    next_billing_period,
    calculate_tax,
    calculate_total
)
from Engine.Collections.Messaging import get_event_producer
from Engine.Collections.Messaging.topics import ACCOUNTING_EVENTS_TOPIC
from Engine.Collections.Accounting.events import InvoiceGeneratedEvent


def generate_invoice(
    db: Session,
    workspace_id: str,
    customer_id: str,
    line_items: list,
    currency: str = "KES",
):
    total = sum(item["amount"] for item in line_items)

    invoice = Invoice(
        workspace_id=workspace_id,
        customer_id=customer_id,
        total_amount=total,
        currency=currency,
        status="draft",
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    producer = get_event_producer()

    event = InvoiceGeneratedEvent(
        occurred_at=datetime.utcnow(),
        workspace_id=workspace_id,
        invoice_id=str(invoice.id),
        customer_id=customer_id,
        total_amount=total,
        currency=currency,
        line_items=line_items,
    )

    producer.publish(
        topic=ACCOUNTING_EVENTS_TOPIC,
        key=str(invoice.id),
        event=event,
    )

    return invoice