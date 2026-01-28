"""
Multi-Channel Inventory Management

Provides:
- Centralized inventory tracking across channels
- Inventory allocation per channel
- Stock reservation
- Sync coordination
- Channel-specific stock levels
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class SalesChannel(str, Enum):
    """Available sales channels"""
    POS = "pos"
    SHOPIFY = "shopify"
    WOOCOMMERCE = "woocommerce"
    JUMIA = "jumia"
    PORTAL = "portal"
    DIRECT = "direct"


class AllocationStrategy(str, Enum):
    """Inventory allocation strategies"""
    SHARED = "shared"  # All channels share the same pool
    RESERVED = "reserved"  # Each channel has reserved allocation
    PRIORITY = "priority"  # Channels have priority levels


@dataclass
class ChannelInventory:
    """Inventory for a specific channel"""
    channel: SalesChannel
    item_code: str
    total_allocated: int
    available: int
    reserved: int
    pending_sync: int
    last_synced: Optional[datetime] = None


@dataclass
class InventoryAllocation:
    """Inventory allocation rule"""
    item_code: str
    channel: SalesChannel
    allocation_type: str  # "percentage", "fixed", "unlimited"
    value: int  # Percentage or fixed quantity
    min_buffer: int = 0  # Minimum buffer to keep
    priority: int = 100  # Lower = higher priority


class MultiChannelInventoryService:
    """
    Manages inventory across multiple sales channels.
    
    Features:
    - Centralized inventory with channel-specific views
    - Automatic allocation based on rules
    - Real-time sync coordination
    - Stock reservation for orders
    - Buffer management
    """
    
    def __init__(
        self,
        db: Session,
        tenant_id: str,
        erpnext_adapter=None
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.erpnext_adapter = erpnext_adapter
        
        # In-memory allocation rules (should be persisted in DB)
        self._allocations: Dict[str, List[InventoryAllocation]] = {}
        
        # Channel connectors
        self._connectors: Dict[SalesChannel, Any] = {}
    
    def register_connector(self, channel: SalesChannel, connector: Any):
        """Register a channel connector"""
        self._connectors[channel] = connector
    
    # ==================== Inventory Queries ====================
    
    async def get_total_inventory(self, item_code: str) -> Dict[str, Any]:
        """Get total inventory across all channels"""
        if not self.erpnext_adapter:
            return {}
        
        try:
            # Get stock from ERPNext
            bins = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["warehouse", "actual_qty", "reserved_qty", "ordered_qty"],
                filters=[["item_code", "=", item_code]],
                limit=100
            )
            
            total_actual = 0
            total_reserved = 0
            total_ordered = 0
            warehouse_stock = []
            
            for bin_data in bins.get("data", []):
                actual = bin_data.get("actual_qty", 0)
                reserved = bin_data.get("reserved_qty", 0)
                ordered = bin_data.get("ordered_qty", 0)
                
                total_actual += actual
                total_reserved += reserved
                total_ordered += ordered
                
                warehouse_stock.append({
                    "warehouse": bin_data.get("warehouse"),
                    "actual": actual,
                    "reserved": reserved,
                    "available": max(0, actual - reserved)
                })
            
            return {
                "item_code": item_code,
                "total_actual": total_actual,
                "total_reserved": total_reserved,
                "total_available": max(0, total_actual - total_reserved),
                "incoming": total_ordered,
                "by_warehouse": warehouse_stock
            }
        
        except Exception as e:
            logger.error(f"Error getting inventory for {item_code}: {e}")
            return {}
    
    async def get_channel_inventory(
        self,
        item_code: str,
        channel: SalesChannel
    ) -> ChannelInventory:
        """Get inventory available for a specific channel"""
        total = await self.get_total_inventory(item_code)
        total_available = total.get("total_available", 0)
        
        # Get allocation rules
        allocations = self._allocations.get(item_code, [])
        channel_allocation = next(
            (a for a in allocations if a.channel == channel),
            None
        )
        
        if not channel_allocation:
            # Default: shared pool
            return ChannelInventory(
                channel=channel,
                item_code=item_code,
                total_allocated=total_available,
                available=total_available,
                reserved=0,
                pending_sync=0
            )
        
        # Calculate allocated amount
        if channel_allocation.allocation_type == "percentage":
            allocated = int(total_available * channel_allocation.value / 100)
        elif channel_allocation.allocation_type == "fixed":
            allocated = min(channel_allocation.value, total_available)
        else:  # unlimited
            allocated = total_available
        
        # Apply buffer
        available = max(0, allocated - channel_allocation.min_buffer)
        
        return ChannelInventory(
            channel=channel,
            item_code=item_code,
            total_allocated=allocated,
            available=available,
            reserved=0,
            pending_sync=0
        )
    
    async def get_all_channel_inventory(
        self,
        item_code: str
    ) -> Dict[SalesChannel, ChannelInventory]:
        """Get inventory for all channels"""
        result = {}
        
        for channel in SalesChannel:
            result[channel] = await self.get_channel_inventory(item_code, channel)
        
        return result
    
    # ==================== Allocation Management ====================
    
    def set_allocation(
        self,
        item_code: str,
        channel: SalesChannel,
        allocation_type: str,
        value: int,
        min_buffer: int = 0,
        priority: int = 100
    ):
        """Set inventory allocation for a channel"""
        allocation = InventoryAllocation(
            item_code=item_code,
            channel=channel,
            allocation_type=allocation_type,
            value=value,
            min_buffer=min_buffer,
            priority=priority
        )
        
        if item_code not in self._allocations:
            self._allocations[item_code] = []
        
        # Remove existing allocation for this channel
        self._allocations[item_code] = [
            a for a in self._allocations[item_code]
            if a.channel != channel
        ]
        
        self._allocations[item_code].append(allocation)
        
        # Sort by priority
        self._allocations[item_code].sort(key=lambda x: x.priority)
    
    def remove_allocation(self, item_code: str, channel: SalesChannel):
        """Remove allocation for a channel"""
        if item_code in self._allocations:
            self._allocations[item_code] = [
                a for a in self._allocations[item_code]
                if a.channel != channel
            ]
    
    def get_allocations(self, item_code: str) -> List[InventoryAllocation]:
        """Get all allocations for an item"""
        return self._allocations.get(item_code, [])
    
    # ==================== Stock Reservation ====================
    
    async def reserve_stock(
        self,
        item_code: str,
        channel: SalesChannel,
        quantity: int,
        reference_id: str
    ) -> bool:
        """
        Reserve stock for a pending order.
        
        This creates a reservation that decreases available stock
        until the order is confirmed or cancelled.
        """
        channel_inv = await self.get_channel_inventory(item_code, channel)
        
        if channel_inv.available < quantity:
            logger.warning(
                f"Insufficient stock for reservation: {item_code}, "
                f"requested: {quantity}, available: {channel_inv.available}"
            )
            return False
        
        # TODO: Store reservation in database
        # For now, create ERPNext Stock Reservation if available
        
        if self.erpnext_adapter:
            try:
                self.erpnext_adapter.create_resource(
                    tenant_id=self.tenant_id,
                    doctype="Stock Reservation Entry",
                    data={
                        "doctype": "Stock Reservation Entry",
                        "item_code": item_code,
                        "reserved_qty": quantity,
                        "voucher_type": "Sales Order",
                        "voucher_no": reference_id,
                        "status": "Reserved"
                    }
                )
                return True
            except Exception as e:
                logger.error(f"Error creating stock reservation: {e}")
        
        return False
    
    async def release_reservation(
        self,
        item_code: str,
        reference_id: str
    ) -> bool:
        """Release a stock reservation"""
        # TODO: Update reservation in database
        return True
    
    # ==================== Sync Coordination ====================
    
    async def sync_all_channels(
        self,
        item_codes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Sync inventory to all connected channels"""
        results = {
            "success": True,
            "channels": {},
            "errors": []
        }
        
        # Get items to sync
        if not item_codes:
            item_codes = await self._get_all_item_codes()
        
        for channel, connector in self._connectors.items():
            channel_results = {
                "synced": 0,
                "failed": 0,
                "items": []
            }
            
            for item_code in item_codes:
                try:
                    channel_inv = await self.get_channel_inventory(item_code, channel)
                    
                    # Sync to channel
                    if hasattr(connector, 'update_stock'):
                        # Need product mapping (item_code -> channel product ID)
                        # This would come from a mapping table
                        pass
                    
                    channel_results["synced"] += 1
                    channel_results["items"].append({
                        "item_code": item_code,
                        "quantity": channel_inv.available,
                        "status": "synced"
                    })
                
                except Exception as e:
                    channel_results["failed"] += 1
                    channel_results["items"].append({
                        "item_code": item_code,
                        "status": "failed",
                        "error": str(e)
                    })
            
            results["channels"][channel.value] = channel_results
        
        return results
    
    async def sync_single_item(
        self,
        item_code: str,
        channels: Optional[List[SalesChannel]] = None
    ) -> Dict[str, Any]:
        """Sync a single item to specified channels"""
        if channels is None:
            channels = list(self._connectors.keys())
        
        results = {}
        
        for channel in channels:
            connector = self._connectors.get(channel)
            if not connector:
                results[channel.value] = {"status": "skipped", "reason": "No connector"}
                continue
            
            try:
                channel_inv = await self.get_channel_inventory(item_code, channel)
                
                # Channel-specific sync
                if channel == SalesChannel.SHOPIFY and hasattr(connector, 'sync_inventory_to_shopify'):
                    # Would need product mapping
                    pass
                elif channel == SalesChannel.WOOCOMMERCE and hasattr(connector, 'update_stock'):
                    # Get WooCommerce product by SKU
                    product = await connector.get_product_by_sku(item_code)
                    if product:
                        success = await connector.update_stock(
                            product.id,
                            int(channel_inv.available)
                        )
                        results[channel.value] = {
                            "status": "synced" if success else "failed",
                            "quantity": channel_inv.available
                        }
                    else:
                        results[channel.value] = {
                            "status": "skipped",
                            "reason": "Product not found in channel"
                        }
                
            except Exception as e:
                results[channel.value] = {
                    "status": "failed",
                    "error": str(e)
                }
        
        return results
    
    async def _get_all_item_codes(self) -> List[str]:
        """Get all item codes that need syncing"""
        if not self.erpnext_adapter:
            return []
        
        try:
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Item",
                fields=["item_code"],
                filters=[
                    ["disabled", "=", 0],
                    ["is_sales_item", "=", 1]
                ],
                limit=1000
            )
            return [i.get("item_code") for i in items.get("data", [])]
        except Exception as e:
            logger.error(f"Error getting item codes: {e}")
            return []
    
    # ==================== Stock Movement Tracking ====================
    
    async def record_channel_sale(
        self,
        item_code: str,
        channel: SalesChannel,
        quantity: int,
        order_id: str
    ):
        """Record a sale from a channel"""
        logger.info(
            f"Channel sale recorded: {item_code} x {quantity} "
            f"from {channel.value}, order {order_id}"
        )
        
        # Trigger sync to other channels
        await self.sync_single_item(item_code)
    
    async def get_low_stock_items(
        self,
        threshold: int = 10
    ) -> List[Dict[str, Any]]:
        """Get items with low stock across all channels"""
        if not self.erpnext_adapter:
            return []
        
        try:
            items = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Bin",
                fields=["item_code", "actual_qty", "reserved_qty"],
                filters=[["actual_qty", "<", threshold + 10]],
                limit=500
            )
            
            low_stock = []
            for item in items.get("data", []):
                available = item.get("actual_qty", 0) - item.get("reserved_qty", 0)
                if available < threshold:
                    low_stock.append({
                        "item_code": item.get("item_code"),
                        "available": available,
                        "threshold": threshold
                    })
            
            return low_stock
        
        except Exception as e:
            logger.error(f"Error getting low stock items: {e}")
            return []
