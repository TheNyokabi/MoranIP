"""
Generic CRUD Router Factory

Creates standardized CRUD routers for any ERPNext DocType.
Reduces code duplication and ensures consistent API patterns across modules.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Type, List, Optional, Dict, Any, Callable
import json
import logging

from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.erpnext_client import erpnext_adapter

logger = logging.getLogger(__name__)


def create_crud_router(
    doctype: str,
    prefix: str,
    tags: List[str],
    list_fields: List[str],
    detail_fields: Optional[List[str]] = None,
    default_filters: Optional[List[List]] = None,
    permission_prefix: Optional[str] = None,
    create_model: Optional[Type[BaseModel]] = None,
    update_model: Optional[Type[BaseModel]] = None,
    field_mapping: Optional[Dict[str, str]] = None,
    response_mapper: Optional[Callable[[Dict], Dict]] = None,
    enable_submit: bool = False,
    enable_cancel: bool = False,
) -> APIRouter:
    """
    Create a standardized CRUD router for an ERPNext DocType.
    
    Args:
        doctype: ERPNext DocType name (e.g., "Item", "Customer", "Sales Order")
        prefix: URL prefix for the router (e.g., "/items", "/customers")
        tags: OpenAPI tags for documentation
        list_fields: Fields to return in list endpoints
        detail_fields: Fields to return in detail endpoints (defaults to list_fields)
        default_filters: Default filters to apply to list queries
        permission_prefix: Permission prefix for RBAC checks (optional)
        create_model: Pydantic model for create requests
        update_model: Pydantic model for update requests
        field_mapping: Map MoranERP field names to ERPNext field names
        response_mapper: Function to transform ERPNext response to MoranERP format
        enable_submit: Whether to enable submit endpoint (for submittable doctypes)
        enable_cancel: Whether to enable cancel endpoint (for submittable doctypes)
    
    Returns:
        Configured APIRouter with CRUD endpoints
    """
    
    router = APIRouter(prefix=prefix, tags=tags)
    _detail_fields = detail_fields or list_fields
    _field_mapping = field_mapping or {}
    
    def map_to_erpnext(data: Dict) -> Dict:
        """Map MoranERP fields to ERPNext fields"""
        result = {}
        for key, value in data.items():
            if value is not None:
                mapped_key = _field_mapping.get(key, key)
                result[mapped_key] = value
        return result
    
    def map_from_erpnext(data: Dict) -> Dict:
        """Map ERPNext fields to MoranERP fields"""
        if response_mapper:
            return response_mapper(data)
        
        # Default mapping: reverse the field_mapping
        reverse_mapping = {v: k for k, v in _field_mapping.items()}
        result = {}
        for key, value in data.items():
            mapped_key = reverse_mapping.get(key, key)
            result[mapped_key] = value
        return result
    
    # ==================== List Endpoint ====================
    
    @router.get("/")
    async def list_items(
        search: Optional[str] = Query(None, description="Search query"),
        filters: Optional[str] = Query(None, description="JSON-encoded filters"),
        order_by: Optional[str] = Query(None, description="Field to order by"),
        order_direction: str = Query("desc", description="Order direction (asc/desc)"),
        limit: int = Query(50, le=500, description="Number of items to return"),
        offset: int = Query(0, ge=0, description="Offset for pagination"),
        tenant_id: str = Depends(require_tenant_access),
        current_user: dict = Depends(get_current_user)
    ):
        """
        List items with optional filtering, searching, and pagination.
        """
        # Build filters
        erp_filters = list(default_filters or [])
        
        if filters:
            try:
                custom_filters = json.loads(filters)
                if isinstance(custom_filters, list):
                    erp_filters.extend(custom_filters)
                elif isinstance(custom_filters, dict):
                    for key, value in custom_filters.items():
                        erp_filters.append([key, "=", value])
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid filters JSON")
        
        # Build params
        params = {
            "fields": json.dumps(list_fields),
            "limit_page_length": limit,
            "limit_start": offset,
        }
        
        if erp_filters:
            params["filters"] = json.dumps(erp_filters)
        
        if order_by:
            direction = "desc" if order_direction.lower() == "desc" else "asc"
            params["order_by"] = f"{order_by} {direction}"
        
        try:
            result = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/{doctype}",
                method="GET",
                params=params
            )
            
            items = []
            data = result if isinstance(result, list) else (result or {}).get("data", result or [])
            
            if isinstance(data, list):
                items = [map_from_erpnext(item) for item in data if isinstance(item, dict)]
            
            return {
                "items": items,
                "total": len(items),
                "limit": limit,
                "offset": offset
            }
            
        except Exception as e:
            logger.error(f"Error listing {doctype}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to list {doctype}")
    
    # ==================== Get Single Item Endpoint ====================
    
    @router.get("/{item_id}")
    async def get_item(
        item_id: str,
        tenant_id: str = Depends(require_tenant_access),
        current_user: dict = Depends(get_current_user)
    ):
        """
        Get a single item by ID.
        """
        try:
            result = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/{doctype}/{item_id}",
                method="GET"
            )
            
            if not result:
                raise HTTPException(status_code=404, detail=f"{doctype} not found")
            
            data = result.get("data", result) if isinstance(result, dict) else result
            return {"data": map_from_erpnext(data)}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting {doctype}/{item_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get {doctype}")
    
    # ==================== Create Endpoint ====================
    
    if create_model:
        @router.post("/")
        async def create_item(
            data: create_model,
            tenant_id: str = Depends(require_tenant_access),
            current_user: dict = Depends(get_current_user)
        ):
            """
            Create a new item.
            """
            try:
                erpnext_data = map_to_erpnext(data.model_dump(exclude_unset=True))
                
                result = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/{doctype}",
                    method="POST",
                    json_data=erpnext_data
                )
                
                created = result.get("data", result) if isinstance(result, dict) else result
                return {"data": map_from_erpnext(created), "message": f"{doctype} created successfully"}
                
            except Exception as e:
                logger.error(f"Error creating {doctype}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to create {doctype}: {str(e)}")
    
    # ==================== Update Endpoint ====================
    
    if update_model:
        @router.put("/{item_id}")
        async def update_item(
            item_id: str,
            data: update_model,
            tenant_id: str = Depends(require_tenant_access),
            current_user: dict = Depends(get_current_user)
        ):
            """
            Update an existing item.
            """
            try:
                erpnext_data = map_to_erpnext(data.model_dump(exclude_unset=True))
                
                result = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/{doctype}/{item_id}",
                    method="PUT",
                    json_data=erpnext_data
                )
                
                updated = result.get("data", result) if isinstance(result, dict) else result
                return {"data": map_from_erpnext(updated), "message": f"{doctype} updated successfully"}
                
            except Exception as e:
                logger.error(f"Error updating {doctype}/{item_id}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to update {doctype}")
    
    # ==================== Delete Endpoint ====================
    
    @router.delete("/{item_id}")
    async def delete_item(
        item_id: str,
        tenant_id: str = Depends(require_tenant_access),
        current_user: dict = Depends(get_current_user)
    ):
        """
        Delete an item.
        """
        try:
            result = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/{doctype}/{item_id}",
                method="DELETE"
            )
            
            return {"message": f"{doctype} deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting {doctype}/{item_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete {doctype}")
    
    # ==================== Submit Endpoint (for submittable doctypes) ====================
    
    if enable_submit:
        @router.post("/{item_id}/submit")
        async def submit_item(
            item_id: str,
            tenant_id: str = Depends(require_tenant_access),
            current_user: dict = Depends(get_current_user)
        ):
            """
            Submit an item (for submittable doctypes like Sales Order, Purchase Order, etc.)
            """
            try:
                result = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/{doctype}/{item_id}",
                    method="PUT",
                    json_data={"docstatus": 1}
                )
                
                return {"message": f"{doctype} submitted successfully", "status": "Submitted"}
                
            except Exception as e:
                logger.error(f"Error submitting {doctype}/{item_id}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to submit {doctype}")
    
    # ==================== Cancel Endpoint (for submittable doctypes) ====================
    
    if enable_cancel:
        @router.post("/{item_id}/cancel")
        async def cancel_item(
            item_id: str,
            tenant_id: str = Depends(require_tenant_access),
            current_user: dict = Depends(get_current_user)
        ):
            """
            Cancel an item (for submittable doctypes)
            """
            try:
                result = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/{doctype}/{item_id}",
                    method="PUT",
                    json_data={"docstatus": 2}
                )
                
                return {"message": f"{doctype} cancelled successfully", "status": "Cancelled"}
                
            except Exception as e:
                logger.error(f"Error cancelling {doctype}/{item_id}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to cancel {doctype}")
    
    return router


# ==================== Pre-built Routers for Common DocTypes ====================

def create_item_router() -> APIRouter:
    """Create a router for Item doctype"""
    from pydantic import BaseModel, Field
    
    class ItemCreate(BaseModel):
        item_code: str
        item_name: str
        item_group: str = "Products"
        stock_uom: str = "Nos"
        is_stock_item: bool = True
        standard_rate: Optional[float] = None
        description: Optional[str] = None
    
    class ItemUpdate(BaseModel):
        item_name: Optional[str] = None
        item_group: Optional[str] = None
        standard_rate: Optional[float] = None
        description: Optional[str] = None
        disabled: Optional[int] = None
    
    return create_crud_router(
        doctype="Item",
        prefix="/items",
        tags=["Items"],
        list_fields=["name", "item_code", "item_name", "item_group", "stock_uom", "standard_rate", "is_stock_item", "disabled"],
        create_model=ItemCreate,
        update_model=ItemUpdate,
        default_filters=[["disabled", "=", 0]],
    )


def create_customer_router() -> APIRouter:
    """Create a router for Customer doctype"""
    from pydantic import BaseModel
    
    class CustomerCreate(BaseModel):
        customer_name: str
        customer_type: str = "Individual"
        customer_group: str = "Individual"
        territory: str = "All Territories"
        email_id: Optional[str] = None
        mobile_no: Optional[str] = None
    
    class CustomerUpdate(BaseModel):
        customer_name: Optional[str] = None
        customer_type: Optional[str] = None
        customer_group: Optional[str] = None
        email_id: Optional[str] = None
        mobile_no: Optional[str] = None
        disabled: Optional[int] = None
    
    return create_crud_router(
        doctype="Customer",
        prefix="/customers",
        tags=["Customers"],
        list_fields=["name", "customer_name", "customer_type", "customer_group", "territory", "disabled"],
        create_model=CustomerCreate,
        update_model=CustomerUpdate,
        default_filters=[["disabled", "=", 0]],
    )


def create_supplier_router() -> APIRouter:
    """Create a router for Supplier doctype"""
    from pydantic import BaseModel
    
    class SupplierCreate(BaseModel):
        supplier_name: str
        supplier_group: str = "All Supplier Groups"
        supplier_type: str = "Company"
        country: Optional[str] = None
        email_id: Optional[str] = None
        mobile_no: Optional[str] = None
    
    class SupplierUpdate(BaseModel):
        supplier_name: Optional[str] = None
        supplier_group: Optional[str] = None
        country: Optional[str] = None
        email_id: Optional[str] = None
        mobile_no: Optional[str] = None
        disabled: Optional[int] = None
    
    return create_crud_router(
        doctype="Supplier",
        prefix="/suppliers",
        tags=["Suppliers"],
        list_fields=["name", "supplier_name", "supplier_group", "supplier_type", "country", "disabled"],
        create_model=SupplierCreate,
        update_model=SupplierUpdate,
        default_filters=[["disabled", "=", 0]],
    )
