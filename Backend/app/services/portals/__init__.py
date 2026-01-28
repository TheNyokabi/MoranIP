"""
Portal Services

Provides self-service portals for:
- Customers: Orders, invoices, quotes, statements
- Suppliers: Purchase orders, confirmations, invoices, catalogs
"""

from .customer_portal import CustomerPortalService
from .supplier_portal import SupplierPortalService

__all__ = [
    "CustomerPortalService",
    "SupplierPortalService"
]
