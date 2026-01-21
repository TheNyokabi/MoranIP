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
        errors: List[Dict] = []
        
        for item in items:
            item_code = item.get("item_code")
            qty = Decimal(str(item.get("qty", 0)))
            item_warehouse = item.get("warehouse") or warehouse
            
            if qty <= 0:
                continue

            # Skip stock validation for non-stock/service items
            try:
                item_detail = self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/Item/{item_code}",
                    method="GET",
                )
                if isinstance(item_detail, dict) and "data" in item_detail:
                    item_detail = item_detail.get("data")
                if isinstance(item_detail, dict) and not bool(item_detail.get("is_stock_item", True)):
                    continue
            except Exception:
                # If we can't read the item, proceed with validation (fail closed later if stock APIs fail)
                pass
            
            # Get stock balance (fail closed; don't let unknown checks reach ERPNext submit)
            try:
                stock_qty = self._get_stock_qty(item_code=item_code, warehouse=item_warehouse)

                if stock_qty < qty:
                    # For development/demo purposes, allow negative stock or warn instead of blocking
                    import os
                    if os.getenv("ALLOW_NEGATIVE_STOCK", "false").lower() == "true":
                        print(
                            f"Warning: Insufficient stock for {item_code}: "
                            f"Required {qty}, Available {stock_qty} (warehouse={item_warehouse})"
                        )
                    else:
                        errors.append(
                            {
                                "item_code": item_code,
                                "warehouse": item_warehouse,
                                "required_qty": float(qty),
                                "available_qty": float(stock_qty),
                            }
                        )
            except Exception as e:
                errors.append(
                    {
                        "item_code": item_code,
                        "warehouse": item_warehouse,
                        "required_qty": float(qty),
                        "available_qty": None,
                        "error": str(e),
                    }
                )
        
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

    def _parse_stock_balance_response(self, stock: object) -> Decimal:
        # Our adapter often wraps ERPNext responses as {"data": ...}
        if isinstance(stock, dict) and "data" in stock:
            stock = stock.get("data")

        if isinstance(stock, dict):
            if "message" in stock:
                message = stock.get("message")
                if isinstance(message, dict):
                    value = message.get("qty", message.get("stock_qty", message.get("actual_qty", 0)))
                else:
                    value = message
            else:
                value = stock.get("qty", stock.get("stock_qty", stock.get("actual_qty", 0)))
        else:
            value = stock

        try:
            return Decimal(str(value or 0))
        except Exception:
            return Decimal("0")

    def _get_bin_projected_qty(self, item_code: str, warehouse: str) -> Optional[Decimal]:
        import json

        bin_result = self.erpnext_adapter.proxy_request(
            tenant_id=self.tenant_id,
            path="resource/Bin",
            method="GET",
            params={
                "filters": json.dumps(
                    [
                        ["item_code", "=", item_code],
                        ["warehouse", "=", warehouse],
                    ]
                ),
                "fields": json.dumps(
                    [
                        "projected_qty",
                        "actual_qty",
                        "reserved_qty",
                        "ordered_qty",
                        "planned_qty",
                        "indented_qty",
                    ]
                ),
                "limit_page_length": 1,
            },
        )

        bins: List[Dict] = []
        if isinstance(bin_result, dict):
            bins = bin_result.get("data", []) or []
        elif isinstance(bin_result, list):
            bins = bin_result

        if not bins:
            return None

        b = bins[0] or {}
        projected = b.get("projected_qty")
        actual = b.get("actual_qty")
        value = projected if projected is not None else actual
        return Decimal(str(value or 0))

    def _get_stock_qty(self, item_code: str, warehouse: str) -> Decimal:
        """Best-effort available qty.

        ERPNext negative stock checks for transactions (e.g., Sales Invoice with update_stock)
        use projected qty (actual minus reservations + incoming/outgoing). To match ERPNext
        behavior and fail fast, prefer Bin.projected_qty when available.
        """
        # Primary: Bin.projected_qty (closest to ERPNext submit-time validation)
        try:
            projected_qty = self._get_bin_projected_qty(item_code=item_code, warehouse=warehouse)
            if projected_qty is not None:
                return projected_qty
        except Exception:
            pass

        # Secondary: ERPNext stock balance method
        stock_result = self.erpnext_adapter.proxy_request(
            tenant_id=self.tenant_id,
            path="method/erpnext.stock.utils.get_stock_balance",
            method="GET",
            params={"item_code": item_code, "warehouse": warehouse},
        )

        qty = self._parse_stock_balance_response(stock_result)

        # If method returns 0, attempt ledger fallback for accuracy
        if qty == 0:
            import json

            params = {
                "filters": json.dumps([
                    ["item_code", "=", item_code],
                    ["warehouse", "=", warehouse],
                ]),
                "limit_page_length": 1,
                "fields": json.dumps(["qty_after_transaction"]),
                "order_by": "posting_date desc, posting_time desc, creation desc",
            }

            ledger_entries = self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path="resource/Stock Ledger Entry",
                method="GET",
                params=params,
            )

            if isinstance(ledger_entries, dict):
                entries = ledger_entries.get("data", [])
            elif isinstance(ledger_entries, list):
                entries = ledger_entries
            else:
                entries = []

            if entries:
                qty = Decimal(str(entries[0].get("qty_after_transaction", 0) or 0))

        return qty
    
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
