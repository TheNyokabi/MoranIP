"""
Commissions API
Sales commission tracking, calculation, and payout management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from decimal import Decimal
import json
import logging

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.erpnext_client import erpnext_adapter

router = APIRouter(
    prefix="/commissions",
    tags=["Commissions"],
)

logger = logging.getLogger(__name__)


class CommissionRate(BaseModel):
    """Commission rate configuration"""
    role: str = Field(..., description="Sales role (e.g., 'Sales Person', 'Fundi', 'Wholesaler')")
    rate_percent: float = Field(..., ge=0, le=100, description="Commission rate percentage")
    min_sale: Optional[float] = Field(None, description="Minimum sale amount to qualify")


class CommissionCalculateRequest(BaseModel):
    """Request to calculate commissions for a period"""
    date_from: str = Field(..., description="Start date (YYYY-MM-DD)")
    date_to: str = Field(..., description="End date (YYYY-MM-DD)")
    sales_person: Optional[str] = Field(None, description="Filter by specific sales person")
    recalculate: bool = Field(False, description="Recalculate even if already calculated")


class CommissionPayoutRequest(BaseModel):
    """Request to mark commission as paid"""
    payment_date: str = Field(..., description="Payment date")
    payment_reference: Optional[str] = Field(None, description="Payment reference number")
    notes: Optional[str] = None


@router.get("")
async def list_commissions(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    sales_person: Optional[str] = Query(None, description="Filter by sales person"),
    status: Optional[str] = Query(None, description="Filter by status: pending, paid, cancelled"),
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    List all commission records
    
    Returns commission transactions with filtering options
    """
    try:
        # Set default date range
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")
        
        # Fetch sales invoices with sales team info
        filters = [
            ["docstatus", "=", 1],
            ["posting_date", ">=", date_from],
            ["posting_date", "<=", date_to]
        ]
        
        invoices_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps(filters),
                "fields": json.dumps([
                    "name", "customer", "grand_total", "net_total",
                    "posting_date", "sales_team", "owner"
                ]),
                "limit_page_length": limit
            }
        )
        
        invoices = invoices_response.get("data", []) if isinstance(invoices_response, dict) else []
        
        # Build commission records from invoices
        commissions = []
        for inv in invoices:
            sales_team = inv.get("sales_team", [])
            if isinstance(sales_team, list):
                for member in sales_team:
                    person = member.get("sales_person", "")
                    if sales_person and person != sales_person:
                        continue
                    
                    allocated_percentage = float(member.get("allocated_percentage", 0))
                    commission_rate = float(member.get("commission_rate", 0))
                    invoice_total = float(inv.get("net_total", 0))
                    
                    allocated_amount = invoice_total * (allocated_percentage / 100)
                    commission_amount = allocated_amount * (commission_rate / 100)
                    
                    commissions.append({
                        "id": f"{inv.get('name')}-{person}",
                        "invoice": inv.get("name"),
                        "sales_person": person,
                        "customer": inv.get("customer"),
                        "invoice_date": inv.get("posting_date"),
                        "invoice_total": round(invoice_total, 2),
                        "allocated_amount": round(allocated_amount, 2),
                        "commission_rate": commission_rate,
                        "commission_amount": round(commission_amount, 2),
                        "status": "pending"
                    })
        
        # Calculate summary
        total_commission = sum(c["commission_amount"] for c in commissions)
        
        return {
            "commissions": commissions,
            "summary": {
                "total_records": len(commissions),
                "total_commission": round(total_commission, 2),
                "date_range": {"from": date_from, "to": date_to}
            },
            "filters": {
                "sales_person": sales_person,
                "status": status
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to list commissions: {e}")
        raise HTTPException(
            status_code=500,
            detail={"type": "commissions_error", "message": str(e)}
        )


@router.get("/summary")
async def get_commission_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    group_by: str = Query("sales_person", description="Group by: sales_person, month, customer"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get commission summary with grouping
    
    Returns aggregated commission data by sales person, month, or customer
    """
    try:
        if not date_from:
            date_from = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")
        
        # Get full commission data
        result = await list_commissions(
            date_from=date_from,
            date_to=date_to,
            sales_person=None,
            status=None,
            limit=200,
            tenant_id=tenant_id,
            current_user=current_user,
            db=None
        )
        
        commissions = result.get("commissions", [])
        
        # Group by specified field
        grouped = {}
        for c in commissions:
            if group_by == "sales_person":
                key = c.get("sales_person", "Unknown")
            elif group_by == "month":
                date_str = c.get("invoice_date", "")
                key = date_str[:7] if date_str else "Unknown"
            elif group_by == "customer":
                key = c.get("customer", "Unknown")
            else:
                key = "all"
            
            if key not in grouped:
                grouped[key] = {"count": 0, "total_sales": 0, "total_commission": 0}
            
            grouped[key]["count"] += 1
            grouped[key]["total_sales"] += c.get("invoice_total", 0)
            grouped[key]["total_commission"] += c.get("commission_amount", 0)
        
        # Format response
        summary_list = [
            {
                group_by: k,
                "invoices": v["count"],
                "total_sales": round(v["total_sales"], 2),
                "total_commission": round(v["total_commission"], 2)
            }
            for k, v in sorted(grouped.items(), key=lambda x: x[1]["total_commission"], reverse=True)
        ]
        
        return {
            "summary": summary_list,
            "totals": {
                "total_invoices": sum(g["count"] for g in grouped.values()),
                "total_sales": round(sum(g["total_sales"] for g in grouped.values()), 2),
                "total_commission": round(sum(g["total_commission"] for g in grouped.values()), 2)
            },
            "grouped_by": group_by,
            "date_range": {"from": date_from, "to": date_to}
        }
        
    except Exception as e:
        logger.error(f"Failed to get commission summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{commission_id}")
async def get_commission(
    commission_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get details of a specific commission record
    """
    try:
        # Parse commission ID (format: invoice-salesperson)
        parts = commission_id.rsplit("-", 1)
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid commission ID format")
        
        invoice_name, sales_person = parts
        
        # Get invoice details
        invoice = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Sales Invoice/{invoice_name}",
            method="GET"
        )
        
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        # Find the sales team member
        sales_team = invoice.get("sales_team", [])
        team_member = None
        for member in sales_team:
            if member.get("sales_person") == sales_person:
                team_member = member
                break
        
        if not team_member:
            raise HTTPException(status_code=404, detail="Sales person not found on invoice")
        
        # Calculate commission
        net_total = float(invoice.get("net_total", 0))
        allocated_pct = float(team_member.get("allocated_percentage", 0))
        commission_rate = float(team_member.get("commission_rate", 0))
        
        allocated_amount = net_total * (allocated_pct / 100)
        commission_amount = allocated_amount * (commission_rate / 100)
        
        return {
            "id": commission_id,
            "invoice": {
                "name": invoice.get("name"),
                "customer": invoice.get("customer"),
                "posting_date": invoice.get("posting_date"),
                "grand_total": invoice.get("grand_total"),
                "net_total": invoice.get("net_total")
            },
            "sales_person": sales_person,
            "allocated_percentage": allocated_pct,
            "allocated_amount": round(allocated_amount, 2),
            "commission_rate": commission_rate,
            "commission_amount": round(commission_amount, 2),
            "status": "pending"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get commission {commission_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calculate")
async def calculate_commissions(
    request: CommissionCalculateRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Calculate commissions for a date range
    
    Processes all eligible invoices and calculates commission amounts
    """
    try:
        # Get all commissions for the period
        result = await list_commissions(
            date_from=request.date_from,
            date_to=request.date_to,
            sales_person=request.sales_person,
            status=None,
            limit=200,
            tenant_id=tenant_id,
            current_user=current_user,
            db=None
        )
        
        commissions = result.get("commissions", [])
        
        return {
            "calculated": len(commissions),
            "total_commission": result.get("summary", {}).get("total_commission", 0),
            "date_range": {"from": request.date_from, "to": request.date_to},
            "sales_person": request.sales_person,
            "commissions": commissions[:20]  # Return first 20 for preview
        }
        
    except Exception as e:
        logger.error(f"Failed to calculate commissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{commission_id}/payout")
async def mark_commission_paid(
    commission_id: str,
    request: CommissionPayoutRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mark a commission as paid
    
    Records payout information for a commission record
    """
    try:
        # Verify commission exists
        commission = await get_commission(commission_id, tenant_id, current_user)
        
        # In a full implementation, this would update a database record
        # For now, we return a mock success response
        return {
            "id": commission_id,
            "status": "paid",
            "payment_date": request.payment_date,
            "payment_reference": request.payment_reference,
            "commission_amount": commission.get("commission_amount"),
            "notes": request.notes,
            "paid_by": current_user.get("email", "unknown")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark commission as paid: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rates/config")
async def get_commission_rates(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get commission rate configuration
    
    Returns the configured commission rates for different sales roles
    """
    # Default rates - in production, these would come from tenant settings
    default_rates = [
        {"role": "Sales Person", "rate_percent": 5.0, "min_sale": 0},
        {"role": "Fundi", "rate_percent": 3.0, "min_sale": 5000},
        {"role": "Wholesaler", "rate_percent": 2.0, "min_sale": 50000},
        {"role": "Territory Manager", "rate_percent": 1.0, "min_sale": 0}
    ]
    
    return {
        "rates": default_rates,
        "tenant_id": tenant_id,
        "last_updated": datetime.now().isoformat()
    }
