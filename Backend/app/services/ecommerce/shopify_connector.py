"""
Shopify E-commerce Connector

Provides:
- Product sync (from ERPNext to Shopify and vice versa)
- Order import (Shopify orders -> ERPNext Sales Orders)
- Inventory sync
- Price list sync
- Customer sync
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class SyncDirection(str, Enum):
    TO_SHOPIFY = "to_shopify"
    FROM_SHOPIFY = "from_shopify"
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ShopifyConfig:
    """Shopify store configuration"""
    store_name: str  # e.g., "my-store" from my-store.myshopify.com
    access_token: str
    api_version: str = "2024-01"
    
    @property
    def base_url(self) -> str:
        return f"https://{self.store_name}.myshopify.com/admin/api/{self.api_version}"


class ShopifyProduct(BaseModel):
    """Shopify product representation"""
    id: Optional[int] = None
    title: str
    body_html: Optional[str] = None
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    handle: Optional[str] = None
    status: str = "active"  # active, archived, draft
    tags: List[str] = []
    variants: List[Dict[str, Any]] = []
    images: List[Dict[str, Any]] = []
    options: List[Dict[str, Any]] = []


class ShopifyOrder(BaseModel):
    """Shopify order representation"""
    id: int
    name: str  # Order number like #1001
    email: Optional[str] = None
    created_at: str
    financial_status: str
    fulfillment_status: Optional[str] = None
    total_price: str
    currency: str
    line_items: List[Dict[str, Any]] = []
    customer: Optional[Dict[str, Any]] = None
    shipping_address: Optional[Dict[str, Any]] = None
    billing_address: Optional[Dict[str, Any]] = None


class ShopifyConnector:
    """Connector for Shopify e-commerce platform"""
    
    def __init__(self, config: ShopifyConfig, tenant_id: str, erpnext_adapter=None):
        self.config = config
        self.tenant_id = tenant_id
        self.erpnext_adapter = erpnext_adapter
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                headers={
                    "X-Shopify-Access-Token": self.config.access_token,
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # ==================== Product Sync ====================
    
    async def get_products(
        self,
        limit: int = 50,
        since_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[ShopifyProduct]:
        """Get products from Shopify"""
        params = {"limit": limit}
        if since_id:
            params["since_id"] = since_id
        if status:
            params["status"] = status
        
        try:
            response = await self.client.get("/products.json", params=params)
            response.raise_for_status()
            data = response.json()
            
            return [ShopifyProduct(**p) for p in data.get("products", [])]
        except Exception as e:
            logger.error(f"Error fetching Shopify products: {e}")
            return []
    
    async def get_product(self, product_id: int) -> Optional[ShopifyProduct]:
        """Get a single product from Shopify"""
        try:
            response = await self.client.get(f"/products/{product_id}.json")
            response.raise_for_status()
            data = response.json()
            return ShopifyProduct(**data.get("product", {}))
        except Exception as e:
            logger.error(f"Error fetching Shopify product {product_id}: {e}")
            return None
    
    async def create_product(self, product: ShopifyProduct) -> Optional[Dict[str, Any]]:
        """Create a product in Shopify"""
        payload = {
            "product": {
                "title": product.title,
                "body_html": product.body_html,
                "vendor": product.vendor,
                "product_type": product.product_type,
                "status": product.status,
                "tags": ",".join(product.tags),
                "variants": product.variants,
                "images": product.images
            }
        }
        
        try:
            response = await self.client.post("/products.json", json=payload)
            response.raise_for_status()
            return response.json().get("product")
        except httpx.HTTPStatusError as e:
            logger.error(f"Error creating Shopify product: {e.response.text}")
            return None
    
    async def update_product(
        self,
        product_id: int,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a product in Shopify"""
        payload = {"product": updates}
        
        try:
            response = await self.client.put(
                f"/products/{product_id}.json",
                json=payload
            )
            response.raise_for_status()
            return response.json().get("product")
        except Exception as e:
            logger.error(f"Error updating Shopify product: {e}")
            return None
    
    async def sync_product_to_shopify(
        self,
        item_code: str
    ) -> Optional[Dict[str, Any]]:
        """Sync an ERPNext item to Shopify"""
        if not self.erpnext_adapter:
            return None
        
        try:
            # Get item from ERPNext
            item = self.erpnext_adapter.get_resource(
                tenant_id=self.tenant_id,
                doctype="Item",
                name=item_code
            )
            
            if not item.get("data"):
                return None
            
            item_data = item["data"]
            
            # Get price
            price = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Item Price",
                fields=["price_list_rate"],
                filters=[
                    ["item_code", "=", item_code],
                    ["selling", "=", 1]
                ],
                limit=1
            )
            
            price_value = "0.00"
            if price.get("data"):
                price_value = str(price["data"][0].get("price_list_rate", 0))
            
            # Build Shopify product
            product = ShopifyProduct(
                title=item_data.get("item_name", item_code),
                body_html=item_data.get("description", ""),
                vendor=item_data.get("brand", ""),
                product_type=item_data.get("item_group", ""),
                status="active" if not item_data.get("disabled") else "archived",
                variants=[{
                    "sku": item_code,
                    "price": price_value,
                    "inventory_management": "shopify",
                    "requires_shipping": True
                }]
            )
            
            # Check if product exists
            # TODO: Store mapping in database
            
            result = await self.create_product(product)
            
            if result:
                logger.info(f"Synced item {item_code} to Shopify as {result.get('id')}")
            
            return result
        
        except Exception as e:
            logger.error(f"Error syncing product to Shopify: {e}")
            return None
    
    # ==================== Inventory Sync ====================
    
    async def get_inventory_levels(
        self,
        location_id: int,
        inventory_item_ids: Optional[List[int]] = None
    ) -> List[Dict[str, Any]]:
        """Get inventory levels from Shopify"""
        params = {"location_ids": location_id}
        if inventory_item_ids:
            params["inventory_item_ids"] = ",".join(map(str, inventory_item_ids))
        
        try:
            response = await self.client.get(
                "/inventory_levels.json",
                params=params
            )
            response.raise_for_status()
            return response.json().get("inventory_levels", [])
        except Exception as e:
            logger.error(f"Error fetching inventory levels: {e}")
            return []
    
    async def update_inventory_level(
        self,
        location_id: int,
        inventory_item_id: int,
        available: int
    ) -> bool:
        """Set inventory level in Shopify"""
        payload = {
            "location_id": location_id,
            "inventory_item_id": inventory_item_id,
            "available": available
        }
        
        try:
            response = await self.client.post(
                "/inventory_levels/set.json",
                json=payload
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Error updating inventory level: {e}")
            return False
    
    async def sync_inventory_to_shopify(
        self,
        item_code: str,
        shopify_product_id: int,
        shopify_location_id: int
    ) -> bool:
        """Sync ERPNext stock to Shopify"""
        if not self.erpnext_adapter:
            return False
        
        try:
            # Get stock from ERPNext
            bins = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["actual_qty", "reserved_qty"],
                filters=[["item_code", "=", item_code]],
                limit=100
            )
            
            total_available = 0
            for bin_data in bins.get("data", []):
                actual = bin_data.get("actual_qty", 0)
                reserved = bin_data.get("reserved_qty", 0)
                total_available += max(0, actual - reserved)
            
            # Get inventory item ID from Shopify
            product = await self.get_product(shopify_product_id)
            if not product or not product.variants:
                return False
            
            inventory_item_id = product.variants[0].get("inventory_item_id")
            if not inventory_item_id:
                return False
            
            return await self.update_inventory_level(
                location_id=shopify_location_id,
                inventory_item_id=inventory_item_id,
                available=int(total_available)
            )
        
        except Exception as e:
            logger.error(f"Error syncing inventory: {e}")
            return False
    
    # ==================== Order Import ====================
    
    async def get_orders(
        self,
        status: str = "any",
        since_id: Optional[int] = None,
        limit: int = 50,
        financial_status: Optional[str] = None
    ) -> List[ShopifyOrder]:
        """Get orders from Shopify"""
        params = {
            "status": status,
            "limit": limit
        }
        if since_id:
            params["since_id"] = since_id
        if financial_status:
            params["financial_status"] = financial_status
        
        try:
            response = await self.client.get("/orders.json", params=params)
            response.raise_for_status()
            data = response.json()
            
            return [ShopifyOrder(**o) for o in data.get("orders", [])]
        except Exception as e:
            logger.error(f"Error fetching Shopify orders: {e}")
            return []
    
    async def import_order_to_erpnext(
        self,
        order: ShopifyOrder,
        customer_mapping: Optional[Dict[str, str]] = None,
        item_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Import a Shopify order as ERPNext Sales Order"""
        if not self.erpnext_adapter:
            return None
        
        try:
            # Determine customer
            customer_id = None
            if order.customer:
                email = order.customer.get("email")
                if customer_mapping and email in customer_mapping:
                    customer_id = customer_mapping[email]
                else:
                    # Try to find or create customer
                    customer_id = await self._get_or_create_customer(order.customer)
            
            if not customer_id:
                customer_id = "Walk-in Customer"  # Default
            
            # Build items
            items = []
            for line_item in order.line_items:
                sku = line_item.get("sku")
                item_code = sku
                
                if item_mapping and sku in item_mapping:
                    item_code = item_mapping[sku]
                
                items.append({
                    "item_code": item_code,
                    "qty": line_item.get("quantity", 1),
                    "rate": float(line_item.get("price", 0)),
                    "description": line_item.get("title", "")
                })
            
            # Create Sales Order
            order_data = {
                "doctype": "Sales Order",
                "customer": customer_id,
                "order_type": "Shopping Cart",
                "transaction_date": order.created_at[:10],
                "po_no": order.name,  # Shopify order number
                "items": items,
                "source": f"Shopify Order {order.id}"
            }
            
            # Add shipping address
            if order.shipping_address:
                order_data["shipping_address_name"] = self._format_address(
                    order.shipping_address
                )
            
            result = self.erpnext_adapter.create_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Order",
                data=order_data
            )
            
            if result.get("data"):
                order_name = result["data"].get("name")
                logger.info(f"Imported Shopify order {order.name} as {order_name}")
                return order_name
            
            return None
        
        except Exception as e:
            logger.error(f"Error importing order: {e}")
            return None
    
    async def _get_or_create_customer(
        self,
        shopify_customer: Dict[str, Any]
    ) -> Optional[str]:
        """Get or create ERPNext customer from Shopify customer"""
        if not self.erpnext_adapter:
            return None
        
        email = shopify_customer.get("email")
        
        # Try to find existing customer
        existing = self.erpnext_adapter.list_resource(
            tenant_id=self.tenant_id,
            doctype="Customer",
            fields=["name"],
            filters=[["email_id", "=", email]],
            limit=1
        )
        
        if existing.get("data"):
            return existing["data"][0].get("name")
        
        # Create new customer
        customer_name = f"{shopify_customer.get('first_name', '')} {shopify_customer.get('last_name', '')}".strip()
        if not customer_name:
            customer_name = email.split("@")[0] if email else "Unknown"
        
        result = self.erpnext_adapter.create_resource(
            tenant_id=self.tenant_id,
            doctype="Customer",
            data={
                "doctype": "Customer",
                "customer_name": customer_name,
                "customer_type": "Individual",
                "email_id": email,
                "mobile_no": shopify_customer.get("phone")
            }
        )
        
        if result.get("data"):
            return result["data"].get("name")
        
        return None
    
    def _format_address(self, address: Dict[str, Any]) -> str:
        """Format Shopify address for ERPNext"""
        parts = [
            address.get("address1", ""),
            address.get("address2", ""),
            address.get("city", ""),
            address.get("province", ""),
            address.get("zip", ""),
            address.get("country", "")
        ]
        return ", ".join(p for p in parts if p)
    
    # ==================== Webhook Registration ====================
    
    async def register_webhooks(self, callback_url: str) -> List[Dict[str, Any]]:
        """Register webhooks for real-time updates"""
        topics = [
            "orders/create",
            "orders/updated",
            "products/update",
            "inventory_levels/update"
        ]
        
        registered = []
        
        for topic in topics:
            try:
                response = await self.client.post(
                    "/webhooks.json",
                    json={
                        "webhook": {
                            "topic": topic,
                            "address": f"{callback_url}/shopify/webhook",
                            "format": "json"
                        }
                    }
                )
                response.raise_for_status()
                registered.append(response.json().get("webhook"))
            except Exception as e:
                logger.error(f"Error registering webhook {topic}: {e}")
        
        return registered
    
    async def get_webhooks(self) -> List[Dict[str, Any]]:
        """Get registered webhooks"""
        try:
            response = await self.client.get("/webhooks.json")
            response.raise_for_status()
            return response.json().get("webhooks", [])
        except Exception as e:
            logger.error(f"Error fetching webhooks: {e}")
            return []
