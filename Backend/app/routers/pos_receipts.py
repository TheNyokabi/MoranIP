"""
Receipt Generation API for PoS
Handles receipt generation, printing, and delivery
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.receipt_service import ReceiptService
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase

router = APIRouter(
    prefix="/pos/receipts",
    tags=["POS Receipts"],
)


@router.get("/{invoice_id}")
async def get_receipt(
    invoice_id: str,
    format: str = Query("html", description="Receipt format: html, thermal, pdf"),
    language: str = Query("en", description="Language: en, sw"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Generate receipt for an invoice

    Returns receipt in specified format (HTML, thermal printer, PDF)
    """
    try:
        receipt_service = ReceiptService()

        # Get invoice data from ERPNext
        invoice_data = await pos_service._request(
            method="GET",
            endpoint=f"/api/resource/Sales Invoice/{invoice_id}"
        )

        if not invoice_data or not invoice_data.get("data"):
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "invoice_not_found",
                    "message": f"Invoice {invoice_id} not found",
                    "invoice_id": invoice_id
                }
            )

        invoice = invoice_data["data"]

        # Generate receipt based on format
        if format == "thermal":
            receipt_content = receipt_service.generate_thermal_receipt(
                invoice_data=invoice,
                language=language
            )
            content_type = "text/plain"
        elif format == "pdf":
            receipt_content = receipt_service.generate_pdf_receipt(
                invoice_data=invoice,
                language=language
            )
            content_type = "application/pdf"
        else:  # html
            receipt_content = receipt_service.generate_html_receipt(
                invoice_data=invoice,
                language=language
            )
            content_type = "text/html"

        return {
            "invoice_id": invoice_id,
            "format": format,
            "language": language,
            "content": receipt_content,
            "content_type": content_type
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "receipt_generation_error",
                "message": "Failed to generate receipt",
                "error": str(e)
            }
        )


@router.post("/{invoice_id}/email")
async def email_receipt(
    invoice_id: str,
    email: str,
    language: str = Query("en", description="Language: en, sw"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Send receipt via email

    Generates HTML receipt and sends it to the specified email address
    """
    try:
        receipt_service = ReceiptService()

        # Get invoice data
        invoice_data = await pos_service._request(
            method="GET",
            endpoint=f"/api/resource/Sales Invoice/{invoice_id}"
        )

        if not invoice_data or not invoice_data.get("data"):
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "invoice_not_found",
                    "message": f"Invoice {invoice_id} not found",
                    "invoice_id": invoice_id
                }
            )

        invoice = invoice_data["data"]

        # Generate HTML receipt
        receipt_html = receipt_service.generate_html_receipt(
            invoice_data=invoice,
            language=language
        )

        # Send email
        result = receipt_service.send_receipt_email(
            invoice_id=invoice_id,
            email=email,
            receipt_html=receipt_html,
            language=language
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "email_error",
                "message": "Failed to send receipt email",
                "error": str(e)
            }
        )


@router.post("/{invoice_id}/sms")
async def sms_receipt(
    invoice_id: str,
    phone_number: str,
    language: str = Query("en", description="Language: en, sw"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Send receipt via SMS (Kenya-specific)

    Generates thermal text receipt and sends it via SMS
    """
    try:
        receipt_service = ReceiptService()

        # Get invoice data
        invoice_data = await pos_service._request(
            method="GET",
            path=f"resource/Sales Invoice/{invoice_id}"
        )

        if not invoice_data or not invoice_data.get("data"):
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "invoice_not_found",
                    "message": f"Invoice {invoice_id} not found",
                    "invoice_id": invoice_id
                }
            )

        invoice = invoice_data["data"]

        # Generate thermal receipt (text format for SMS)
        receipt_text = receipt_service.generate_thermal_receipt(
            invoice_data=invoice,
            width=48,  # SMS-friendly width
            language=language
        )

        # Send SMS
        result = receipt_service.send_receipt_sms(
            invoice_id=invoice_id,
            phone_number=phone_number,
            receipt_text=receipt_text,
            language=language
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "sms_error",
                "message": "Failed to send receipt SMS",
                "error": str(e)
            }
        )


@router.get("/{invoice_id}/thermal")
async def get_thermal_receipt(
    invoice_id: str,
    width: int = Query(80, description="Printer width: 32, 48, 80"),
    language: str = Query("en", description="Language: en, sw"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get thermal printer receipt

    Returns plain text formatted for thermal printers (58mm, 80mm width)
    """
    try:
        receipt_service = ReceiptService()

        # Get invoice data
        invoice_data = await pos_service._request(
            method="GET",
            path=f"resource/Sales Invoice/{invoice_id}"
        )

        if not invoice_data or not invoice_data.get("data"):
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "invoice_not_found",
                    "message": f"Invoice {invoice_id} not found",
                    "invoice_id": invoice_id
                }
            )

        invoice = invoice_data["data"]

        # Generate thermal receipt
        receipt_content = receipt_service.generate_thermal_receipt(
            invoice_data=invoice,
            width=width,
            language=language
        )

        return {
            "invoice_id": invoice_id,
            "format": "thermal",
            "width": width,
            "language": language,
            "content": receipt_content,
            "content_type": "text/plain",
            "printer_type": f"{width}mm thermal printer"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "thermal_receipt_error",
                "message": "Failed to generate thermal receipt",
                "error": str(e)
            }
        )


@router.post("/bulk-print")
async def bulk_print_receipts(
    invoice_ids: list[str],
    format: str = Query("thermal", description="Receipt format: thermal, html"),
    width: int = Query(80, description="Printer width for thermal format"),
    language: str = Query("en", description="Language: en, sw"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Generate receipts for multiple invoices

    Useful for end-of-day batch printing
    """
    try:
        if not invoice_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "validation_error",
                    "message": "No invoice IDs provided"
                }
            )

        if len(invoice_ids) > 50:  # Limit batch size
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "validation_error",
                    "message": "Maximum 50 invoices allowed in batch",
                    "provided_count": len(invoice_ids)
                }
            )

        receipt_service = ReceiptService()
        receipts = []

        for invoice_id in invoice_ids:
            try:
                # Get invoice data
                invoice_data = await pos_service._request(
                    method="GET",
                    path=f"resource/Sales Invoice/{invoice_id}"
                )

                if invoice_data and invoice_data.get("data"):
                    invoice = invoice_data["data"]

                    if format == "thermal":
                        content = receipt_service.generate_thermal_receipt(
                            invoice_data=invoice,
                            width=width,
                            language=language
                        )
                    else:  # html
                        content = receipt_service.generate_html_receipt(
                            invoice_data=invoice,
                            language=language
                        )

                    receipts.append({
                        "invoice_id": invoice_id,
                        "content": content,
                        "success": True
                    })
                else:
                    receipts.append({
                        "invoice_id": invoice_id,
                        "success": False,
                        "error": "Invoice not found"
                    })

            except Exception as e:
                receipts.append({
                    "invoice_id": invoice_id,
                    "success": False,
                    "error": str(e)
                })

        successful_count = sum(1 for r in receipts if r["success"])
        failed_count = len(receipts) - successful_count

        return {
            "format": format,
            "language": language,
            "total_requested": len(invoice_ids),
            "successful": successful_count,
            "failed": failed_count,
            "receipts": receipts
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "bulk_print_error",
                "message": "Failed to generate bulk receipts",
                "error": str(e)
            }
        )