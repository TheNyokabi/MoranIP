"""
AI-Powered Recommendation Service

Provides:
- Product recommendations (upsell/cross-sell)
- Customer-specific recommendations
- Demand forecasting
- Pricing suggestions
- Inventory optimization suggestions

Uses simple heuristics and can be enhanced with ML models later.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple

from sqlalchemy import func, desc, and_, or_
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class RecommendationService:
    """AI-powered recommendation service"""
    
    def __init__(self, db: Session, tenant_id: str, erpnext_adapter=None):
        self.db = db
        self.tenant_id = tenant_id
        self.erpnext_adapter = erpnext_adapter
        
        # Product associations cache (item_code -> [related_items])
        self._associations_cache: Dict[str, List[Dict]] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl = timedelta(hours=1)
    
    # ==================== Product Recommendations ====================
    
    async def get_upsell_suggestions(
        self,
        cart_items: List[str],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Suggest complementary products based on cart contents.
        Uses association rules from historical purchase data.
        """
        if not cart_items:
            return []
        
        # Get frequently bought together items
        suggestions = []
        seen_items = set(cart_items)
        
        for item_code in cart_items:
            related = await self._get_related_items(item_code)
            for rel in related:
                if rel["item_code"] not in seen_items:
                    suggestions.append(rel)
                    seen_items.add(rel["item_code"])
        
        # Sort by confidence/frequency and limit
        suggestions.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        return suggestions[:limit]
    
    async def get_customer_recommendations(
        self,
        customer_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Personalized recommendations based on customer's purchase history.
        """
        # Get customer's purchase history
        history = await self._get_customer_history(customer_id)
        
        if not history:
            # New customer - return popular items
            return await self._get_popular_items(limit)
        
        # Analyze purchase patterns
        purchased_items = set(h["item_code"] for h in history)
        item_categories = defaultdict(int)
        
        for h in history:
            category = h.get("item_group", "General")
            item_categories[category] += h.get("qty", 1)
        
        # Find items in preferred categories not yet purchased
        recommendations = []
        
        # Sort categories by preference
        preferred_categories = sorted(
            item_categories.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        for category, _ in preferred_categories[:3]:
            items = await self._get_items_in_category(category)
            for item in items:
                if item["item_code"] not in purchased_items:
                    recommendations.append({
                        **item,
                        "reason": f"Based on your interest in {category}",
                        "score": item.get("popularity", 0)
                    })
        
        # Sort by score and limit
        recommendations.sort(key=lambda x: x.get("score", 0), reverse=True)
        return recommendations[:limit]
    
    async def get_trending_items(
        self,
        days: int = 7,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get items with increasing sales trend"""
        if not self.erpnext_adapter:
            return []
        
        try:
            # Get recent sales data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Query sales data from ERPNext
            sales_data = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["item_code", "item_name", "qty", "creation"],
                filters=[
                    ["creation", ">=", start_date.isoformat()],
                    ["docstatus", "=", 1]
                ],
                limit=1000
            )
            
            # Calculate velocity (sales per day)
            item_sales = defaultdict(lambda: {"total_qty": 0, "days": set()})
            
            for sale in sales_data.get("data", []):
                item_code = sale.get("item_code")
                qty = sale.get("qty", 0)
                date = sale.get("creation", "")[:10]
                
                item_sales[item_code]["total_qty"] += qty
                item_sales[item_code]["days"].add(date)
                item_sales[item_code]["item_name"] = sale.get("item_name")
            
            # Calculate trending score
            trending = []
            for item_code, data in item_sales.items():
                velocity = data["total_qty"] / max(len(data["days"]), 1)
                trending.append({
                    "item_code": item_code,
                    "item_name": data.get("item_name", item_code),
                    "total_sold": data["total_qty"],
                    "active_days": len(data["days"]),
                    "velocity": round(velocity, 2),
                    "trending_score": velocity * len(data["days"])
                })
            
            trending.sort(key=lambda x: x["trending_score"], reverse=True)
            return trending[:limit]
        
        except Exception as e:
            logger.error(f"Error getting trending items: {e}")
            return []
    
    # ==================== Pricing Suggestions ====================
    
    async def get_pricing_suggestion(
        self,
        item_code: str,
        current_price: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        """
        Suggest optimal pricing based on:
        - Historical sales at different price points
        - Competitor pricing (if available)
        - Demand elasticity
        - Cost + margin
        """
        result = {
            "item_code": item_code,
            "current_price": float(current_price) if current_price else None,
            "suggested_price": None,
            "confidence": "low",
            "factors": []
        }
        
        if not self.erpnext_adapter:
            return result
        
        try:
            # Get item details
            item = self.erpnext_adapter.get_resource(
                tenant_id=self.tenant_id,
                doctype="Item",
                name=item_code
            )
            
            if not item.get("data"):
                return result
            
            item_data = item["data"]
            standard_rate = Decimal(str(item_data.get("standard_rate", 0)))
            valuation_rate = Decimal(str(item_data.get("valuation_rate", 0)))
            
            # Get recent sales data
            sales_data = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["rate", "qty", "creation"],
                filters=[
                    ["item_code", "=", item_code],
                    ["docstatus", "=", 1],
                    ["creation", ">=", (datetime.now() - timedelta(days=90)).isoformat()]
                ],
                limit=500
            )
            
            if not sales_data.get("data"):
                # No sales data - suggest based on cost + margin
                if valuation_rate > 0:
                    suggested = valuation_rate * Decimal("1.3")  # 30% margin
                    result["suggested_price"] = float(suggested)
                    result["factors"].append("Based on 30% margin over cost")
                    result["confidence"] = "medium"
                return result
            
            # Analyze price-volume relationship
            price_qty = defaultdict(int)
            for sale in sales_data["data"]:
                price = round(float(sale.get("rate", 0)), -1)  # Round to nearest 10
                qty = sale.get("qty", 0)
                price_qty[price] += qty
            
            # Find optimal price point (highest revenue)
            revenue_by_price = {p: p * q for p, q in price_qty.items()}
            optimal_price = max(revenue_by_price.items(), key=lambda x: x[1])[0]
            
            result["suggested_price"] = optimal_price
            result["factors"].append(f"Optimal revenue point from {len(sales_data['data'])} sales")
            result["confidence"] = "high" if len(sales_data["data"]) > 50 else "medium"
            
            # Add margin analysis
            if valuation_rate > 0:
                margin = ((Decimal(str(optimal_price)) - valuation_rate) / valuation_rate) * 100
                result["margin_percentage"] = float(margin)
                result["factors"].append(f"Margin: {float(margin):.1f}%")
            
            return result
        
        except Exception as e:
            logger.error(f"Error getting pricing suggestion: {e}")
            return result
    
    # ==================== Inventory Optimization ====================
    
    async def get_reorder_suggestions(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Suggest items to reorder based on:
        - Current stock vs reorder level
        - Sales velocity
        - Lead time
        """
        if not self.erpnext_adapter:
            return []
        
        try:
            # Get items below reorder level
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["item_code", "warehouse", "actual_qty", "reserved_qty", "ordered_qty"],
                filters=[["actual_qty", "<", 100]],  # Simplified filter
                limit=500
            )
            
            suggestions = []
            for item in items.get("data", []):
                item_code = item.get("item_code")
                actual_qty = item.get("actual_qty", 0)
                reserved_qty = item.get("reserved_qty", 0)
                ordered_qty = item.get("ordered_qty", 0)
                
                available = actual_qty - reserved_qty
                
                # Get item's reorder level
                item_detail = self.erpnext_adapter.get_resource(
                    tenant_id=self.tenant_id,
                    doctype="Item",
                    name=item_code
                )
                
                if item_detail.get("data"):
                    reorder_level = item_detail["data"].get("reorder_level", 0)
                    item_name = item_detail["data"].get("item_name", item_code)
                    
                    if available <= reorder_level and ordered_qty == 0:
                        # Calculate suggested order quantity
                        # Simple: order enough for 30 days based on recent sales
                        velocity = await self._get_sales_velocity(item_code)
                        suggested_qty = max(
                            reorder_level * 2 - available,  # Double reorder level
                            int(velocity * 30)  # 30 days supply
                        )
                        
                        suggestions.append({
                            "item_code": item_code,
                            "item_name": item_name,
                            "warehouse": item.get("warehouse"),
                            "current_stock": actual_qty,
                            "available_stock": available,
                            "reorder_level": reorder_level,
                            "pending_orders": ordered_qty,
                            "daily_velocity": round(velocity, 2),
                            "suggested_order_qty": max(suggested_qty, 1),
                            "urgency": "high" if available <= 0 else "medium" if available <= reorder_level / 2 else "low"
                        })
            
            # Sort by urgency
            urgency_order = {"high": 0, "medium": 1, "low": 2}
            suggestions.sort(key=lambda x: urgency_order.get(x["urgency"], 3))
            
            return suggestions[:limit]
        
        except Exception as e:
            logger.error(f"Error getting reorder suggestions: {e}")
            return []
    
    async def detect_slow_moving_items(
        self,
        days_threshold: int = 30,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Identify items with no or low sales"""
        if not self.erpnext_adapter:
            return []
        
        try:
            # Get all items with stock
            stock_items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["item_code", "actual_qty", "valuation_rate"],
                filters=[["actual_qty", ">", 0]],
                limit=500
            )
            
            slow_movers = []
            cutoff_date = datetime.now() - timedelta(days=days_threshold)
            
            for item in stock_items.get("data", []):
                item_code = item.get("item_code")
                qty = item.get("actual_qty", 0)
                valuation = Decimal(str(item.get("valuation_rate", 0)))
                
                # Check recent sales
                sales = self.erpnext_adapter.list_resource(
                    tenant_id=self.tenant_id,
                    doctype="Sales Invoice Item",
                    fields=["qty"],
                    filters=[
                        ["item_code", "=", item_code],
                        ["creation", ">=", cutoff_date.isoformat()],
                        ["docstatus", "=", 1]
                    ],
                    limit=10
                )
                
                total_sold = sum(s.get("qty", 0) for s in sales.get("data", []))
                
                if total_sold < qty * 0.1:  # Sold less than 10% of stock
                    stock_value = qty * valuation
                    
                    slow_movers.append({
                        "item_code": item_code,
                        "current_stock": qty,
                        "stock_value": float(stock_value),
                        "units_sold": total_sold,
                        "days_analyzed": days_threshold,
                        "sell_through_rate": round((total_sold / qty) * 100, 1) if qty > 0 else 0,
                        "recommendation": "Consider markdown or promotion"
                    })
            
            # Sort by stock value (highest first)
            slow_movers.sort(key=lambda x: x["stock_value"], reverse=True)
            return slow_movers[:limit]
        
        except Exception as e:
            logger.error(f"Error detecting slow movers: {e}")
            return []
    
    # ==================== Helper Methods ====================
    
    async def _get_related_items(self, item_code: str) -> List[Dict]:
        """Get items frequently bought together with given item"""
        # Check cache
        if self._is_cache_valid() and item_code in self._associations_cache:
            return self._associations_cache[item_code]
        
        if not self.erpnext_adapter:
            return []
        
        try:
            # Find invoices containing this item
            invoices = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["parent"],
                filters=[
                    ["item_code", "=", item_code],
                    ["docstatus", "=", 1]
                ],
                limit=100
            )
            
            invoice_ids = list(set(i.get("parent") for i in invoices.get("data", [])))
            
            if not invoice_ids:
                return []
            
            # Find other items in these invoices
            other_items = defaultdict(int)
            
            for inv_id in invoice_ids[:50]:  # Limit for performance
                items = self.erpnext_adapter.list_resource(
                    tenant_id=self.tenant_id,
                    doctype="Sales Invoice Item",
                    fields=["item_code", "item_name"],
                    filters=[["parent", "=", inv_id]],
                    limit=50
                )
                
                for item in items.get("data", []):
                    code = item.get("item_code")
                    if code != item_code:
                        other_items[code] += 1
            
            # Calculate confidence
            total_invoices = len(invoice_ids)
            related = []
            
            for code, count in other_items.items():
                confidence = count / total_invoices
                if confidence > 0.1:  # At least 10% co-occurrence
                    related.append({
                        "item_code": code,
                        "co_occurrence": count,
                        "confidence": round(confidence, 3),
                        "reason": "Frequently bought together"
                    })
            
            # Sort by confidence
            related.sort(key=lambda x: x["confidence"], reverse=True)
            
            # Cache result
            self._associations_cache[item_code] = related[:10]
            self._cache_timestamp = datetime.now()
            
            return related[:10]
        
        except Exception as e:
            logger.error(f"Error getting related items: {e}")
            return []
    
    async def _get_customer_history(self, customer_id: str) -> List[Dict]:
        """Get customer's purchase history"""
        if not self.erpnext_adapter:
            return []
        
        try:
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["item_code", "item_name", "item_group", "qty", "rate"],
                filters=[
                    ["Sales Invoice Item.parenttype", "=", "Sales Invoice"],
                    ["Sales Invoice.customer", "=", customer_id],
                    ["Sales Invoice.docstatus", "=", 1]
                ],
                limit=200
            )
            return items.get("data", [])
        except Exception as e:
            logger.error(f"Error getting customer history: {e}")
            return []
    
    async def _get_popular_items(self, limit: int) -> List[Dict]:
        """Get most popular items overall"""
        if not self.erpnext_adapter:
            return []
        
        try:
            # Get items with highest sales volume in last 30 days
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["item_code", "item_name", "qty"],
                filters=[
                    ["creation", ">=", (datetime.now() - timedelta(days=30)).isoformat()],
                    ["docstatus", "=", 1]
                ],
                limit=500
            )
            
            # Aggregate by item
            item_sales = defaultdict(lambda: {"qty": 0, "name": ""})
            for item in items.get("data", []):
                code = item.get("item_code")
                item_sales[code]["qty"] += item.get("qty", 0)
                item_sales[code]["name"] = item.get("item_name", code)
            
            # Sort and return
            popular = [
                {
                    "item_code": code,
                    "item_name": data["name"],
                    "popularity": data["qty"],
                    "reason": "Popular item"
                }
                for code, data in item_sales.items()
            ]
            popular.sort(key=lambda x: x["popularity"], reverse=True)
            return popular[:limit]
        
        except Exception as e:
            logger.error(f"Error getting popular items: {e}")
            return []
    
    async def _get_items_in_category(self, category: str) -> List[Dict]:
        """Get items in a specific category"""
        if not self.erpnext_adapter:
            return []
        
        try:
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Item",
                fields=["item_code", "item_name", "standard_rate"],
                filters=[
                    ["item_group", "=", category],
                    ["disabled", "=", 0]
                ],
                limit=50
            )
            return items.get("data", [])
        except Exception as e:
            logger.error(f"Error getting items in category: {e}")
            return []
    
    async def _get_sales_velocity(self, item_code: str, days: int = 30) -> float:
        """Calculate average daily sales velocity"""
        if not self.erpnext_adapter:
            return 0
        
        try:
            sales = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice Item",
                fields=["qty"],
                filters=[
                    ["item_code", "=", item_code],
                    ["creation", ">=", (datetime.now() - timedelta(days=days)).isoformat()],
                    ["docstatus", "=", 1]
                ],
                limit=500
            )
            
            total_qty = sum(s.get("qty", 0) for s in sales.get("data", []))
            return total_qty / days
        
        except Exception as e:
            logger.error(f"Error calculating sales velocity: {e}")
            return 0
    
    def _is_cache_valid(self) -> bool:
        """Check if cache is still valid"""
        if not self._cache_timestamp:
            return False
        return datetime.now() - self._cache_timestamp < self._cache_ttl
