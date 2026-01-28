"""
Abstract Base Service for Purchase Management

Defines the interface that all ERP adapters must implement for purchase operations.
This enables platform-agnostic purchase management across different ERP systems.

Author: MoranERP Team
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class PurchaseServiceBase(ABC):
    """Abstract base class for purchase management operations"""
    
    # ==================== Supplier Operations ====================
    
    @abstractmethod
    async def list_suppliers(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        List suppliers with optional filters.
        
        Returns:
            {
                "suppliers": [...],
                "total": int,
                "page": int
            }
        """
        pass
    
    @abstractmethod
    async def create_supplier(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a new supplier.
        
        Args:
            data: MoranERP standard supplier data
        
        Returns:
            Created supplier in MoranERP standard format
        """
        pass
    
    @abstractmethod
    async def get_supplier(
        self,
        tenant_id: str,
        supplier_id: str
    ) -> Dict[str, Any]:
        """Get supplier details by ID"""
        pass
    
    @abstractmethod
    async def update_supplier(
        self,
        tenant_id: str,
        supplier_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update supplier"""
        pass
    
    @abstractmethod
    async def delete_supplier(
        self,
        tenant_id: str,
        supplier_id: str
    ) -> Dict[str, Any]:
        """Delete/disable supplier"""
        pass
    
    # ==================== Purchase Order Operations ====================
    
    @abstractmethod
    async def list_purchase_orders(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """List purchase orders with optional filters"""
        pass
    
    @abstractmethod
    async def create_purchase_order(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new purchase order"""
        pass
    
    @abstractmethod
    async def get_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        """Get purchase order details"""
        pass
    
    @abstractmethod
    async def update_purchase_order(
        self,
        tenant_id: str,
        order_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update purchase order (if draft)"""
        pass
    
    @abstractmethod
    async def submit_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        """Submit purchase order for approval"""
        pass
    
    @abstractmethod
    async def cancel_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        """Cancel purchase order"""
        pass
    
    # ==================== Purchase Receipt Operations ====================
    
    @abstractmethod
    async def create_purchase_receipt(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Record goods received"""
        pass
    
    @abstractmethod
    async def list_purchase_receipts(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """List purchase receipts"""
        pass
    
    @abstractmethod
    async def get_purchase_receipt(
        self,
        tenant_id: str,
        receipt_id: str
    ) -> Dict[str, Any]:
        """Get purchase receipt details"""
        pass
    
    @abstractmethod
    async def update_purchase_receipt(
        self,
        tenant_id: str,
        receipt_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update a purchase receipt (only allowed in Draft status).
        
        Can update:
        - Items (quantities, warehouses, rates)
        - Posting date
        - Other metadata
        """
        pass
    
    @abstractmethod
    async def submit_purchase_receipt(
        self,
        tenant_id: str,
        receipt_id: str
    ) -> Dict[str, Any]:
        """
        Submit purchase receipt to update inventory.
        
        This is a critical step that:
        1. Validates the receipt data
        2. Creates Stock Ledger Entries
        3. Updates inventory quantities in warehouses
        
        The receipt must be in Draft status to be submitted.
        """
        pass
    
    @abstractmethod
    async def cancel_purchase_receipt(
        self,
        tenant_id: str,
        receipt_id: str
    ) -> Dict[str, Any]:
        """Cancel a submitted purchase receipt (reverses stock entries)"""
        pass
    
    # ==================== Purchase Invoice Operations ====================
    
    @abstractmethod
    async def create_purchase_invoice(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Record supplier invoice"""
        pass
    
    @abstractmethod
    async def list_purchase_invoices(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """List purchase invoices"""
        pass
    
    @abstractmethod
    async def get_purchase_invoice(
        self,
        tenant_id: str,
        invoice_id: str
    ) -> Dict[str, Any]:
        """Get purchase invoice details"""
        pass
