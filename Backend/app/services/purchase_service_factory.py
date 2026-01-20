"""
Purchase Service Factory

Factory pattern to instantiate the appropriate purchase service
based on the tenant's ERP engine.

Author: MoranERP Team
"""

from .purchase_service_base import PurchaseServiceBase
from .erpnext_purchase_service import ERPNextPurchaseService


def get_purchase_service(engine: str) -> PurchaseServiceBase:
    """
    Factory to get appropriate purchase service based on ERP engine.
    
    Args:
        engine: ERP engine name ('erpnext', 'odoo', 'sap', etc.)
    
    Returns:
        Concrete implementation of PurchaseServiceBase
    
    Raises:
        ValueError: If engine is not supported
    """
    if engine == "erpnext":
        return ERPNextPurchaseService()
    elif engine == "odoo":
        # Future: return OdooPurchaseService()
        raise NotImplementedError("Odoo adapter not yet implemented")
    elif engine == "sap":
        # Future: return SAPPurchaseService()
        raise NotImplementedError("SAP adapter not yet implemented")
    else:
        raise ValueError(f"Unsupported ERP engine: {engine}")
