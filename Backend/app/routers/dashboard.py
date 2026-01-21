"""
Dashboard API
Aggregated metrics and KPIs for tenant dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
import logging

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.erpnext_client import erpnext_adapter

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)

logger = logging.getLogger(__name__)


@router.get("/metrics")
async def get_dashboard_metrics(
    period: str = Query("today", description="Period: today, week, month, quarter, year"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get aggregated dashboard metrics
    
    Returns all key performance indicators in a single call for efficient dashboard rendering
    """
    try:
        # Calculate date range based on period
        today = datetime.now().date()
        
        if period == "today":
            date_from = today.strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        elif period == "week":
            date_from = (today - timedelta(days=7)).strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        elif period == "month":
            date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        elif period == "quarter":
            date_from = (today - timedelta(days=90)).strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        elif period == "year":
            date_from = (today - timedelta(days=365)).strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        else:
            date_from = today.strftime("%Y-%m-%d")
            date_to = today.strftime("%Y-%m-%d")
        
        # Fetch metrics in parallel (simplified - sequential for now)
        sales_metrics = await _get_sales_metrics(tenant_id, date_from, date_to)
        inventory_metrics = await _get_inventory_metrics(tenant_id)
        outstanding_metrics = await _get_outstanding_metrics(tenant_id)
        hr_metrics = await _get_hr_metrics(tenant_id)
        orders_metrics = await _get_orders_metrics(tenant_id, date_from, date_to)
        
        return {
            "metrics": {
                "sales": sales_metrics,
                "inventory": inventory_metrics,
                "outstanding": outstanding_metrics,
                "hr": hr_metrics,
                "orders": orders_metrics
            },
            "period": period,
            "date_range": {"from": date_from, "to": date_to},
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get dashboard metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail={"type": "metrics_error", "message": str(e)}
        )


@router.get("/metrics/{module}")
async def get_module_metrics(
    module: str,
    period: str = Query("month", description="Period: today, week, month, quarter, year"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get metrics for a specific module
    
    Returns detailed metrics for: sales, inventory, finance, hr, pos
    """
    try:
        today = datetime.now().date()
        
        if period == "today":
            date_from = today.strftime("%Y-%m-%d")
        elif period == "week":
            date_from = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        elif period == "month":
            date_from = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        elif period == "quarter":
            date_from = (today - timedelta(days=90)).strftime("%Y-%m-%d")
        else:
            date_from = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        
        date_to = today.strftime("%Y-%m-%d")
        
        module_handlers = {
            "sales": _get_sales_metrics,
            "inventory": lambda t: _get_inventory_metrics(t),
            "finance": lambda t: _get_finance_metrics(t, date_from, date_to),
            "hr": lambda t: _get_hr_metrics(t),
            "pos": lambda t: _get_pos_metrics(t, date_from, date_to)
        }
        
        handler = module_handlers.get(module)
        if not handler:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown module: {module}. Available: {list(module_handlers.keys())}"
            )
        
        if module == "sales":
            metrics = await handler(tenant_id, date_from, date_to)
        else:
            metrics = await handler(tenant_id)
        
        return {
            "module": module,
            "metrics": metrics,
            "period": period,
            "date_range": {"from": date_from, "to": date_to}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get {module} metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-stats")
async def get_quick_stats(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get quick stats for dashboard header
    
    Returns lightweight stats that load quickly
    """
    try:
        today = datetime.now().date().strftime("%Y-%m-%d")
        
        # Get today's sales count (quick query)
        sales_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps([
                    ["docstatus", "=", 1],
                    ["posting_date", "=", today]
                ]),
                "fields": json.dumps(["name", "grand_total"]),
                "limit_page_length": 100
            }
        )
        
        sales = sales_response.get("data", []) if isinstance(sales_response, dict) else []
        today_revenue = sum(float(s.get("grand_total", 0)) for s in sales)
        
        # Get pending orders (quick query)
        orders_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Order",
            method="GET",
            params={
                "filters": json.dumps([["status", "=", "To Deliver and Bill"]]),
                "fields": json.dumps(["name"]),
                "limit_page_length": 0
            }
        )
        
        pending_orders = len(orders_response.get("data", [])) if isinstance(orders_response, dict) else 0
        
        return {
            "today_sales": len(sales),
            "today_revenue": round(today_revenue, 2),
            "pending_orders": pending_orders,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get quick stats: {e}")
        # Return defaults on error
        return {
            "today_sales": 0,
            "today_revenue": 0,
            "pending_orders": 0,
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


@router.get("/alerts")
async def get_dashboard_alerts(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get dashboard alerts and notifications
    
    Returns items requiring attention: low stock, overdue invoices, etc.
    """
    try:
        alerts = []
        
        # Check for low stock items
        stock_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Bin",
            method="GET",
            params={
                "filters": json.dumps([["actual_qty", "<", 10]]),
                "fields": json.dumps(["item_code", "warehouse", "actual_qty"]),
                "limit_page_length": 10
            }
        )
        
        low_stock = stock_response.get("data", []) if isinstance(stock_response, dict) else []
        if low_stock:
            alerts.append({
                "type": "warning",
                "category": "inventory",
                "title": "Low Stock Items",
                "message": f"{len(low_stock)} items are running low on stock",
                "count": len(low_stock),
                "action_url": "/inventory/stock-alerts"
            })
        
        # Check for overdue invoices
        today = datetime.now().date().strftime("%Y-%m-%d")
        overdue_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps([
                    ["docstatus", "=", 1],
                    ["status", "=", "Overdue"],
                    ["due_date", "<", today]
                ]),
                "fields": json.dumps(["name", "customer", "grand_total"]),
                "limit_page_length": 10
            }
        )
        
        overdue = overdue_response.get("data", []) if isinstance(overdue_response, dict) else []
        if overdue:
            total_overdue = sum(float(inv.get("grand_total", 0)) for inv in overdue)
            alerts.append({
                "type": "error",
                "category": "finance",
                "title": "Overdue Invoices",
                "message": f"{len(overdue)} invoices are overdue (Total: {round(total_overdue, 2)})",
                "count": len(overdue),
                "amount": round(total_overdue, 2),
                "action_url": "/invoices?status=overdue"
            })
        
        return {
            "alerts": alerts,
            "total_alerts": len(alerts),
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get dashboard alerts: {e}")
        return {"alerts": [], "total_alerts": 0, "error": str(e)}


# Helper functions for metrics

async def _get_sales_metrics(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Get sales metrics"""
    try:
        filters = [
            ["docstatus", "=", 1],
            ["posting_date", ">=", date_from],
            ["posting_date", "<=", date_to]
        ]
        
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps(filters),
                "fields": json.dumps(["name", "grand_total", "net_total"]),
                "limit_page_length": 1000
            }
        )
        
        invoices = response.get("data", []) if isinstance(response, dict) else []
        total_revenue = sum(float(inv.get("grand_total", 0)) for inv in invoices)
        
        return {
            "total_invoices": len(invoices),
            "total_revenue": round(total_revenue, 2),
            "avg_invoice_value": round(total_revenue / len(invoices), 2) if invoices else 0
        }
        
    except Exception as e:
        logger.error(f"Sales metrics error: {e}")
        return {"total_invoices": 0, "total_revenue": 0, "avg_invoice_value": 0}


async def _get_inventory_metrics(tenant_id: str) -> Dict[str, Any]:
    """Get inventory metrics"""
    try:
        # Get items count
        items_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Item",
            method="GET",
            params={
                "filters": json.dumps([["is_stock_item", "=", 1]]),
                "fields": json.dumps(["name"]),
                "limit_page_length": 0
            }
        )
        
        items = items_response.get("data", []) if isinstance(items_response, dict) else []
        
        # Get low stock count
        low_stock_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Bin",
            method="GET",
            params={
                "filters": json.dumps([["actual_qty", "<", 10]]),
                "fields": json.dumps(["name"]),
                "limit_page_length": 0
            }
        )
        
        low_stock = low_stock_response.get("data", []) if isinstance(low_stock_response, dict) else []
        
        return {
            "total_items": len(items),
            "low_stock_items": len(low_stock),
            "out_of_stock": 0  # Would need separate query
        }
        
    except Exception as e:
        logger.error(f"Inventory metrics error: {e}")
        return {"total_items": 0, "low_stock_items": 0, "out_of_stock": 0}


async def _get_outstanding_metrics(tenant_id: str) -> Dict[str, Any]:
    """Get outstanding payment metrics"""
    try:
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps([
                    ["docstatus", "=", 1],
                    ["status", "in", ["Unpaid", "Overdue", "Partly Paid"]]
                ]),
                "fields": json.dumps(["name", "grand_total", "outstanding_amount", "status"]),
                "limit_page_length": 500
            }
        )
        
        invoices = response.get("data", []) if isinstance(response, dict) else []
        outstanding = sum(float(inv.get("outstanding_amount", 0)) for inv in invoices)
        overdue = [inv for inv in invoices if inv.get("status") == "Overdue"]
        
        return {
            "unpaid_invoices": len(invoices),
            "total_outstanding": round(outstanding, 2),
            "overdue_count": len(overdue)
        }
        
    except Exception as e:
        logger.error(f"Outstanding metrics error: {e}")
        return {"unpaid_invoices": 0, "total_outstanding": 0, "overdue_count": 0}


async def _get_hr_metrics(tenant_id: str) -> Dict[str, Any]:
    """Get HR metrics"""
    try:
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Employee",
            method="GET",
            params={
                "filters": json.dumps([["status", "=", "Active"]]),
                "fields": json.dumps(["name", "department"]),
                "limit_page_length": 500
            }
        )
        
        employees = response.get("data", []) if isinstance(response, dict) else []
        
        return {
            "total_employees": len(employees),
            "present_today": 0,  # Would need attendance check
            "on_leave": 0
        }
        
    except Exception as e:
        logger.error(f"HR metrics error: {e}")
        return {"total_employees": 0, "present_today": 0, "on_leave": 0}


async def _get_orders_metrics(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Get orders metrics"""
    try:
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Order",
            method="GET",
            params={
                "filters": json.dumps([
                    ["transaction_date", ">=", date_from],
                    ["transaction_date", "<=", date_to]
                ]),
                "fields": json.dumps(["name", "status", "grand_total"]),
                "limit_page_length": 500
            }
        )
        
        orders = response.get("data", []) if isinstance(response, dict) else []
        pending = [o for o in orders if o.get("status") in ["Draft", "To Deliver and Bill"]]
        
        return {
            "total_orders": len(orders),
            "pending_orders": len(pending),
            "completed_orders": len(orders) - len(pending)
        }
        
    except Exception as e:
        logger.error(f"Orders metrics error: {e}")
        return {"total_orders": 0, "pending_orders": 0, "completed_orders": 0}


async def _get_finance_metrics(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Get finance metrics"""
    try:
        # Get account balance summary (simplified)
        gl_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/GL Entry",
            method="GET",
            params={
                "filters": json.dumps([
                    ["posting_date", ">=", date_from],
                    ["posting_date", "<=", date_to]
                ]),
                "fields": json.dumps(["debit", "credit"]),
                "limit_page_length": 1000
            }
        )
        
        entries = gl_response.get("data", []) if isinstance(gl_response, dict) else []
        total_debit = sum(float(e.get("debit", 0)) for e in entries)
        total_credit = sum(float(e.get("credit", 0)) for e in entries)
        
        return {
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "net_movement": round(total_debit - total_credit, 2),
            "gl_entries": len(entries)
        }
        
    except Exception as e:
        logger.error(f"Finance metrics error: {e}")
        return {"total_debit": 0, "total_credit": 0, "net_movement": 0, "gl_entries": 0}


async def _get_pos_metrics(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Get POS-specific metrics"""
    try:
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps([
                    ["is_pos", "=", 1],
                    ["docstatus", "=", 1],
                    ["posting_date", ">=", date_from],
                    ["posting_date", "<=", date_to]
                ]),
                "fields": json.dumps(["name", "grand_total"]),
                "limit_page_length": 1000
            }
        )
        
        invoices = response.get("data", []) if isinstance(response, dict) else []
        total = sum(float(inv.get("grand_total", 0)) for inv in invoices)
        
        return {
            "pos_transactions": len(invoices),
            "pos_revenue": round(total, 2),
            "avg_transaction": round(total / len(invoices), 2) if invoices else 0
        }
        
    except Exception as e:
        logger.error(f"POS metrics error: {e}")
        return {"pos_transactions": 0, "pos_revenue": 0, "avg_transaction": 0}
