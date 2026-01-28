"""
E-commerce Integration API Router

Endpoints for:
- Shopify integration
- WooCommerce integration
- Multi-channel inventory
- Order import
- Product sync
"""

import logging
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.ecommerce import (
    ShopifyConnector, ShopifyConfig,
    WooCommerceConnector, WooCommerceConfig,
    MultiChannelInventoryService, SalesChannel
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ecommerce", tags=["E-commerce"])


# ==================== Pydantic Models ====================

class ShopifyConfigRequest(BaseModel):
    store_name: str
    access_token: str
    api_version: str = "2024-01"


class WooCommerceConfigRequest(BaseModel):
    store_url: str
    consumer_key: str
    consumer_secret: str
    api_version: str = "wc/v3"


class ProductSyncRequest(BaseModel):
    item_codes: List[str]
    direction: str = "to_channel"  # to_channel, from_channel


class OrderImportRequest(BaseModel):
    order_ids: Optional[List[int]] = None
    since_date: Optional[str] = None
    status: Optional[str] = None


class InventoryAllocationRequest(BaseModel):
    item_code: str
    channel: str
    allocation_type: str  # percentage, fixed, unlimited
    value: int
    min_buffer: int = 0
    priority: int = 100


class ChannelInventoryResponse(BaseModel):
    channel: str
    item_code: str
    total_allocated: int
    available: int
    reserved: int
    pending_sync: int


class SyncResultResponse(BaseModel):
    success: bool
    synced: int
    failed: int
    items: List[Dict[str, Any]]


# ==================== Connection Management ====================

# Store configurations per tenant (in production, use database)
_shopify_configs: Dict[str, ShopifyConfig] = {}
_woo_configs: Dict[str, WooCommerceConfig] = {}


@router.post("/shopify/connect")
async def connect_shopify(
    request: ShopifyConfigRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Connect Shopify store"""
    config = ShopifyConfig(
        store_name=request.store_name,
        access_token=request.access_token,
        api_version=request.api_version
    )
    
    # Test connection
    connector = ShopifyConnector(config, tenant_id)
    try:
        products = await connector.get_products(limit=1)
        await connector.close()
        
        # Store configuration
        _shopify_configs[tenant_id] = config
        
        return {
            "success": True,
            "message": "Shopify connected successfully",
            "store_name": request.store_name
        }
    except Exception as e:
        await connector.close()
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


@router.post("/woocommerce/connect")
async def connect_woocommerce(
    request: WooCommerceConfigRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Connect WooCommerce store"""
    config = WooCommerceConfig(
        store_url=request.store_url,
        consumer_key=request.consumer_key,
        consumer_secret=request.consumer_secret,
        api_version=request.api_version
    )
    
    # Test connection
    connector = WooCommerceConnector(config, tenant_id)
    try:
        products = await connector.get_products(per_page=1)
        await connector.close()
        
        # Store configuration
        _woo_configs[tenant_id] = config
        
        return {
            "success": True,
            "message": "WooCommerce connected successfully",
            "store_url": request.store_url
        }
    except Exception as e:
        await connector.close()
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


@router.get("/connections")
async def get_connections(
    tenant_id: str = Depends(require_tenant_access)
):
    """Get connected e-commerce platforms"""
    connections = []
    
    if tenant_id in _shopify_configs:
        connections.append({
            "platform": "shopify",
            "store_name": _shopify_configs[tenant_id].store_name,
            "status": "connected"
        })
    
    if tenant_id in _woo_configs:
        connections.append({
            "platform": "woocommerce",
            "store_url": _woo_configs[tenant_id].store_url,
            "status": "connected"
        })
    
    return {"connections": connections}


# ==================== Shopify Endpoints ====================

@router.get("/shopify/products")
async def get_shopify_products(
    limit: int = Query(50, ge=1, le=250),
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access)
):
    """Get products from Shopify"""
    if tenant_id not in _shopify_configs:
        raise HTTPException(status_code=400, detail="Shopify not connected")
    
    connector = ShopifyConnector(_shopify_configs[tenant_id], tenant_id)
    try:
        products = await connector.get_products(limit=limit, status=status)
        return {
            "products": [p.model_dump() for p in products],
            "count": len(products)
        }
    finally:
        await connector.close()


@router.post("/shopify/products/sync")
async def sync_products_to_shopify(
    request: ProductSyncRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Sync products to Shopify"""
    if tenant_id not in _shopify_configs:
        raise HTTPException(status_code=400, detail="Shopify not connected")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    connector = ShopifyConnector(
        _shopify_configs[tenant_id],
        tenant_id,
        get_erpnext_adapter()
    )
    
    try:
        results = []
        for item_code in request.item_codes:
            result = await connector.sync_product_to_shopify(item_code)
            results.append({
                "item_code": item_code,
                "success": result is not None,
                "shopify_id": result.get("id") if result else None
            })
        
        return {
            "synced": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results
        }
    finally:
        await connector.close()


@router.get("/shopify/orders")
async def get_shopify_orders(
    limit: int = Query(50, ge=1, le=250),
    status: str = "any",
    financial_status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access)
):
    """Get orders from Shopify"""
    if tenant_id not in _shopify_configs:
        raise HTTPException(status_code=400, detail="Shopify not connected")
    
    connector = ShopifyConnector(_shopify_configs[tenant_id], tenant_id)
    try:
        orders = await connector.get_orders(
            status=status,
            limit=limit,
            financial_status=financial_status
        )
        return {
            "orders": [o.model_dump() for o in orders],
            "count": len(orders)
        }
    finally:
        await connector.close()


@router.post("/shopify/orders/import")
async def import_shopify_orders(
    request: OrderImportRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Import orders from Shopify to ERPNext"""
    if tenant_id not in _shopify_configs:
        raise HTTPException(status_code=400, detail="Shopify not connected")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    connector = ShopifyConnector(
        _shopify_configs[tenant_id],
        tenant_id,
        get_erpnext_adapter()
    )
    
    try:
        # Get orders
        orders = await connector.get_orders(
            status=request.status or "any",
            limit=50
        )
        
        results = []
        for order in orders:
            if request.order_ids and order.id not in request.order_ids:
                continue
            
            sales_order = await connector.import_order_to_erpnext(order)
            results.append({
                "shopify_order": order.name,
                "success": sales_order is not None,
                "erpnext_order": sales_order
            })
        
        return {
            "imported": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results
        }
    finally:
        await connector.close()


@router.post("/shopify/webhooks/register")
async def register_shopify_webhooks(
    callback_url: str,
    tenant_id: str = Depends(require_tenant_access)
):
    """Register Shopify webhooks"""
    if tenant_id not in _shopify_configs:
        raise HTTPException(status_code=400, detail="Shopify not connected")
    
    connector = ShopifyConnector(_shopify_configs[tenant_id], tenant_id)
    try:
        webhooks = await connector.register_webhooks(callback_url)
        return {"registered": len(webhooks), "webhooks": webhooks}
    finally:
        await connector.close()


# ==================== WooCommerce Endpoints ====================

@router.get("/woocommerce/products")
async def get_woocommerce_products(
    per_page: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1),
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access)
):
    """Get products from WooCommerce"""
    if tenant_id not in _woo_configs:
        raise HTTPException(status_code=400, detail="WooCommerce not connected")
    
    connector = WooCommerceConnector(_woo_configs[tenant_id], tenant_id)
    try:
        products = await connector.get_products(
            per_page=per_page,
            page=page,
            status=status
        )
        return {
            "products": [p.model_dump() for p in products],
            "count": len(products),
            "page": page
        }
    finally:
        await connector.close()


@router.post("/woocommerce/products/sync")
async def sync_products_to_woocommerce(
    request: ProductSyncRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Sync products to WooCommerce"""
    if tenant_id not in _woo_configs:
        raise HTTPException(status_code=400, detail="WooCommerce not connected")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    connector = WooCommerceConnector(
        _woo_configs[tenant_id],
        tenant_id,
        get_erpnext_adapter()
    )
    
    try:
        results = []
        for item_code in request.item_codes:
            result = await connector.sync_product_to_woocommerce(item_code)
            results.append({
                "item_code": item_code,
                "success": result is not None,
                "woo_id": result.get("id") if result else None
            })
        
        return {
            "synced": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results
        }
    finally:
        await connector.close()


@router.get("/woocommerce/orders")
async def get_woocommerce_orders(
    per_page: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1),
    status: str = "any",
    tenant_id: str = Depends(require_tenant_access)
):
    """Get orders from WooCommerce"""
    if tenant_id not in _woo_configs:
        raise HTTPException(status_code=400, detail="WooCommerce not connected")
    
    connector = WooCommerceConnector(_woo_configs[tenant_id], tenant_id)
    try:
        orders = await connector.get_orders(
            per_page=per_page,
            page=page,
            status=status
        )
        return {
            "orders": [o.model_dump() for o in orders],
            "count": len(orders),
            "page": page
        }
    finally:
        await connector.close()


@router.post("/woocommerce/orders/import")
async def import_woocommerce_orders(
    request: OrderImportRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Import orders from WooCommerce to ERPNext"""
    if tenant_id not in _woo_configs:
        raise HTTPException(status_code=400, detail="WooCommerce not connected")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    connector = WooCommerceConnector(
        _woo_configs[tenant_id],
        tenant_id,
        get_erpnext_adapter()
    )
    
    try:
        orders = await connector.get_orders(status=request.status or "any")
        
        results = []
        for order in orders:
            if request.order_ids and order.id not in request.order_ids:
                continue
            
            sales_order = await connector.import_order_to_erpnext(order)
            results.append({
                "woo_order": order.number,
                "success": sales_order is not None,
                "erpnext_order": sales_order
            })
        
        return {
            "imported": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"]),
            "results": results
        }
    finally:
        await connector.close()


@router.post("/woocommerce/inventory/sync-all")
async def sync_all_woocommerce_inventory(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Sync all inventory to WooCommerce"""
    if tenant_id not in _woo_configs:
        raise HTTPException(status_code=400, detail="WooCommerce not connected")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    connector = WooCommerceConnector(
        _woo_configs[tenant_id],
        tenant_id,
        get_erpnext_adapter()
    )
    
    try:
        result = await connector.sync_all_inventory()
        return result
    finally:
        await connector.close()


# ==================== Multi-Channel Inventory Endpoints ====================

@router.get("/inventory/{item_code}")
async def get_multichannel_inventory(
    item_code: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get inventory across all channels"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = MultiChannelInventoryService(
        db, tenant_id, get_erpnext_adapter()
    )
    
    total = await service.get_total_inventory(item_code)
    by_channel = await service.get_all_channel_inventory(item_code)
    
    return {
        "item_code": item_code,
        "total": total,
        "by_channel": {
            channel.value: {
                "total_allocated": inv.total_allocated,
                "available": inv.available,
                "reserved": inv.reserved
            }
            for channel, inv in by_channel.items()
        }
    }


@router.get("/inventory/{item_code}/channel/{channel}")
async def get_channel_inventory(
    item_code: str,
    channel: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get inventory for a specific channel"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    try:
        sales_channel = SalesChannel(channel)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}")
    
    service = MultiChannelInventoryService(
        db, tenant_id, get_erpnext_adapter()
    )
    
    inv = await service.get_channel_inventory(item_code, sales_channel)
    
    return ChannelInventoryResponse(
        channel=inv.channel.value,
        item_code=inv.item_code,
        total_allocated=inv.total_allocated,
        available=inv.available,
        reserved=inv.reserved,
        pending_sync=inv.pending_sync
    )


@router.post("/inventory/allocations")
async def set_inventory_allocation(
    request: InventoryAllocationRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Set inventory allocation for a channel"""
    try:
        sales_channel = SalesChannel(request.channel)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {request.channel}")
    
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = MultiChannelInventoryService(
        db, tenant_id, get_erpnext_adapter()
    )
    
    service.set_allocation(
        item_code=request.item_code,
        channel=sales_channel,
        allocation_type=request.allocation_type,
        value=request.value,
        min_buffer=request.min_buffer,
        priority=request.priority
    )
    
    return {"message": "Allocation set successfully"}


@router.post("/inventory/sync")
async def sync_inventory_to_channels(
    item_codes: Optional[List[str]] = None,
    channels: Optional[List[str]] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Sync inventory to specified channels"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = MultiChannelInventoryService(
        db, tenant_id, get_erpnext_adapter()
    )
    
    # Register connected connectors
    if tenant_id in _shopify_configs:
        connector = ShopifyConnector(
            _shopify_configs[tenant_id],
            tenant_id,
            get_erpnext_adapter()
        )
        service.register_connector(SalesChannel.SHOPIFY, connector)
    
    if tenant_id in _woo_configs:
        connector = WooCommerceConnector(
            _woo_configs[tenant_id],
            tenant_id,
            get_erpnext_adapter()
        )
        service.register_connector(SalesChannel.WOOCOMMERCE, connector)
    
    result = await service.sync_all_channels(item_codes)
    
    return result


@router.get("/inventory/low-stock")
async def get_low_stock_items(
    threshold: int = Query(10, ge=1),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get items with low stock"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = MultiChannelInventoryService(
        db, tenant_id, get_erpnext_adapter()
    )
    
    items = await service.get_low_stock_items(threshold)
    return {"low_stock_items": items, "threshold": threshold}


@router.get("/channels")
async def get_available_channels():
    """Get list of available sales channels"""
    return {
        "channels": [
            {"value": c.value, "label": c.value.replace("_", " ").title()}
            for c in SalesChannel
        ]
    }
