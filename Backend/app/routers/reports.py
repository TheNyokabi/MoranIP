"""
Reports API
Cross-module reporting for business intelligence and analytics
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import json
import logging

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.erpnext_client import erpnext_adapter

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)

logger = logging.getLogger(__name__)


class ReportType(str, Enum):
    SALES = "sales"
    INVENTORY = "inventory"
    FINANCE = "finance"
    PURCHASES = "purchases"
    CUSTOMERS = "customers"
    EMPLOYEES = "employees"


class ReportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"
    EXCEL = "excel"


class ReportRequest(BaseModel):
    report_type: ReportType
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    format: ReportFormat = ReportFormat.JSON
    
    class Config:
        json_schema_extra = {
            "example": {
                "report_type": "sales",
                "date_from": "2026-01-01",
                "date_to": "2026-01-31",
                "filters": {"customer": "ABC Corp"},
                "format": "json"
            }
        }


class ReportTypeInfo(BaseModel):
    type: str
    name: str
    description: str
    available_filters: List[str]
    formats: List[str]


@router.get("/types")
async def list_report_types(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    List all available report types
    
    Returns metadata about each report type including available filters and formats
    """
    report_types = [
        ReportTypeInfo(
            type="sales",
            name="Sales Report",
            description="Comprehensive sales analysis including revenue, orders, and customer breakdown",
            available_filters=["customer", "item_group", "sales_person", "territory"],
            formats=["json", "csv", "excel", "pdf"]
        ),
        ReportTypeInfo(
            type="inventory",
            name="Inventory Report",
            description="Stock levels, movements, and valuation across warehouses",
            available_filters=["warehouse", "item_group", "brand"],
            formats=["json", "csv", "excel"]
        ),
        ReportTypeInfo(
            type="finance",
            name="Financial Report",
            description="Profit & loss, balance sheet summaries, and cash flow",
            available_filters=["cost_center", "account_type"],
            formats=["json", "csv", "excel", "pdf"]
        ),
        ReportTypeInfo(
            type="purchases",
            name="Purchases Report",
            description="Supplier analysis, purchase orders, and expense tracking",
            available_filters=["supplier", "item_group"],
            formats=["json", "csv", "excel"]
        ),
        ReportTypeInfo(
            type="customers",
            name="Customer Report",
            description="Customer segmentation, lifetime value, and activity analysis",
            available_filters=["customer_group", "territory"],
            formats=["json", "csv", "excel"]
        ),
        ReportTypeInfo(
            type="employees",
            name="Employee Report",
            description="HR analytics, attendance, and payroll summaries",
            available_filters=["department", "designation"],
            formats=["json", "csv", "excel"]
        )
    ]
    
    return {
        "report_types": [rt.model_dump() for rt in report_types],
        "tenant_id": tenant_id
    }


@router.get("/{report_type}")
async def generate_report(
    report_type: ReportType,
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    format: ReportFormat = Query(ReportFormat.JSON, description="Output format"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate a specific report
    
    Supports sales, inventory, finance, purchases, customers, and employees reports
    """
    try:
        # Set default date range (last 30 days)
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")
        
        # Generate report based on type
        report_generators = {
            ReportType.SALES: _generate_sales_report,
            ReportType.INVENTORY: _generate_inventory_report,
            ReportType.FINANCE: _generate_finance_report,
            ReportType.PURCHASES: _generate_purchases_report,
            ReportType.CUSTOMERS: _generate_customers_report,
            ReportType.EMPLOYEES: _generate_employees_report
        }
        
        generator = report_generators.get(report_type)
        if not generator:
            raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")
        
        report_data = await generator(tenant_id, date_from, date_to)
        
        return {
            "report_type": report_type.value,
            "data": report_data,
            "date_range": {"from": date_from, "to": date_to},
            "generated_at": datetime.now().isoformat(),
            "format": format.value
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate {report_type} report: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "type": "report_generation_error",
                "message": f"Failed to generate {report_type} report",
                "error": str(e)
            }
        )


@router.get("/sales/summary")
async def get_sales_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    group_by: str = Query("day", description="Group by: day, week, month"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get sales summary with grouping options"""
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")
    
    report_data = await _generate_sales_report(tenant_id, date_from, date_to)
    return {
        "summary": report_data.get("summary", {}),
        "grouped_by": group_by,
        "date_range": {"from": date_from, "to": date_to}
    }


@router.get("/inventory/stock-levels")
async def get_stock_levels(
    warehouse: Optional[str] = Query(None, description="Filter by warehouse"),
    item_group: Optional[str] = Query(None, description="Filter by item group"),
    low_stock_only: bool = Query(False, description="Show only low stock items"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current stock levels with optional filters"""
    try:
        filters = []
        if warehouse:
            filters.append(["warehouse", "=", warehouse])
        if item_group:
            filters.append(["item_group", "=", item_group])
        
        # Query stock balance from ERPNext
        stock_data = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Bin",
            method="GET",
            params={
                "filters": json.dumps(filters) if filters else None,
                "fields": json.dumps([
                    "item_code", "warehouse", "actual_qty", 
                    "projected_qty", "reserved_qty", "valuation_rate"
                ]),
                "limit_page_length": 500
            }
        )
        
        items = stock_data.get("data", []) if isinstance(stock_data, dict) else []
        
        # Calculate summary
        total_value = sum(
            float(item.get("actual_qty", 0)) * float(item.get("valuation_rate", 0))
            for item in items
        )
        
        return {
            "stock_levels": items,
            "summary": {
                "total_items": len(items),
                "total_value": round(total_value, 2)
            },
            "filters": {
                "warehouse": warehouse,
                "item_group": item_group,
                "low_stock_only": low_stock_only
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get stock levels: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Report generation helper functions

async def _generate_sales_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate sales report from ERPNext data"""
    try:
        filters = [
            ["docstatus", "=", 1],
            ["posting_date", ">=", date_from],
            ["posting_date", "<=", date_to]
        ]
        
        invoices = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "filters": json.dumps(filters),
                "fields": json.dumps([
                    "name", "customer", "grand_total", "net_total",
                    "total_taxes_and_charges", "posting_date", "status"
                ]),
                "limit_page_length": 1000
            }
        )
        
        data = invoices.get("data", []) if isinstance(invoices, dict) else []
        
        total_revenue = sum(float(inv.get("grand_total", 0)) for inv in data)
        total_net = sum(float(inv.get("net_total", 0)) for inv in data)
        total_tax = sum(float(inv.get("total_taxes_and_charges", 0)) for inv in data)
        
        # Group by customer
        by_customer = {}
        for inv in data:
            customer = inv.get("customer", "Unknown")
            if customer not in by_customer:
                by_customer[customer] = {"count": 0, "total": 0}
            by_customer[customer]["count"] += 1
            by_customer[customer]["total"] += float(inv.get("grand_total", 0))
        
        return {
            "summary": {
                "total_invoices": len(data),
                "total_revenue": round(total_revenue, 2),
                "total_net_sales": round(total_net, 2),
                "total_tax": round(total_tax, 2),
                "avg_invoice_value": round(total_revenue / len(data), 2) if data else 0
            },
            "by_customer": [
                {"customer": k, "invoices": v["count"], "total": round(v["total"], 2)}
                for k, v in sorted(by_customer.items(), key=lambda x: x[1]["total"], reverse=True)[:10]
            ]
        }
        
    except Exception as e:
        logger.error(f"Sales report generation failed: {e}")
        return {"summary": {}, "error": str(e)}


async def _generate_inventory_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate inventory report"""
    try:
        # Get items
        items = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Item",
            method="GET",
            params={
                "filters": json.dumps([["is_stock_item", "=", 1]]),
                "fields": json.dumps(["name", "item_name", "item_group", "stock_uom"]),
                "limit_page_length": 500
            }
        )
        
        item_list = items.get("data", []) if isinstance(items, dict) else []
        
        # Get stock levels
        bins = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Bin",
            method="GET",
            params={
                "fields": json.dumps(["item_code", "warehouse", "actual_qty", "valuation_rate"]),
                "limit_page_length": 1000
            }
        )
        
        bin_data = bins.get("data", []) if isinstance(bins, dict) else []
        
        # Calculate totals
        total_qty = sum(float(b.get("actual_qty", 0)) for b in bin_data)
        total_value = sum(
            float(b.get("actual_qty", 0)) * float(b.get("valuation_rate", 0))
            for b in bin_data
        )
        
        return {
            "summary": {
                "total_items": len(item_list),
                "total_stock_entries": len(bin_data),
                "total_quantity": round(total_qty, 2),
                "total_value": round(total_value, 2)
            },
            "by_warehouse": {},
            "low_stock_items": []
        }
        
    except Exception as e:
        logger.error(f"Inventory report generation failed: {e}")
        return {"summary": {}, "error": str(e)}


async def _generate_finance_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate financial summary report"""
    try:
        # Get GL entries
        gl_entries = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/GL Entry",
            method="GET",
            params={
                "filters": json.dumps([
                    ["posting_date", ">=", date_from],
                    ["posting_date", "<=", date_to]
                ]),
                "fields": json.dumps([
                    "account", "debit", "credit", "posting_date", "voucher_type"
                ]),
                "limit_page_length": 1000
            }
        )
        
        entries = gl_entries.get("data", []) if isinstance(gl_entries, dict) else []
        
        total_debit = sum(float(e.get("debit", 0)) for e in entries)
        total_credit = sum(float(e.get("credit", 0)) for e in entries)
        
        return {
            "summary": {
                "total_entries": len(entries),
                "total_debit": round(total_debit, 2),
                "total_credit": round(total_credit, 2),
                "net_movement": round(total_debit - total_credit, 2)
            },
            "by_voucher_type": {},
            "by_account": {}
        }
        
    except Exception as e:
        logger.error(f"Finance report generation failed: {e}")
        return {"summary": {}, "error": str(e)}


async def _generate_purchases_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate purchases report"""
    try:
        purchases = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Invoice",
            method="GET",
            params={
                "filters": json.dumps([
                    ["docstatus", "=", 1],
                    ["posting_date", ">=", date_from],
                    ["posting_date", "<=", date_to]
                ]),
                "fields": json.dumps([
                    "name", "supplier", "grand_total", "posting_date", "status"
                ]),
                "limit_page_length": 500
            }
        )
        
        data = purchases.get("data", []) if isinstance(purchases, dict) else []
        total = sum(float(p.get("grand_total", 0)) for p in data)
        
        return {
            "summary": {
                "total_invoices": len(data),
                "total_purchases": round(total, 2),
                "avg_purchase_value": round(total / len(data), 2) if data else 0
            },
            "by_supplier": []
        }
        
    except Exception as e:
        logger.error(f"Purchases report generation failed: {e}")
        return {"summary": {}, "error": str(e)}


async def _generate_customers_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate customer analytics report"""
    try:
        customers = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Customer",
            method="GET",
            params={
                "fields": json.dumps(["name", "customer_name", "customer_group", "territory"]),
                "limit_page_length": 500
            }
        )
        
        data = customers.get("data", []) if isinstance(customers, dict) else []
        
        return {
            "summary": {
                "total_customers": len(data)
            },
            "by_group": {},
            "by_territory": {}
        }
        
    except Exception as e:
        logger.error(f"Customers report generation failed: {e}")
        return {"summary": {}, "error": str(e)}


async def _generate_employees_report(
    tenant_id: str, date_from: str, date_to: str
) -> Dict[str, Any]:
    """Generate employee report"""
    try:
        employees = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Employee",
            method="GET",
            params={
                "filters": json.dumps([["status", "=", "Active"]]),
                "fields": json.dumps(["name", "employee_name", "department", "designation"]),
                "limit_page_length": 500
            }
        )
        
        data = employees.get("data", []) if isinstance(employees, dict) else []
        
        return {
            "summary": {
                "total_employees": len(data)
            },
            "by_department": {},
            "by_designation": {}
        }
        
    except Exception as e:
        logger.error(f"Employees report generation failed: {e}")
        return {"summary": {}, "error": str(e)}
