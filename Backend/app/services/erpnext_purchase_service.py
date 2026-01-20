"""
ERPNext Purchase Service Implementation

Concrete implementation of PurchaseServiceBase for ERPNext.
Handles field mapping between MoranERP and ERPNext schemas.

Author: MoranERP Team
"""

from typing import Dict, Any, Optional, List
from .purchase_service_base import PurchaseServiceBase
from .erpnext_client import erpnext_adapter


class ERPNextPurchaseService(PurchaseServiceBase):
    """ERPNext-specific purchase management implementation"""
    
    # ==================== Supplier Operations ====================
    
    async def list_suppliers(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        params = {"limit_page_length": limit}
        
        if filters:
            erp_filters = []
            if filters.get("supplier_group"):
                erp_filters.append(["supplier_group", "=", filters["supplier_group"]])
            if filters.get("country"):
                erp_filters.append(["country", "=", filters["country"]])
            if "disabled" in filters:
                erp_filters.append(["disabled", "=", filters["disabled"]])
            
            if erp_filters:
                params["filters"] = erp_filters
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Supplier",
            method="GET",
            params=params
        )
        
        suppliers = [self._map_supplier_from_erpnext(s) for s in (result or [])]
        
        return {
            "suppliers": suppliers,
            "total": len(suppliers),
            "page": 1
        }
    
    async def create_supplier(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = self._map_supplier_to_erpnext(data)
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Supplier",
            method="POST",
            json_data=erpnext_data
        )
        
        return self._map_supplier_from_erpnext(result.get("data", result))
    
    async def get_supplier(
        self,
        tenant_id: str,
        supplier_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Supplier/{supplier_id}",
            method="GET"
        )
        
        return self._map_supplier_from_erpnext(result.get("data", result))
    
    async def update_supplier(
        self,
        tenant_id: str,
        supplier_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = {k: v for k, v in self._map_supplier_to_erpnext(data).items() if v is not None}
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Supplier/{supplier_id}",
            method="PUT",
            json_data=erpnext_data
        )
        
        return self._map_supplier_from_erpnext(result.get("data", result))
    
    async def delete_supplier(
        self,
        tenant_id: str,
        supplier_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Supplier/{supplier_id}",
            method="PUT",
            json_data={"disabled": 1}
        )
        
        return {"message": "Supplier disabled successfully"}
    
    # ==================== Purchase Order Operations ====================
    
    async def list_purchase_orders(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        params = {"limit_page_length": limit}
        
        if filters:
            erp_filters = []
            if filters.get("status"):
                # Map MoranERP status to ERPNext docstatus
                status_map = {"Draft": 0, "Submitted": 1, "Cancelled": 2}
                erp_filters.append(["docstatus", "=", status_map.get(filters["status"], 0)])
            if filters.get("supplier_id"):
                erp_filters.append(["supplier", "=", filters["supplier_id"]])
            if filters.get("from_date"):
                erp_filters.append(["transaction_date", ">=", filters["from_date"]])
            if filters.get("to_date"):
                erp_filters.append(["transaction_date", "<=", filters["to_date"]])
            
            if erp_filters:
                params["filters"] = erp_filters
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Order",
            method="GET",
            params=params
        )
        
        orders = [self._map_purchase_order_from_erpnext(po) for po in (result or [])]
        
        return {"orders": orders, "total": len(orders)}
    
    async def create_purchase_order(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = self._map_purchase_order_to_erpnext(data)
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Order",
            method="POST",
            json_data=erpnext_data
        )
        
        return self._map_purchase_order_from_erpnext(result.get("data", result))
    
    async def get_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Order/{order_id}",
            method="GET"
        )
        
        return self._map_purchase_order_from_erpnext(result.get("data", result))
    
    async def update_purchase_order(
        self,
        tenant_id: str,
        order_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = self._map_purchase_order_to_erpnext(data)
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Order/{order_id}",
            method="PUT",
            json_data=erpnext_data
        )
        
        return self._map_purchase_order_from_erpnext(result.get("data", result))
    
    async def submit_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Order/{order_id}",
            method="PUT",
            json_data={"docstatus": 1}
        )
        
        return {"message": "Purchase order submitted successfully"}
    
    async def cancel_purchase_order(
        self,
        tenant_id: str,
        order_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Order/{order_id}",
            method="PUT",
            json_data={"docstatus": 2}
        )
        
        return {"message": "Purchase order cancelled successfully"}
    
    # ==================== Purchase Receipt Operations ====================
    
    async def create_purchase_receipt(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = self._map_purchase_receipt_to_erpnext(data)
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Receipt",
            method="POST",
            json_data=erpnext_data
        )
        
        return self._map_purchase_receipt_from_erpnext(result.get("data", result))
    
    async def list_purchase_receipts(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        params = {"limit_page_length": limit}
        
        if filters:
            erp_filters = []
            if filters.get("supplier_id"):
                erp_filters.append(["supplier", "=", filters["supplier_id"]])
            if filters.get("from_date"):
                erp_filters.append(["posting_date", ">=", filters["from_date"]])
            if filters.get("to_date"):
                erp_filters.append(["posting_date", "<=", filters["to_date"]])
            
            if erp_filters:
                params["filters"] = erp_filters
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Receipt",
            method="GET",
            params=params
        )
        
        receipts = [self._map_purchase_receipt_from_erpnext(pr) for pr in (result or [])]
        
        return {"receipts": receipts, "total": len(receipts)}
    
    async def get_purchase_receipt(
        self,
        tenant_id: str,
        receipt_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Receipt/{receipt_id}",
            method="GET"
        )
        
        return self._map_purchase_receipt_from_erpnext(result.get("data", result))
    
    # ==================== Purchase Invoice Operations ====================
    
    async def create_purchase_invoice(
        self,
        tenant_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        erpnext_data = self._map_purchase_invoice_to_erpnext(data)
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Invoice",
            method="POST",
            json_data=erpnext_data
        )
        
        return self._map_purchase_invoice_from_erpnext(result.get("data", result))
    
    async def list_purchase_invoices(
        self,
        tenant_id: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        params = {"limit_page_length": limit}
        
        if filters:
            erp_filters = []
            if filters.get("supplier_id"):
                erp_filters.append(["supplier", "=", filters["supplier_id"]])
            if filters.get("from_date"):
                erp_filters.append(["posting_date", ">=", filters["from_date"]])
            if filters.get("to_date"):
                erp_filters.append(["posting_date", "<=", filters["to_date"]])
            
            if erp_filters:
                params["filters"] = erp_filters
        
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Purchase Invoice",
            method="GET",
            params=params
        )
        
        invoices = [self._map_purchase_invoice_from_erpnext(pi) for pi in (result or [])]
        
        return {"invoices": invoices, "total": len(invoices)}
    
    async def get_purchase_invoice(
        self,
        tenant_id: str,
        invoice_id: str
    ) -> Dict[str, Any]:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Purchase Invoice/{invoice_id}",
            method="GET"
        )
        
        return self._map_purchase_invoice_from_erpnext(result.get("data", result))
    
    # ==================== Field Mapping Methods ====================
    
    def _map_supplier_to_erpnext(self, data: Dict) -> Dict:
        """Map MoranERP supplier to ERPNext Supplier"""
        return {
            "supplier_name": data.get("name"),
            "supplier_group": data.get("supplier_group", "All Supplier Groups"),
            "country": data.get("country"),
            "tax_id": data.get("tax_id"),
            "supplier_primary_contact": data.get("contact_person"),
            "supplier_primary_address": data.get("address"),
            "payment_terms": data.get("payment_terms"),
            "default_currency": data.get("currency", "KES")
        }
    
    def _map_supplier_from_erpnext(self, data: Dict) -> Dict:
        """Map ERPNext Supplier to MoranERP supplier"""
        return {
            "id": data.get("name"),
            "name": data.get("supplier_name"),
            "supplier_group": data.get("supplier_group"),
            "country": data.get("country"),
            "tax_id": data.get("tax_id"),
            "contact_person": data.get("supplier_primary_contact"),
            "payment_terms": data.get("payment_terms"),
            "currency": data.get("default_currency"),
            "disabled": data.get("disabled", 0),
            "created_at": data.get("creation")
        }
    
    def _map_purchase_order_to_erpnext(self, data: Dict) -> Dict:
        """Map MoranERP purchase order to ERPNext Purchase Order"""
        return {
            "supplier": data.get("supplier_id"),
            "transaction_date": data.get("order_date"),
            "schedule_date": data.get("delivery_date"),
            "currency": data.get("currency", "KES"),
            "items": [
                {
                    "item_code": item.get("item_code"),
                    "item_name": item.get("item_name"),
                    "qty": item.get("qty"),
                    "rate": item.get("rate"),
                    "uom": item.get("uom"),
                    "warehouse": item.get("warehouse")
                }
                for item in data.get("items", [])
            ],
            "taxes": data.get("taxes", []),
            "payment_terms_template": data.get("payment_terms"),
            "remarks": data.get("notes")
        }
    
    def _map_purchase_order_from_erpnext(self, data: Dict) -> Dict:
        """Map ERPNext Purchase Order to MoranERP purchase order"""
        status_map = {0: "Draft", 1: "Submitted", 2: "Cancelled"}
        
        return {
            "id": data.get("name"),
            "supplier": data.get("supplier"),
            "supplier_id": data.get("supplier"),
            "order_date": data.get("transaction_date"),
            "delivery_date": data.get("schedule_date"),
            "status": status_map.get(data.get("docstatus", 0), "Draft"),
            "currency": data.get("currency"),
            "total_amount": data.get("total"),
            "tax_amount": data.get("total_taxes_and_charges"),
            "grand_total": data.get("grand_total"),
            "items_count": len(data.get("items", [])),
            "created_by": data.get("owner"),
            "created_at": data.get("creation")
        }
    
    def _map_purchase_receipt_to_erpnext(self, data: Dict) -> Dict:
        """Map MoranERP purchase receipt to ERPNext Purchase Receipt"""
        return {
            "supplier": data.get("supplier_id"),
            "posting_date": data.get("posting_date"),
            "items": [
                {
                    "item_code": item.get("item_code"),
                    "qty": item.get("qty"),
                    "rate": item.get("rate"),
                    "warehouse": item.get("warehouse"),
                    "quality_inspection": item.get("quality_inspection")
                }
                for item in data.get("items", [])
            ],
            "remarks": data.get("notes")
        }
    
    def _map_purchase_receipt_from_erpnext(self, data: Dict) -> Dict:
        """Map ERPNext Purchase Receipt to MoranERP purchase receipt"""
        return {
            "id": data.get("name"),
            "supplier": data.get("supplier"),
            "posting_date": data.get("posting_date"),
            "grand_total": data.get("grand_total"),
            "created_at": data.get("creation")
        }
    
    def _map_purchase_invoice_to_erpnext(self, data: Dict) -> Dict:
        """Map MoranERP purchase invoice to ERPNext Purchase Invoice"""
        return {
            "supplier": data.get("supplier_id"),
            "bill_no": data.get("bill_no"),
            "bill_date": data.get("bill_date"),
            "due_date": data.get("due_date"),
            "posting_date": data.get("bill_date"),
            "items": [
                {
                    "item_code": item.get("item_code"),
                    "qty": item.get("qty"),
                    "rate": item.get("rate"),
                    "amount": item.get("amount")
                }
                for item in data.get("items", [])
            ],
            "taxes": data.get("taxes", [])
        }
    
    def _map_purchase_invoice_from_erpnext(self, data: Dict) -> Dict:
        """Map ERPNext Purchase Invoice to MoranERP purchase invoice"""
        return {
            "id": data.get("name"),
            "supplier": data.get("supplier"),
            "bill_no": data.get("bill_no"),
            "bill_date": data.get("bill_date"),
            "due_date": data.get("due_date"),
            "grand_total": data.get("grand_total"),
            "outstanding_amount": data.get("outstanding_amount"),
            "created_at": data.get("creation")
        }
