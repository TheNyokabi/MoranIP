"""
Quick Actions API for PoS
Fast access to frequently used items, customers, and operations
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.quick_actions_service import QuickActionsService
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase

router = APIRouter(
    prefix="/pos/quick-actions",
    tags=["POS Quick Actions"],
)


@router.get("/frequent-items")
async def get_frequent_items(
    pos_profile_id: str = Query(..., description="POS Profile ID"),
    limit: int = Query(20, description="Maximum number of items to return"),
    days_back: int = Query(30, description="Number of days to look back"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get frequently sold items for quick access

    Returns top-selling items based on sales history for faster checkout
    """
    try:
        quick_actions_service = QuickActionsService(
            erpnext_adapter=pos_service,
            tenant_id=tenant_id
        )

        frequent_items = await quick_actions_service.get_frequent_items(
            pos_profile_id=pos_profile_id,
            limit=limit,
            days_back=days_back
        )

        return {
            "frequent_items": frequent_items,
            "pos_profile_id": pos_profile_id,
            "total_count": len(frequent_items)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "quick_actions_error",
                "message": "Failed to retrieve frequent items",
                "error": str(e)
            }
        )


@router.get("/recent-customers")
async def get_recent_customers(
    pos_profile_id: str = Query(..., description="POS Profile ID"),
    limit: int = Query(10, description="Maximum number of customers to return"),
    days_back: int = Query(7, description="Number of days to look back"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get recently active customers for quick selection

    Returns customers who have purchased recently for faster customer lookup
    """
    try:
        quick_actions_service = QuickActionsService(
            erpnext_adapter=pos_service,
            tenant_id=tenant_id
        )

        recent_customers = await quick_actions_service.get_recent_customers(
            pos_profile_id=pos_profile_id,
            limit=limit,
            days_back=days_back
        )

        return {
            "recent_customers": recent_customers,
            "pos_profile_id": pos_profile_id,
            "total_count": len(recent_customers)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "quick_actions_error",
                "message": "Failed to retrieve recent customers",
                "error": str(e)
            }
        )


@router.get("/search-items")
async def search_items(
    q: str = Query(..., description="Search query"),
    pos_profile_id: Optional[str] = Query(None, description="POS Profile ID for filtering"),
    limit: int = Query(50, description="Maximum number of results"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Search items by code, name, or barcode with fuzzy matching

    Provides fast item lookup for POS operations
    """
    try:
        quick_actions_service = QuickActionsService(
            erpnext_adapter=pos_service,
            tenant_id=tenant_id
        )

        search_results = await quick_actions_service.search_items(
            query=q,
            pos_profile_id=pos_profile_id,
            limit=limit
        )

        return {
            "search_results": search_results,
            "query": q,
            "total_count": len(search_results)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "search_error",
                "message": "Failed to search items",
                "error": str(e)
            }
        )


@router.post("/quick-sale")
async def create_quick_sale(
    preset_id: str,
    pos_profile_id: str,
    customer: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a quick sale using a pre-configured preset

    Allows one-click sales for frequently sold items
    """
    try:
        quick_actions_service = QuickActionsService(
            erpnext_adapter=pos_service,
            tenant_id=tenant_id
        )

        # Get the preset configuration
        preset = quick_actions_service.get_quick_sale_preset(
            preset_id=preset_id,
            pos_profile_id=pos_profile_id
        )

        if not preset:
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "preset_not_found",
                    "message": f"Quick sale preset '{preset_id}' not found",
                    "preset_id": preset_id
                }
            )

        # Override customer if specified
        if customer:
            preset["customer"] = customer

        # Add POS profile to the preset
        preset["pos_profile_id"] = pos_profile_id

        return {
            "preset": preset,
            "message": f"Quick sale preset '{preset_id}' ready for checkout"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "quick_sale_error",
                "message": "Failed to create quick sale",
                "error": str(e)
            }
        )


@router.post("/repeat-last-sale")
async def repeat_last_sale(
    customer: str,
    pos_profile_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Repeat the last sale for a customer

    Useful for regular customers with recurring purchases
    """
    try:
        quick_actions_service = QuickActionsService(
            erpnext_adapter=pos_service,
            tenant_id=tenant_id
        )

        last_sale = await quick_actions_service.repeat_last_sale(
            customer=customer,
            pos_profile_id=pos_profile_id
        )

        if not last_sale:
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "no_previous_sale",
                    "message": f"No previous sales found for customer '{customer}'",
                    "customer": customer
                }
            )

        return {
            "last_sale": last_sale,
            "customer": customer,
            "message": "Last sale data ready for checkout"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "repeat_sale_error",
                "message": "Failed to retrieve last sale",
                "error": str(e)
            }
        )


@router.post("/quick-customer")
async def create_quick_customer(
    customer_data: Dict[str, Any],
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a quick customer entry for fast checkout

    Allows adding customer details during checkout process
    """
    try:
        # Validate required fields
        required_fields = ["customer_name"]
        for field in required_fields:
            if field not in customer_data:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "validation_error",
                        "message": f"Missing required field: {field}",
                        "field": field
                    }
                )

        # Create customer in ERPNext
        customer_payload = {
            "customer_name": customer_data["customer_name"],
            "customer_type": customer_data.get("customer_type", "Individual"),
            "customer_group": customer_data.get("customer_group", "Direct"),
            "phone": customer_data.get("phone"),
            "email": customer_data.get("email"),
            "territory": customer_data.get("territory", "Kenya")
        }

        result = await pos_service._request(
            method="POST",
            path="resource/Customer",
            json_data=customer_payload
        )

        if not result or not result.get("data"):
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "customer_creation_failed",
                    "message": "Failed to create customer in ERPNext"
                }
            )

        created_customer = result["data"]

        return {
            "customer": created_customer,
            "message": f"Customer '{customer_data['customer_name']}' created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "quick_customer_error",
                "message": "Failed to create quick customer",
                "error": str(e)
            }
        )


@router.post("/bulk-add")
async def bulk_add_items(
    items: List[Dict[str, Any]],
    pos_profile_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Bulk add multiple items from barcode scan list

    Useful for batch scanning items during inventory or quick checkout
    """
    try:
        # Validate items
        if not items:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "validation_error",
                    "message": "No items provided for bulk add"
                }
            )

        validated_items = []
        for i, item in enumerate(items):
            if not item.get("item_code"):
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "validation_error",
                        "message": f"Item {i+1}: Missing item_code",
                        "item_index": i
                    }
                )

            # Set default quantity if not provided
            if "qty" not in item:
                item["qty"] = 1

            validated_items.append({
                "item_code": item["item_code"],
                "qty": item["qty"],
                "rate": item.get("rate"),
                "warehouse": item.get("warehouse")
            })

        return {
            "items": validated_items,
            "total_items": len(validated_items),
            "pos_profile_id": pos_profile_id,
            "message": f"Bulk added {len(validated_items)} items successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "bulk_add_error",
                "message": "Failed to process bulk item addition",
                "error": str(e)
            }
        )