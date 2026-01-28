"""
Franchise Management Service

Provides:
- Multi-location management
- Centralized reporting
- Franchise performance tracking
- Royalty calculation
- Inter-location inventory visibility
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any

from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ...models.enterprise import (
    FranchiseGroup, FranchiseLocation, FranchiseReport
)

logger = logging.getLogger(__name__)


class FranchiseService:
    """Service for franchise/multi-location management"""
    
    def __init__(
        self,
        db: Session,
        franchisor_tenant_id: str,
        erpnext_adapter=None
    ):
        self.db = db
        self.franchisor_tenant_id = franchisor_tenant_id
        self.erpnext_adapter = erpnext_adapter
    
    # ==================== Group Management ====================
    
    def create_franchise_group(
        self,
        name: str,
        code: str,
        description: Optional[str] = None,
        billing_type: str = "royalty",
        royalty_percentage: Decimal = Decimal(0),
        flat_fee_amount: Decimal = Decimal(0),
        settings: Optional[Dict] = None
    ) -> FranchiseGroup:
        """Create a new franchise group"""
        group = FranchiseGroup(
            franchisor_tenant_id=self.franchisor_tenant_id,
            name=name,
            code=code,
            description=description,
            billing_type=billing_type,
            royalty_percentage=royalty_percentage,
            flat_fee_amount=flat_fee_amount,
            settings=settings or {}
        )
        
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        
        logger.info(f"Created franchise group: {name} ({code})")
        return group
    
    def get_franchise_groups(self) -> List[FranchiseGroup]:
        """Get all franchise groups for franchisor"""
        return self.db.query(FranchiseGroup).filter(
            FranchiseGroup.franchisor_tenant_id == self.franchisor_tenant_id,
            FranchiseGroup.is_active == True
        ).order_by(FranchiseGroup.name).all()
    
    def get_franchise_group(self, group_id: str) -> Optional[FranchiseGroup]:
        """Get a franchise group by ID"""
        return self.db.query(FranchiseGroup).filter(
            FranchiseGroup.id == group_id,
            FranchiseGroup.franchisor_tenant_id == self.franchisor_tenant_id
        ).first()
    
    def update_franchise_group(
        self,
        group_id: str,
        updates: Dict[str, Any]
    ) -> Optional[FranchiseGroup]:
        """Update franchise group settings"""
        group = self.get_franchise_group(group_id)
        if not group:
            return None
        
        allowed_fields = [
            'name', 'description', 'logo_url',
            'billing_type', 'royalty_percentage', 'flat_fee_amount',
            'settings', 'is_active'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(group, field, value)
        
        self.db.commit()
        self.db.refresh(group)
        
        return group
    
    # ==================== Location Management ====================
    
    def add_location(
        self,
        group_id: str,
        tenant_id: str,
        name: str,
        code: str,
        address: Optional[Dict] = None,
        contact: Optional[Dict] = None,
        operating_hours: Optional[Dict] = None
    ) -> Optional[FranchiseLocation]:
        """Add a new franchise location"""
        group = self.get_franchise_group(group_id)
        if not group:
            return None
        
        location = FranchiseLocation(
            group_id=group_id,
            tenant_id=tenant_id,
            name=name,
            code=code,
            address_line1=address.get('line1') if address else None,
            address_line2=address.get('line2') if address else None,
            city=address.get('city') if address else None,
            state_province=address.get('state') if address else None,
            postal_code=address.get('postal_code') if address else None,
            country=address.get('country', 'KE') if address else 'KE',
            phone=contact.get('phone') if contact else None,
            email=contact.get('email') if contact else None,
            manager_name=contact.get('manager') if contact else None,
            operating_hours=operating_hours or {},
            status="active",
            opened_at=datetime.utcnow()
        )
        
        self.db.add(location)
        self.db.commit()
        self.db.refresh(location)
        
        logger.info(f"Added franchise location: {name} ({code})")
        return location
    
    def get_locations(
        self,
        group_id: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[FranchiseLocation]:
        """Get franchise locations"""
        query = self.db.query(FranchiseLocation).join(FranchiseGroup).filter(
            FranchiseGroup.franchisor_tenant_id == self.franchisor_tenant_id
        )
        
        if group_id:
            query = query.filter(FranchiseLocation.group_id == group_id)
        
        if status:
            query = query.filter(FranchiseLocation.status == status)
        
        return query.order_by(FranchiseLocation.name).all()
    
    def get_location(self, location_id: str) -> Optional[FranchiseLocation]:
        """Get a specific location"""
        return self.db.query(FranchiseLocation).join(FranchiseGroup).filter(
            FranchiseLocation.id == location_id,
            FranchiseGroup.franchisor_tenant_id == self.franchisor_tenant_id
        ).first()
    
    def update_location(
        self,
        location_id: str,
        updates: Dict[str, Any]
    ) -> Optional[FranchiseLocation]:
        """Update location details"""
        location = self.get_location(location_id)
        if not location:
            return None
        
        allowed_fields = [
            'name', 'address_line1', 'address_line2',
            'city', 'state_province', 'postal_code', 'country',
            'phone', 'email', 'manager_name',
            'latitude', 'longitude',
            'operating_hours', 'status'
        ]
        
        for field, value in updates.items():
            if field in allowed_fields:
                setattr(location, field, value)
        
        self.db.commit()
        self.db.refresh(location)
        
        return location
    
    # ==================== Performance & Reporting ====================
    
    async def get_location_performance(
        self,
        location_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get performance metrics for a location"""
        location = self.get_location(location_id)
        if not location or not self.erpnext_adapter:
            return {}
        
        if not to_date:
            to_date = datetime.utcnow()
        if not from_date:
            from_date = to_date - timedelta(days=30)
        
        try:
            # Get sales data
            invoices = self.erpnext_adapter.list_resource(
                tenant_id=str(location.tenant_id),
                doctype="Sales Invoice",
                fields=["name", "grand_total", "creation"],
                filters=[
                    ["docstatus", "=", 1],
                    ["creation", ">=", from_date.isoformat()],
                    ["creation", "<=", to_date.isoformat()]
                ],
                limit=1000
            )
            
            invoice_data = invoices.get("data", [])
            total_sales = sum(
                Decimal(str(inv.get("grand_total", 0)))
                for inv in invoice_data
            )
            total_orders = len(invoice_data)
            avg_order = total_sales / total_orders if total_orders > 0 else Decimal(0)
            
            return {
                "location_id": location_id,
                "location_name": location.name,
                "period": {
                    "from": from_date.isoformat(),
                    "to": to_date.isoformat()
                },
                "metrics": {
                    "total_sales": float(total_sales),
                    "total_orders": total_orders,
                    "average_order_value": float(avg_order),
                    "daily_average_sales": float(
                        total_sales / max(1, (to_date - from_date).days)
                    )
                }
            }
        
        except Exception as e:
            logger.error(f"Error getting location performance: {e}")
            return {}
    
    async def get_group_performance(
        self,
        group_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get aggregated performance for a franchise group"""
        locations = self.get_locations(group_id=group_id, status="active")
        
        if not to_date:
            to_date = datetime.utcnow()
        if not from_date:
            from_date = to_date - timedelta(days=30)
        
        total_sales = Decimal(0)
        total_orders = 0
        location_metrics = []
        
        for location in locations:
            perf = await self.get_location_performance(
                str(location.id), from_date, to_date
            )
            
            if perf.get("metrics"):
                metrics = perf["metrics"]
                total_sales += Decimal(str(metrics.get("total_sales", 0)))
                total_orders += metrics.get("total_orders", 0)
                location_metrics.append({
                    "location_id": str(location.id),
                    "location_name": location.name,
                    "sales": metrics.get("total_sales", 0),
                    "orders": metrics.get("total_orders", 0)
                })
        
        # Sort by sales
        location_metrics.sort(key=lambda x: x["sales"], reverse=True)
        
        return {
            "group_id": group_id,
            "period": {
                "from": from_date.isoformat(),
                "to": to_date.isoformat()
            },
            "totals": {
                "total_sales": float(total_sales),
                "total_orders": total_orders,
                "locations_count": len(locations)
            },
            "by_location": location_metrics,
            "top_performer": location_metrics[0] if location_metrics else None,
            "bottom_performer": location_metrics[-1] if len(location_metrics) > 1 else None
        }
    
    async def calculate_royalties(
        self,
        group_id: str,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """Calculate royalties due from franchisees"""
        group = self.get_franchise_group(group_id)
        if not group:
            return {}
        
        performance = await self.get_group_performance(
            group_id, from_date, to_date
        )
        
        royalties = []
        total_royalties = Decimal(0)
        
        for loc_perf in performance.get("by_location", []):
            sales = Decimal(str(loc_perf.get("sales", 0)))
            
            if group.billing_type == "royalty":
                royalty = sales * (group.royalty_percentage / 100)
            elif group.billing_type == "flat_fee":
                royalty = group.flat_fee_amount
            else:  # hybrid
                royalty = sales * (group.royalty_percentage / 100) + group.flat_fee_amount
            
            royalties.append({
                "location_id": loc_perf["location_id"],
                "location_name": loc_perf["location_name"],
                "sales": float(sales),
                "royalty_due": float(royalty)
            })
            
            total_royalties += royalty
        
        return {
            "group_id": group_id,
            "group_name": group.name,
            "billing_type": group.billing_type,
            "period": {
                "from": from_date.isoformat(),
                "to": to_date.isoformat()
            },
            "total_royalties_due": float(total_royalties),
            "by_location": royalties
        }
    
    def generate_report(
        self,
        group_id: str,
        report_type: str,
        period_start: datetime,
        period_end: datetime,
        metrics: Dict[str, Any]
    ) -> FranchiseReport:
        """Generate and store a franchise report"""
        report = FranchiseReport(
            group_id=group_id,
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            total_sales=metrics.get("total_sales", 0),
            total_orders=metrics.get("total_orders", 0),
            average_order_value=metrics.get("average_order_value", 0),
            total_customers=metrics.get("total_customers", 0),
            location_metrics=metrics.get("by_location", {}),
            top_items=metrics.get("top_items", []),
            royalties_due=metrics.get("royalties_due", 0)
        )
        
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        return report
    
    def get_reports(
        self,
        group_id: str,
        report_type: Optional[str] = None,
        limit: int = 50
    ) -> List[FranchiseReport]:
        """Get historical reports"""
        query = self.db.query(FranchiseReport).filter(
            FranchiseReport.group_id == group_id
        )
        
        if report_type:
            query = query.filter(FranchiseReport.report_type == report_type)
        
        return query.order_by(
            FranchiseReport.period_end.desc()
        ).limit(limit).all()
    
    # ==================== Comparison & Benchmarking ====================
    
    async def compare_locations(
        self,
        group_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Compare performance across locations"""
        performance = await self.get_group_performance(
            group_id, from_date, to_date
        )
        
        locations_data = performance.get("by_location", [])
        
        if not locations_data:
            return []
        
        # Calculate averages for benchmarking
        avg_sales = sum(l["sales"] for l in locations_data) / len(locations_data)
        avg_orders = sum(l["orders"] for l in locations_data) / len(locations_data)
        
        comparison = []
        for loc in locations_data:
            sales_vs_avg = ((loc["sales"] / avg_sales) - 1) * 100 if avg_sales > 0 else 0
            orders_vs_avg = ((loc["orders"] / avg_orders) - 1) * 100 if avg_orders > 0 else 0
            
            comparison.append({
                "location_id": loc["location_id"],
                "location_name": loc["location_name"],
                "sales": loc["sales"],
                "orders": loc["orders"],
                "sales_vs_average": round(sales_vs_avg, 1),
                "orders_vs_average": round(orders_vs_avg, 1),
                "performance_rating": "above" if sales_vs_avg > 0 else "below" if sales_vs_avg < 0 else "average"
            })
        
        # Sort by sales performance
        comparison.sort(key=lambda x: x["sales_vs_average"], reverse=True)
        
        # Add rank
        for i, loc in enumerate(comparison):
            loc["rank"] = i + 1
        
        return comparison
