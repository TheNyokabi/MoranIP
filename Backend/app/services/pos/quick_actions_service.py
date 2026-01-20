"""
Quick Actions Service for PoS
Provides fast access to frequently used items, customers, and operations
"""
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import logging
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

# Constants
SALES_INVOICE_DOCTYPE = "resource/Sales Invoice"
WALK_IN_CUSTOMER = "Walk-in Customer"
DEFAULT_FREQUENT_ITEMS_LIMIT = 20
DEFAULT_RECENT_CUSTOMERS_LIMIT = 10
DEFAULT_SEARCH_LIMIT = 50
DEFAULT_DAYS_BACK_FREQUENT = 30
DEFAULT_DAYS_BACK_RECENT = 7


class QuickActionsService:
    """Service for quick POS actions and frequently used data"""

    def __init__(self, erpnext_adapter, redis_client=None, tenant_id: str = None):
        """
        Initialize Quick Actions Service

        Args:
            erpnext_adapter: ERPNext client adapter
            redis_client: Redis client for caching (optional)
            tenant_id: Tenant identifier
        """
        self.erpnext_adapter = erpnext_adapter
        self.redis_client = redis_client
        self.tenant_id = tenant_id

    async def get_frequent_items(
        self,
        pos_profile_id: str,
        limit: int = DEFAULT_FREQUENT_ITEMS_LIMIT,
        days_back: int = DEFAULT_DAYS_BACK_FREQUENT
    ) -> List[Dict[str, Any]]:
        """
        Get frequently sold items for a POS profile

        Args:
            pos_profile_id: POS profile identifier
            limit: Maximum number of items to return
            days_back: Number of days to look back for sales data

        Returns:
            List of frequently sold items with sales frequency
        """
        cache_key = f"pos:frequent_items:{pos_profile_id}:{days_back}"

        # Try cache first
        if self.redis_client:
            cached = await self._get_cached_data(cache_key)
            if cached:
                return cached

        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)

            # Query sales invoices for the POS profile
            sales_data = await self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=SALES_INVOICE_DOCTYPE,
                method="GET",
                params={
                    "filters": json.dumps([
                        ["posting_date", ">=", start_date.strftime("%Y-%m-%d")],
                        ["posting_date", "<=", end_date.strftime("%Y-%m-%d")],
                        ["pos_profile", "=", pos_profile_id],
                        ["docstatus", "=", 1]  # Only submitted invoices
                    ]),
                    "fields": '["name", "items"]',
                    "limit_page_length": 1000
                }
            )

            # Count item frequencies
            item_counter = Counter()
            for invoice in sales_data.get("data", []):
                for item in invoice.get("items", []):
                    item_code = item.get("item_code")
                    qty = item.get("qty", 0)
                    if item_code and qty > 0:
                        item_counter[item_code] += qty

            # Get top items with details
            frequent_items = []
            for item_code, total_qty in item_counter.most_common(limit):
                try:
                    item_details = await self.erpnext_adapter.proxy_request(
                        tenant_id=self.tenant_id,
                        path=f"resource/Item/{item_code}",
                        method="GET",
                        params={"fields": '["item_code", "item_name", "standard_rate", "image"]'}
                    )

                    if item_details and item_details.get("data"):
                        item_data = item_details["data"]
                        frequent_items.append({
                            "item_code": item_code,
                            "item_name": item_data.get("item_name", ""),
                            "standard_rate": item_data.get("standard_rate", 0),
                            "image": item_data.get("image"),
                            "total_sold_qty": total_qty,
                            "frequency_rank": len(frequent_items) + 1
                        })
                except Exception as e:
                    logger.warning(f"Failed to get details for item {item_code}: {e}")
                    continue

            # Cache the results
            if self.redis_client:
                await self._cache_data(cache_key, frequent_items, ttl=3600)  # 1 hour

            return frequent_items

        except Exception as e:
            logger.error(f"Failed to get frequent items for profile {pos_profile_id}: {e}")
            return []

    async def get_recent_customers(
        self,
        pos_profile_id: str,
        limit: int = DEFAULT_RECENT_CUSTOMERS_LIMIT,
        days_back: int = DEFAULT_DAYS_BACK_RECENT
    ) -> List[Dict[str, Any]]:
        """
        Get recently active customers for a POS profile

        Args:
            pos_profile_id: POS profile identifier
            limit: Maximum number of customers to return
            days_back: Number of days to look back

        Returns:
            List of recent customers with last purchase info
        """
        cache_key = f"pos:recent_customers:{pos_profile_id}:{days_back}"

        # Try cache first
        if self.redis_client:
            cached = await self._get_cached_data(cache_key)
            if cached:
                return cached

        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)

            # Query recent sales invoices
            sales_data = await self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=SALES_INVOICE_DOCTYPE,
                method="GET",
                params={
                    "filters": json.dumps([
                        ["posting_date", ">=", start_date.strftime("%Y-%m-%d")],
                        ["posting_date", "<=", end_date.strftime("%Y-%m-%d")],
                        ["pos_profile", "=", pos_profile_id],
                        ["docstatus", "=", 1]
                    ]),
                    "fields": '["customer", "posting_date", "grand_total"]',
                    "order_by": "posting_date desc",
                    "limit_page_length": 500
                }
            )

            # Group by customer and get latest purchase
            customer_purchases = {}
            for invoice in sales_data.get("data", []):
                customer = invoice.get("customer")
                if customer and customer != "Walk-in Customer":
                    if customer not in customer_purchases:
                        customer_purchases[customer] = {
                            "customer": customer,
                            "last_purchase_date": invoice.get("posting_date"),
                            "last_amount": invoice.get("grand_total", 0),
                            "purchase_count": 1
                        }
                    else:
                        customer_purchases[customer]["purchase_count"] += 1

            # Sort by most recent and convert to list
            recent_customers = sorted(
                customer_purchases.values(),
                key=lambda x: x["last_purchase_date"],
                reverse=True
            )[:limit]

            # Get customer details
            for customer in recent_customers:
                try:
                    customer_details = await self.erpnext_adapter.proxy_request(
                        tenant_id=self.tenant_id,
                        path=f"resource/Customer/{customer['customer']}",
                        method="GET",
                        params={"fields": '["customer_name", "customer_type", "phone", "email"]'}
                    )

                    if customer_details and customer_details.get("data"):
                        cust_data = customer_details["data"]
                        customer.update({
                            "customer_name": cust_data.get("customer_name", ""),
                            "customer_type": cust_data.get("customer_type", ""),
                            "phone": cust_data.get("phone", ""),
                            "email": cust_data.get("email", "")
                        })
                except Exception as e:
                    logger.warning(f"Failed to get details for customer {customer['customer']}: {e}")

            # Cache the results
            if self.redis_client:
                await self._cache_data(cache_key, recent_customers, ttl=1800)  # 30 minutes

            return recent_customers

        except Exception as e:
            logger.error(f"Failed to get recent customers for profile {pos_profile_id}: {e}")
            return []

    async def search_items(
        self,
        query: str,
        pos_profile_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Search items by code, name, or barcode with fuzzy matching

        Args:
            query: Search query
            pos_profile_id: Optional POS profile filter
            limit: Maximum results to return

        Returns:
            List of matching items
        """
        try:
            # Build search filters
            filters = []
            if pos_profile_id:
                # Could add profile-specific filtering here if needed
                pass

            # Search by item code, name, or barcode
            search_filters = [
                ["item_code", "like", f"%{query}%"],
                ["item_name", "like", f"%{query}%"],
                ["barcode", "like", f"%{query}%"]
            ]

            all_items = []
            for search_filter in search_filters:
                try:
                    items_data = await self.erpnext_adapter.proxy_request(
                        tenant_id=self.tenant_id,
                        path="resource/Item",
                        method="GET",
                        params={
                            "filters": json.dumps([search_filter] + filters),
                            "fields": '["item_code", "item_name", "standard_rate", "barcode", "image", "stock_uom"]',
                            "limit_page_length": limit // len(search_filters) + 1
                        }
                    )

                    if items_data and items_data.get("data"):
                        all_items.extend(items_data["data"])
                except Exception as e:
                    logger.warning(f"Search failed for filter {search_filter}: {e}")

            # Remove duplicates and limit results
            seen_codes = set()
            unique_items = []
            for item in all_items:
                item_code = item.get("item_code")
                if item_code and item_code not in seen_codes:
                    seen_codes.add(item_code)
                    unique_items.append(item)
                    if len(unique_items) >= limit:
                        break

            return unique_items

        except Exception as e:
            logger.error(f"Failed to search items with query '{query}': {e}")
            return []

    def get_quick_sale_preset(
        self,
        preset_id: str,
        pos_profile_id: str  # Reserved for future profile-specific presets
    ) -> Optional[Dict[str, Any]]:
        """
        Get a pre-configured quick sale preset

        Args:
            preset_id: Preset identifier
            pos_profile_id: POS profile identifier

        Returns:
            Preset configuration or None
        """
        # This could be stored in database or configuration
        # For now, return some common presets
        presets = {
            "coffee_small": {
                "name": "Small Coffee",
                "items": [{"item_code": "COFFEE-S", "qty": 1}],
                "customer": WALK_IN_CUSTOMER
            },
            "coffee_large": {
                "name": "Large Coffee",
                "items": [{"item_code": "COFFEE-L", "qty": 1}],
                "customer": WALK_IN_CUSTOMER
            }
        }

        return presets.get(preset_id)

    async def repeat_last_sale(
        self,
        customer: str,
        pos_profile_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get the last sale for a customer to repeat

        Args:
            customer: Customer name
            pos_profile_id: POS profile identifier

        Returns:
            Last sale data or None
        """
        try:
            # Get customer's last invoice
            sales_data = await self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=SALES_INVOICE_DOCTYPE,
                method="GET",
                params={
                    "filters": json.dumps([
                        ["customer", "=", customer],
                        ["pos_profile", "=", pos_profile_id],
                        ["docstatus", "=", 1]
                    ]),
                    "fields": '["name", "items", "posting_date"]',
                    "order_by": "posting_date desc",
                    "limit_page_length": 1
                }
            )

            if sales_data and sales_data.get("data"):
                last_sale = sales_data["data"][0]
                return {
                    "invoice_name": last_sale.get("name"),
                    "posting_date": last_sale.get("posting_date"),
                    "items": [
                        {
                            "item_code": item.get("item_code"),
                            "qty": item.get("qty", 1),
                            "rate": item.get("rate", 0)
                        }
                        for item in last_sale.get("items", [])
                    ]
                }

        except Exception as e:
            logger.error(f"Failed to get last sale for customer {customer}: {e}")

        return None

    async def _get_cached_data(self, key: str) -> Optional[Any]:
        """Get data from Redis cache"""
        if not self.redis_client:
            return None

        try:
            data = await self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.warning(f"Cache read failed for key {key}: {e}")
            return None

    async def _cache_data(self, key: str, data: Any, ttl: int = 3600):
        """Cache data in Redis"""
        if not self.redis_client:
            return

        try:
            await self.redis_client.setex(key, ttl, json.dumps(data))
        except Exception as e:
            logger.warning(f"Cache write failed for key {key}: {e}")