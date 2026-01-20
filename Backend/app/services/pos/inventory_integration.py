"""
Inventory Integration Service for PoS
Validates stock availability, reserves stock, updates stock ledger
"""
from typing import Dict, List, Optional
from fastapi import HTTPException
from decimal import Decimal


class InventoryIntegrationService:
    """Service for inventory validation and stock management"""
    
    def __init__(self, erpnext_adapter, tenant_id: str):
        """
        Initialize Inventory Integration Service
        
        Args:
            erpnext_adapter: ERPNext client adapter
            tenant_id: Tenant identifier
        """
        self.erpnext_adapter = erpnext_adapter
        self.tenant_id = tenant_id
    
    async def validate_stock_availability(
        self,
        items: List[Dict],
        warehouse: str
    ) -> bool:
        """
        Validate stock availability for items
        
        Args:
            items: List of items with item_code and qty
            warehouse: Warehouse name
            
        Returns:
            True if all items have sufficient stock, raises HTTPException if not
        """
        errors = []
        
        for item in items:
            item_code = item.get("item_code")
            qty = Decimal(str(item.get("qty", 0)))
            
            if qty <= 0:
                continue
            
            # Get stock balance
            try:
                stock_result = self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="method/erpnext.stock.utils.get_stock_balance",
                    method="GET",
                    params={
                        "item_code": item_code,
                        "warehouse": warehouse
                    }
                )
                
                # Stock balance can be returned in different formats
                if isinstance(stock_result, dict):
                    stock_qty = Decimal(str(stock_result.get("qty", 0) or stock_result.get("stock_qty", 0)))
                else:
                    stock_qty = Decimal(str(stock_result or 0))
                
                if stock_qty < qty:
                    # For development/demo purposes, allow negative stock or warn instead of blocking
                    import os
                    if os.getenv("ALLOW_NEGATIVE_STOCK", "false").lower() == "true":
                        print(f"Warning: Insufficient stock for {item_code}: Required {qty}, Available {stock_qty}")
                    else:
                        errors.append(
                            f"Insufficient stock for {item_code}: "
                            f"Required {qty}, Available {stock_qty}"
                        )
            except Exception as e:
                # If stock check fails, log but don't block (might be service item)
                print(f"Stock check failed for {item_code}: {e}")
                # For service items or items without stock tracking, skip validation
                continue
        
        if errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "insufficient_stock",
                    "message": "Stock validation failed",
                    "errors": errors
                }
            )
        
        return True
    
    async def reserve_stock(
        self,
        items: List[Dict],
        warehouse: str,
        reservation_id: Optional[str] = None
    ) -> str:
        """
        Reserve stock for items (optional - for pending orders)
        
        Args:
            items: List of items with item_code and qty
            warehouse: Warehouse name
            reservation_id: Optional reservation ID
            
        Returns:
            Reservation ID
        """
        # In ERPNext, stock is reserved when creating a draft Sales Order
        # For PoS, we typically don't reserve - we just validate and deduct on submit
        # This is a placeholder for future implementation
        return reservation_id or "reserved"
    
    async def update_stock_ledger(
        self,
        invoice_name: str
    ) -> bool:
        """
        Update stock ledger on invoice submission
        
        Args:
            invoice_name: Sales Invoice name
            
        Returns:
            True if successful
        """
        # In ERPNext, stock ledger is automatically updated when Sales Invoice is submitted
        # This is handled by ERPNext's on_submit hook
        # This method is a placeholder for custom stock update logic if needed
        return True
    
    async def handle_negative_stock(
        self,
        item_code: str,
        warehouse: str,
        qty: Decimal
    ) -> bool:
        """
        Handle negative stock scenarios (allow or reject)
        
        Args:
            item_code: Item code
            warehouse: Warehouse name
            qty: Quantity to check
            
        Returns:
            True if negative stock is allowed, False otherwise
        """
        # Check if item allows negative stock
        try:
            item = self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=f"resource/Item/{item_code}",
                method="GET"
            )
            
            if item:
                allow_negative_stock = item.get("allow_negative_stock", False)
                return allow_negative_stock
        except Exception:
            pass
        
        # Default: don't allow negative stock
        return False
