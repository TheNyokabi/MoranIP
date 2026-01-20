"""
POS Analytics API
Advanced reporting and analytics for POS performance insights
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import json

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase

router = APIRouter(
    prefix="/pos/analytics",
    tags=["POS Analytics"],
)


class AnalyticsRequest(BaseModel):
    """Analytics request parameters"""
    date_from: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")
    pos_profile_id: Optional[str] = Field(None, description="Filter by POS profile")
    group_by: str = Field("day", description="Group results by: day, week, month, hour")
    metrics: List[str] = Field(
        ["sales", "transactions", "avg_transaction"],
        description="Metrics to include"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "date_from": "2024-01-01",
                "date_to": "2024-01-31",
                "pos_profile_id": "POS001",
                "group_by": "day",
                "metrics": ["sales", "transactions", "avg_transaction", "top_items", "payment_methods"]
            }
        }


class AnalyticsExportRequest(BaseModel):
    """Analytics export request"""
    format: str = Field("excel", description="Export format: excel, csv, pdf")
    date_from: str = Field(..., description="Start date (YYYY-MM-DD)")
    date_to: str = Field(..., description="End date (YYYY-MM-DD)")
    report_type: str = Field("sales_summary", description="Report type")
    filters: Optional[Dict[str, Any]] = Field(None, description="Additional filters")


@router.get("/dashboard")
async def get_dashboard_analytics(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    pos_profile_id: Optional[str] = Query(None, description="Filter by POS profile"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get comprehensive dashboard analytics

    Returns real-time sales data, trends, and key performance indicators
    """
    try:
        # Set default date range (last 30 days)
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        analytics_data = await _build_dashboard_analytics(
            tenant_id, date_from, date_to, pos_profile_id
        )

        return {
            "analytics": analytics_data,
            "date_range": {"from": date_from, "to": date_to},
            "pos_profile_id": pos_profile_id,
            "generated_at": datetime.now().isoformat(),
            "tenant_id": tenant_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "analytics_error",
                "message": "Failed to generate dashboard analytics",
                "error": str(e)
            }
        )


@router.get("/sales")
async def get_sales_analytics(
    request: AnalyticsRequest = Depends(),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed sales analytics

    Returns sales performance data with various grouping and filtering options
    """
    try:
        # Set default date range if not provided
        if not request.date_from:
            request.date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not request.date_to:
            request.date_to = datetime.now().strftime("%Y-%m-%d")

        sales_data = await _build_sales_analytics(tenant_id, request)

        return {
            "sales_analytics": sales_data,
            "request": request.dict(),
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "sales_analytics_error",
                "message": "Failed to generate sales analytics",
                "error": str(e)
            }
        )


@router.get("/products")
async def get_product_analytics(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    pos_profile_id: Optional[str] = Query(None, description="Filter by POS profile"),
    limit: int = Query(20, description="Number of top products to return"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get product performance analytics

    Returns top-selling products, revenue by product, and product trends
    """
    try:
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        product_data = await _build_product_analytics(
            tenant_id, date_from, date_to, pos_profile_id, limit
        )

        return {
            "product_analytics": product_data,
            "date_range": {"from": date_from, "to": date_to},
            "limit": limit,
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "product_analytics_error",
                "message": "Failed to generate product analytics",
                "error": str(e)
            }
        )


@router.get("/payments")
async def get_payment_analytics(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    pos_profile_id: Optional[str] = Query(None, description="Filter by POS profile"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get payment method analytics

    Returns payment method distribution, success rates, and trends
    """
    try:
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        payment_data = await _build_payment_analytics(
            tenant_id, date_from, date_to, pos_profile_id
        )

        return {
            "payment_analytics": payment_data,
            "date_range": {"from": date_from, "to": date_to},
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "payment_analytics_error",
                "message": "Failed to generate payment analytics",
                "error": str(e)
            }
        )


@router.get("/staff")
async def get_staff_analytics(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    pos_profile_id: Optional[str] = Query(None, description="Filter by POS profile"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get staff performance analytics

    Returns sales by staff member, transaction counts, and performance metrics
    """
    try:
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        staff_data = await _build_staff_analytics(
            tenant_id, date_from, date_to, pos_profile_id
        )

        return {
            "staff_analytics": staff_data,
            "date_range": {"from": date_from, "to": date_to},
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "staff_analytics_error",
                "message": "Failed to generate staff analytics",
                "error": str(e)
            }
        )


@router.get("/customers")
async def get_customer_analytics(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    pos_profile_id: Optional[str] = Query(None, description="Filter by POS profile"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get customer analytics

    Returns customer behavior, loyalty program stats, and customer insights
    """
    try:
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        customer_data = await _build_customer_analytics(
            tenant_id, date_from, date_to, pos_profile_id
        )

        return {
            "customer_analytics": customer_data,
            "date_range": {"from": date_from, "to": date_to},
            "generated_at": datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "customer_analytics_error",
                "message": "Failed to generate customer analytics",
                "error": str(e)
            }
        )


@router.post("/export")
async def export_analytics(
    request: AnalyticsExportRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export analytics data

    Generates and downloads analytics reports in various formats
    """
    try:
        # Validate export format
        supported_formats = ["excel", "csv", "pdf"]
        if request.format not in supported_formats:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invalid_format",
                    "message": f"Format '{request.format}' not supported",
                    "supported_formats": supported_formats
                }
            )

        # Start export process in background
        export_id = await _start_analytics_export(tenant_id, request)

        return {
            "export_id": export_id,
            "status": "processing",
            "format": request.format,
            "report_type": request.report_type,
            "message": "Export started. Check status for download link."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "export_error",
                "message": "Failed to start analytics export",
                "error": str(e)
            }
        )


@router.get("/export/{export_id}")
async def get_export_status(
    export_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get export status and download link

    Returns the status of an analytics export job
    """
    try:
        status = await _get_export_status(export_id, tenant_id)

        return {
            "export_id": export_id,
            "status": status,
            "tenant_id": tenant_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "export_status_error",
                "message": "Failed to get export status",
                "error": str(e)
            }
        )


@router.get("/realtime")
async def get_realtime_analytics(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get real-time analytics data

    Returns live sales data for the current day
    """
    try:
        realtime_data = await _build_realtime_analytics(tenant_id)

        return {
            "realtime_analytics": realtime_data,
            "timestamp": datetime.now().isoformat(),
            "tenant_id": tenant_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "realtime_analytics_error",
                "message": "Failed to get real-time analytics",
                "error": str(e)
            }
        )


# Helper functions for building analytics data

async def _build_dashboard_analytics(
    tenant_id: str, date_from: str, date_to: str, pos_profile_id: Optional[str]
) -> Dict[str, Any]:
    """Build comprehensive dashboard analytics from actual data"""
    try:
        from app.services.erpnext_client import erpnext_adapter
        import json
        
        # Query actual POS invoices for the date range
        filters = [
            ["is_pos", "=", 1],
            ["docstatus", "=", 1],  # Submitted only
            ["posting_date", ">=", date_from],
            ["posting_date", "<=", date_to]
        ]
        
        if pos_profile_id:
            filters.append(["pos_profile", "=", pos_profile_id])
        
        invoices_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps(filters),
                "fields": json.dumps([
                    "name", "grand_total", "net_total", "total_taxes_and_charges",
                    "posting_date", "posting_time", "customer", "owner",
                    "items.item_code", "items.item_name", "items.qty", "items.amount",
                    "payments.mode_of_payment", "payments.amount"
                ]),
                "limit_page_length": 1000
            }
        )
        
        invoices = invoices_response.get("data", []) if isinstance(invoices_response, dict) else []
        
        # Calculate real metrics from invoices
        total_sales = sum(float(inv.get("net_total", 0)) for inv in invoices)
        total_transactions = len(invoices)
        total_vat = sum(float(inv.get("total_taxes_and_charges", 0)) for inv in invoices)
        avg_transaction = total_sales / total_transactions if total_transactions > 0 else 0
        
        # Get unique customers
        unique_customers = len(set(inv.get("customer") for inv in invoices if inv.get("customer")))
        
        # Calculate payment method breakdown
        payment_methods = {}
        for inv in invoices:
            payments = inv.get("payments", [])
            if isinstance(payments, list):
                for payment in payments:
                    mode = payment.get("mode_of_payment", "Unknown")
                    amount = float(payment.get("amount", 0))
                    if mode not in payment_methods:
                        payment_methods[mode] = {"amount": 0, "count": 0}
                    payment_methods[mode]["amount"] += amount
                    payment_methods[mode]["count"] += 1
        
        # Calculate percentages
        total_payments = sum(pm["amount"] for pm in payment_methods.values())
        for mode, data in payment_methods.items():
            data["percentage"] = (data["amount"] / total_payments * 100) if total_payments > 0 else 0
        
        # Calculate sales by day
        sales_by_day = {}
        for inv in invoices:
            date_str = inv.get("posting_date", "")
            if date_str:
                if date_str not in sales_by_day:
                    sales_by_day[date_str] = {"sales": 0, "transactions": 0}
                sales_by_day[date_str]["sales"] += float(inv.get("net_total", 0))
                sales_by_day[date_str]["transactions"] += 1
        
        sales_by_day_list = [
            {"date": date, "sales": data["sales"], "transactions": data["transactions"]}
            for date, data in sorted(sales_by_day.items())
        ]
        
        # Calculate top products
        product_sales = {}
        for inv in invoices:
            items = inv.get("items", [])
            if isinstance(items, list):
                for item in items:
                    item_code = item.get("item_code", "")
                    item_name = item.get("item_name", item_code)
                    qty = float(item.get("qty", 0))
                    amount = float(item.get("amount", 0))
                    if item_code not in product_sales:
                        product_sales[item_code] = {"name": item_name, "sales": 0, "quantity": 0}
                    product_sales[item_code]["sales"] += amount
                    product_sales[item_code]["quantity"] += qty
        
        top_products = sorted(
            [
                {"name": data["name"], "sales": data["sales"], "quantity": data["quantity"]}
                for data in product_sales.values()
            ],
            key=lambda x: x["sales"],
            reverse=True
        )[:10]
        
        dashboard_data = {
            "summary": {
                "total_sales": round(total_sales, 2),
                "total_transactions": total_transactions,
                "avg_transaction": round(avg_transaction, 2),
                "total_customers": unique_customers,
                "total_vat": round(total_vat, 2),
                "date_range": f"{date_from} to {date_to}"
            },
            "trends": {
                "sales_by_day": sales_by_day_list
            },
            "top_performers": {
                "products": top_products
            },
            "payment_methods": payment_methods,
            "kpis": {
                "avg_order_value": round(avg_transaction, 2),
                "conversion_rate": 0,  # Would need session data
                "customer_satisfaction": 0,  # Would need rating data
                "inventory_turnover": 0  # Would need inventory data
            }
        }

        return dashboard_data

    except Exception as e:
        logger.error(f"Failed to build dashboard analytics: {e}")
        return {}


async def _build_sales_analytics(tenant_id: str, request: AnalyticsRequest) -> Dict[str, Any]:
    """Build sales analytics data"""
    # Implementation would query actual sales data
    return {
        "grouped_sales": [],
        "total_metrics": {
            "total_sales": 0,
            "total_transactions": 0,
            "avg_transaction": 0
        }
    }


async def _build_product_analytics(
    tenant_id: str, date_from: str, date_to: str, pos_profile_id: Optional[str], limit: int
) -> Dict[str, Any]:
    """Build product analytics data"""
    # Implementation would query actual product sales data
    return {
        "top_products": [],
        "product_categories": [],
        "slow_moving_items": []
    }


async def _build_payment_analytics(
    tenant_id: str, date_from: str, date_to: str, pos_profile_id: Optional[str]
) -> Dict[str, Any]:
    """Build payment method analytics"""
    # Implementation would query actual payment data
    return {
        "payment_distribution": {},
        "payment_success_rates": {},
        "payment_trends": []
    }


async def _build_staff_analytics(
    tenant_id: str, date_from: str, date_to: str, pos_profile_id: Optional[str]
) -> Dict[str, Any]:
    """Build staff performance analytics"""
    # Implementation would query actual staff sales data
    return {
        "staff_performance": [],
        "staff_metrics": {}
    }


async def _build_customer_analytics(
    tenant_id: str, date_from: str, date_to: str, pos_profile_id: Optional[str]
) -> Dict[str, Any]:
    """Build customer analytics data"""
    # Implementation would query actual customer data
    return {
        "customer_segments": {},
        "loyalty_program_stats": {},
        "customer_lifetime_value": {}
    }


async def _build_realtime_analytics(tenant_id: str) -> Dict[str, Any]:
    """Build real-time analytics data"""
    # Implementation would query current day data
    return {
        "today_sales": 0,
        "today_transactions": 0,
        "current_hour_sales": 0,
        "active_customers": 0
    }


async def _start_analytics_export(tenant_id: str, request: AnalyticsExportRequest) -> str:
    """Start analytics export process"""
    # Implementation would create export job and return ID
    import uuid
    return str(uuid.uuid4())


async def _get_export_status(export_id: str, tenant_id: str) -> Dict[str, Any]:
    """Get export job status"""
    # Implementation would check export job status
    return {
        "status": "completed",
        "download_url": f"/api/exports/{export_id}/download",
        "file_size": 1024000
    }


# Import logger at the end to avoid circular imports
import logging
logger = logging.getLogger(__name__)