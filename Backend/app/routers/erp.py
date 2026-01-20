from fastapi import APIRouter, Depends, HTTPException
from app.services.odoo_client import odoo_adapter
from app.dependencies.auth import require_tenant_access, get_current_user
from app.dependencies.permissions import get_current_user_permissions
from typing import List, Dict, Any

router = APIRouter(
    prefix="/erp",
    tags=["ERP Domain"],
)

from app.services.erpnext_client import erpnext_adapter
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.iam import Tenant

@router.get("/partners") # Response_model=List[PartnerDTO] would go here
def list_domain_partners(
    limit: int = 10, 
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    permissions: List[str] = Depends(get_current_user_permissions)
) -> List[Dict[str, Any]]:
    """
    [PUBLIC] List Business Partners.
    Decoupled from underlying engine (Odoo or ERPNext).
    Requires: erp:partners:view permission
    """
    # Check permission
    if "erp:partners:view" not in permissions and "*:*:view" not in permissions:
        raise HTTPException(
            status_code=403,
            detail="Permission denied: erp:partners:view required"
        )
    
    # 1. Resolve Tenant Engine
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    engine = tenant.engine or "odoo"
    
    raw_partners = []

    # 2. Switch & Execute
    if engine == "odoo":
        # Odoo Implementation
        raw_partners = odoo_adapter.execute_kw(
            tenant_id=tenant_id,
            model='res.partner',
            method='search_read',
            args=[[], ['name', 'email', 'phone', 'is_company']],
            kwargs={'limit': limit}
        )
        # Odoo Normalization
        return normalize_odoo_partners(raw_partners)

    elif engine == "erpnext":
        # ERPNext Implementation
        # ERPNext returns list of doc dicts
        raw_partners = erpnext_adapter.execute_call(
            tenant_id=tenant_id,
            endpoint="Customer", # or Supplier, or Partner equivalent
            method="GET",
            data={"limit_page_length": limit, "fields": ["name", "customer_name", "email_id", "mobile_no", "customer_type"]}
        ) or []
        
        # ERPNext Normalization
        return normalize_erpnext_partners(raw_partners)
    
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported Engine: {engine}")

def normalize_odoo_partners(raw_list):
    results = []
    for p in raw_list:
        results.append({
            "id": str(p['id']),
            "name": p['name'],
            "email": p.get('email'),
            "phone": p.get('phone'),
            "type": "Company" if p.get('is_company') else "Individual",
            "source": "odoo"
        })
    return results

def normalize_erpnext_partners(raw_list):
    results = []
    for p in raw_list:
        # ERPNext structure: {name: ID, customer_name: Name, ...}
        results.append({
            "id": p.get('name'), # ID is 'name' in Frappe
            "name": p.get('customer_name'),
            "email": p.get('email_id'),
            "phone": p.get('mobile_no'),
            "type": p.get('customer_type', 'Company'), # Company or Individual
            "source": "erpnext"
        })
    return results
