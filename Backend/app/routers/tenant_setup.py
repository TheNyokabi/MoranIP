"""
Tenant Setup Router
Provides endpoints to complete tenant setup via FastAPI backend
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.dependencies.auth import get_current_user, require_tenant_access
from app.database import get_db
from app.services.erpnext_client import erpnext_adapter
import json

router = APIRouter(prefix="/setup", tags=["Tenant Setup"])


class POSProfileCreate(BaseModel):
    name: str
    warehouse: str
    company: Optional[str] = None
    payment_methods: Optional[List[str]] = ["Cash"]


@router.get("/warehouses")
async def list_warehouses_for_setup(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List warehouses for setup/configuration purposes."""
    params = {"limit_page_length": 200}
    
    warehouses = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse",
        method="GET",
        params=params
    )
    
    if isinstance(warehouses, dict):
        warehouses = warehouses.get("data", warehouses.get("warehouses", []))
    elif not isinstance(warehouses, list):
        warehouses = []
    
    return {"warehouses": warehouses or []}


@router.post("/pos-profiles")
async def create_pos_profile_via_api(
    profile: POSProfileCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create POS Profile via API (alternative to ERPNext UI)."""
    from app.models.iam import Tenant
    
    # Get tenant to find company name
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get company name
    company_name = profile.company
    if not company_name:
        # Try to get company from ERPNext
        companies = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Company",
            method="GET",
            params={"limit_page_length": 1}
        )
        if isinstance(companies, dict):
            companies = companies.get("data", [])
        if companies and len(companies) > 0:
            company_name = companies[0].get("name", tenant.name)
        else:
            company_name = tenant.name
    
    # Verify warehouse exists
    warehouse_response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Warehouse/{profile.warehouse}",
        method="GET"
    )
    
    if isinstance(warehouse_response, dict) and "exc_type" in warehouse_response.get("detail", {}):
        raise HTTPException(status_code=404, detail=f"Warehouse '{profile.warehouse}' not found")
    
    # Build POS Profile data
    profile_data = {
        "doctype": "POS Profile",
        "name": profile.name,
        "company": company_name,
        "warehouse": profile.warehouse,
        "currency": "KES"
    }
    
    # Add payment methods
    payments = []
    for i, method in enumerate(profile.payment_methods or ["Cash"]):
        payments.append({
            "mode_of_payment": method,
            "default": 1 if i == 0 else 0
        })
    profile_data["payments"] = payments
    
    try:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/POS Profile",
            method="POST",
            json_data=profile_data
        )
        
        if isinstance(result, dict):
            if "data" in result:
                return {"data": result["data"], "message": "POS Profile created successfully"}
            elif "exc_type" in result.get("detail", {}):
                raise HTTPException(status_code=417, detail=result["detail"])
        
        return {"data": result, "message": "POS Profile created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create POS Profile: {str(e)}")


@router.get("/status")
async def get_setup_status(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get current setup status for a tenant."""
    status = {
        "warehouses": 0,
        "pos_profiles": 0,
        "items": 0,
        "price_list": False,
        "payment_methods": []
    }
    
    try:
        # Count warehouses
        warehouses = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Warehouse",
            method="GET",
            params={"limit_page_length": 200}
        )
        if isinstance(warehouses, dict):
            warehouses = warehouses.get("data", [])
        status["warehouses"] = len(warehouses) if isinstance(warehouses, list) else 0
        
        # Count POS Profiles
        pos_profiles = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/POS Profile",
            method="GET",
            params={"limit_page_length": 200}
        )
        if isinstance(pos_profiles, dict):
            pos_profiles = pos_profiles.get("data", [])
        status["pos_profiles"] = len(pos_profiles) if isinstance(pos_profiles, list) else 0
        
        # Count items
        items = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Item",
            method="GET",
            params={"limit_page_length": 200}
        )
        if isinstance(items, dict):
            items = items.get("data", [])
        status["items"] = len(items) if isinstance(items, list) else 0
        
        # Check Price List
        price_lists = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Price List",
            method="GET",
            params={"filters": json.dumps([["name", "=", "Standard Selling"]])}
        )
        if isinstance(price_lists, dict):
            price_lists = price_lists.get("data", [])
        status["price_list"] = len(price_lists) > 0 if isinstance(price_lists, list) else False
        
        # Get Payment Methods
        payment_methods = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Mode of Payment",
            method="GET",
            params={"limit_page_length": 20}
        )
        if isinstance(payment_methods, dict):
            payment_methods = payment_methods.get("data", [])
        if isinstance(payment_methods, list):
            status["payment_methods"] = [pm.get("name", pm.get("mode_of_payment", "")) for pm in payment_methods if pm.get("name") or pm.get("mode_of_payment")]
        
    except Exception as e:
        # Don't fail completely, just log the error
        print(f"Error getting setup status: {e}")
    
    return status
