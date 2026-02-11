from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from Engine.Collections.Billing.schemas import (
    InvoiceOut,
    GenerateInvoiceIn
)
from Engine.Collections.Billing.service import generate_invoice
from Engine.Collections.Billing.models import Invoice
from Engine.Collections.Billing.deps import get_db

router = APIRouter(
    prefix="/api/v1/billing",
    tags=["Billing"]
)


@router.post("/invoices/generate", response_model=InvoiceOut)
def generate_invoice_endpoint(
    payload: GenerateInvoiceIn,
    db: Session = Depends(get_db)
):
    try:
        invoice = generate_invoice(
            db=db,
            subscription_id=payload.subscription_id,
            billing_date=payload.billing_date
        )
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/entities/{entity_id}/invoices",
    response_model=List[InvoiceOut]
)
def list_entity_invoices(
    entity_id: UUID,
    db: Session = Depends(get_db)
):
    return (
        db.query(Invoice)
        .filter(Invoice.entity_id == entity_id)
        .order_by(Invoice.period_start.desc())
        .all()
    )


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceOut
)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice
