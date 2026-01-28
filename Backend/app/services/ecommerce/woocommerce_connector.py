"""
WooCommerce E-commerce Connector

Provides:
- Product sync (bidirectional)
- Order import
- Inventory sync
- Price sync
- Customer sync
"""

import logging
import base64
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


@dataclass
class WooCommerceConfig:
    """WooCommerce store configuration"""
    store_url: str  # e.g., https://mystore.com
    consumer_key: str
    consumer_secret: str
    api_version: str = "wc/v3"
    
    @property
    def base_url(self) -> str:
        return f"{self.store_url.rstrip('/')}/wp-json/{self.api_version}"
    
    @property
    def auth_header(self) -> str:
        credentials = f"{self.consumer_key}:{self.consumer_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"


class WooProduct(BaseModel):
    """WooCommerce product representation"""
    id: Optional[int] = None
    name: str
    slug: Optional[str] = None
    type: str = "simple"
    status: str = "publish"
    description: Optional[str] = None
    short_description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[str] = None
    regular_price: Optional[str] = None
    sale_price: Optional[str] = None
    manage_stock: bool = True
    stock_quantity: Optional[int] = None
    stock_status: str = "instock"
    categories: List[Dict[str, Any]] = []
    images: List[Dict[str, Any]] = []
    attributes: List[Dict[str, Any]] = []


class WooOrder(BaseModel):
    """WooCommerce order representation"""
    id: int
    number: str
    status: str
    date_created: str
    total: str
    currency: str
    billing: Dict[str, Any] = {}
    shipping: Dict[str, Any] = {}
    line_items: List[Dict[str, Any]] = []
    customer_id: int = 0
    customer_note: Optional[str] = None
    payment_method: Optional[str] = None
    payment_method_title: Optional[str] = None


class WooCommerceConnector:
    """Connector for WooCommerce platform"""
    
    def __init__(self, config: WooCommerceConfig, tenant_id: str, erpnext_adapter=None):
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
                    "Authorization": self.config.auth_header,
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
        per_page: int = 50,
        page: int = 1,
        status: Optional[str] = None
    ) -> List[WooProduct]:
        """Get products from WooCommerce"""
        params = {"per_page": per_page, "page": page}
        if status:
            params["status"] = status
        
        try:
            response = await self.client.get("/products", params=params)
            response.raise_for_status()
            return [WooProduct(**p) for p in response.json()]
        except Exception as e:
            logger.error(f"Error fetching WooCommerce products: {e}")
            return []
    
    async def get_product(self, product_id: int) -> Optional[WooProduct]:
        """Get a single product from WooCommerce"""
        try:
            response = await self.client.get(f"/products/{product_id}")
            response.raise_for_status()
            return WooProduct(**response.json())
        except Exception as e:
            logger.error(f"Error fetching WooCommerce product {product_id}: {e}")
            return None
    
    async def get_product_by_sku(self, sku: str) -> Optional[WooProduct]:
        """Get product by SKU"""
        try:
            response = await self.client.get("/products", params={"sku": sku})
            response.raise_for_status()
            products = response.json()
            if products:
                return WooProduct(**products[0])
            return None
        except Exception as e:
            logger.error(f"Error fetching product by SKU {sku}: {e}")
            return None
    
    async def create_product(self, product: WooProduct) -> Optional[Dict[str, Any]]:
        """Create a product in WooCommerce"""
        payload = {
            "name": product.name,
            "type": product.type,
            "status": product.status,
            "description": product.description or "",
            "short_description": product.short_description or "",
            "sku": product.sku,
            "regular_price": product.regular_price or product.price or "0",
            "manage_stock": product.manage_stock,
            "stock_quantity": product.stock_quantity,
            "categories": product.categories,
            "images": product.images
        }
        
        try:
            response = await self.client.post("/products", json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Error creating WooCommerce product: {e.response.text}")
            return None
    
    async def update_product(
        self,
        product_id: int,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a product in WooCommerce"""
        try:
            response = await self.client.put(
                f"/products/{product_id}",
                json=updates
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error updating WooCommerce product: {e}")
            return None
    
    async def sync_product_to_woocommerce(
        self,
        item_code: str
    ) -> Optional[Dict[str, Any]]:
        """Sync an ERPNext item to WooCommerce"""
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
            price_list = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Item Price",
                fields=["price_list_rate"],
                filters=[
                    ["item_code", "=", item_code],
                    ["selling", "=", 1]
                ],
                limit=1
            )
            
            price = "0"
            if price_list.get("data"):
                price = str(price_list["data"][0].get("price_list_rate", 0))
            
            # Get stock
            bins = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["actual_qty", "reserved_qty"],
                filters=[["item_code", "=", item_code]],
                limit=100
            )
            
            total_stock = 0
            for bin_data in bins.get("data", []):
                actual = bin_data.get("actual_qty", 0)
                reserved = bin_data.get("reserved_qty", 0)
                total_stock += max(0, actual - reserved)
            
            # Check if product exists in WooCommerce
            existing = await self.get_product_by_sku(item_code)
            
            if existing:
                # Update existing
                return await self.update_product(existing.id, {
                    "name": item_data.get("item_name", item_code),
                    "description": item_data.get("description", ""),
                    "regular_price": price,
                    "stock_quantity": int(total_stock),
                    "stock_status": "instock" if total_stock > 0 else "outofstock"
                })
            else:
                # Create new
                product = WooProduct(
                    name=item_data.get("item_name", item_code),
                    sku=item_code,
                    description=item_data.get("description", ""),
                    regular_price=price,
                    manage_stock=True,
                    stock_quantity=int(total_stock),
                    stock_status="instock" if total_stock > 0 else "outofstock",
                    status="publish" if not item_data.get("disabled") else "draft"
                )
                return await self.create_product(product)
        
        except Exception as e:
            logger.error(f"Error syncing product to WooCommerce: {e}")
            return None
    
    # ==================== Inventory Sync ====================
    
    async def update_stock(
        self,
        product_id: int,
        quantity: int
    ) -> bool:
        """Update product stock in WooCommerce"""
        try:
            result = await self.update_product(product_id, {
                "stock_quantity": quantity,
                "stock_status": "instock" if quantity > 0 else "outofstock"
            })
            return result is not None
        except Exception as e:
            logger.error(f"Error updating stock: {e}")
            return False
    
    async def sync_all_inventory(self) -> Dict[str, Any]:
        """Sync all inventory from ERPNext to WooCommerce"""
        if not self.erpnext_adapter:
            return {"success": False, "error": "No ERPNext adapter"}
        
        synced = 0
        failed = 0
        
        # Get all WooCommerce products
        page = 1
        while True:
            products = await self.get_products(per_page=100, page=page)
            if not products:
                break
            
            for product in products:
                if product.sku:
                    # Get stock from ERPNext
                    bins = self.erpnext_adapter.list_resource(
                        tenant_id=self.tenant_id,
                        doctype="Bin",
                        fields=["actual_qty", "reserved_qty"],
                        filters=[["item_code", "=", product.sku]],
                        limit=100
                    )
                    
                    total_stock = 0
                    for bin_data in bins.get("data", []):
                        actual = bin_data.get("actual_qty", 0)
                        reserved = bin_data.get("reserved_qty", 0)
                        total_stock += max(0, actual - reserved)
                    
                    if await self.update_stock(product.id, int(total_stock)):
                        synced += 1
                    else:
                        failed += 1
            
            page += 1
        
        return {
            "success": True,
            "synced": synced,
            "failed": failed
        }
    
    # ==================== Order Import ====================
    
    async def get_orders(
        self,
        status: str = "any",
        per_page: int = 50,
        page: int = 1,
        after: Optional[str] = None
    ) -> List[WooOrder]:
        """Get orders from WooCommerce"""
        params = {"per_page": per_page, "page": page}
        if status != "any":
            params["status"] = status
        if after:
            params["after"] = after
        
        try:
            response = await self.client.get("/orders", params=params)
            response.raise_for_status()
            return [WooOrder(**o) for o in response.json()]
        except Exception as e:
            logger.error(f"Error fetching WooCommerce orders: {e}")
            return []
    
    async def get_order(self, order_id: int) -> Optional[WooOrder]:
        """Get a single order from WooCommerce"""
        try:
            response = await self.client.get(f"/orders/{order_id}")
            response.raise_for_status()
            return WooOrder(**response.json())
        except Exception as e:
            logger.error(f"Error fetching order {order_id}: {e}")
            return None
    
    async def update_order_status(
        self,
        order_id: int,
        status: str
    ) -> bool:
        """Update order status in WooCommerce"""
        try:
            response = await self.client.put(
                f"/orders/{order_id}",
                json={"status": status}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Error updating order status: {e}")
            return False
    
    async def import_order_to_erpnext(
        self,
        order: WooOrder,
        item_mapping: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """Import a WooCommerce order as ERPNext Sales Order"""
        if not self.erpnext_adapter:
            return None
        
        try:
            # Get or create customer
            customer_id = await self._get_or_create_customer(order)
            if not customer_id:
                customer_id = "Walk-in Customer"
            
            # Build items
            items = []
            for line_item in order.line_items:
                sku = line_item.get("sku")
                item_code = sku
                
                if item_mapping and sku in item_mapping:
                    item_code = item_mapping[sku]
                
                if not item_code:
                    item_code = line_item.get("product_id")
                
                items.append({
                    "item_code": str(item_code),
                    "qty": line_item.get("quantity", 1),
                    "rate": float(line_item.get("price", 0)),
                    "description": line_item.get("name", "")
                })
            
            # Create Sales Order
            order_data = {
                "doctype": "Sales Order",
                "customer": customer_id,
                "order_type": "Shopping Cart",
                "transaction_date": order.date_created[:10],
                "po_no": f"WC-{order.number}",
                "items": items,
                "source": f"WooCommerce Order {order.id}"
            }
            
            # Add notes
            if order.customer_note:
                order_data["notes"] = order.customer_note
            
            result = self.erpnext_adapter.create_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Order",
                data=order_data
            )
            
            if result.get("data"):
                order_name = result["data"].get("name")
                logger.info(f"Imported WooCommerce order {order.number} as {order_name}")
                return order_name
            
            return None
        
        except Exception as e:
            logger.error(f"Error importing order: {e}")
            return None
    
    async def _get_or_create_customer(self, order: WooOrder) -> Optional[str]:
        """Get or create ERPNext customer from WooCommerce order"""
        if not self.erpnext_adapter:
            return None
        
        billing = order.billing
        email = billing.get("email")
        
        if not email:
            return None
        
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
        customer_name = f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip()
        if not customer_name:
            customer_name = email.split("@")[0]
        
        result = self.erpnext_adapter.create_resource(
            tenant_id=self.tenant_id,
            doctype="Customer",
            data={
                "doctype": "Customer",
                "customer_name": customer_name,
                "customer_type": "Individual",
                "email_id": email,
                "mobile_no": billing.get("phone")
            }
        )
        
        if result.get("data"):
            return result["data"].get("name")
        
        return None
    
    # ==================== Webhooks ====================
    
    async def create_webhook(
        self,
        topic: str,
        delivery_url: str
    ) -> Optional[Dict[str, Any]]:
        """Create a webhook in WooCommerce"""
        payload = {
            "name": f"MoranERP - {topic}",
            "topic": topic,
            "delivery_url": delivery_url,
            "status": "active"
        }
        
        try:
            response = await self.client.post("/webhooks", json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error creating webhook: {e}")
            return None
    
    async def register_webhooks(self, callback_url: str) -> List[Dict[str, Any]]:
        """Register webhooks for real-time updates"""
        topics = [
            "order.created",
            "order.updated",
            "product.updated",
            "product.deleted"
        ]
        
        registered = []
        
        for topic in topics:
            webhook = await self.create_webhook(
                topic=topic,
                delivery_url=f"{callback_url}/woocommerce/webhook"
            )
            if webhook:
                registered.append(webhook)
        
        return registered
    
    async def get_webhooks(self) -> List[Dict[str, Any]]:
        """Get registered webhooks"""
        try:
            response = await self.client.get("/webhooks")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching webhooks: {e}")
            return []
