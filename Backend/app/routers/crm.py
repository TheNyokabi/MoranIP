from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from sqlalchemy.orm import Session
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.database import get_db
from app.models.iam import Tenant
from app.middleware.response_normalizer import ResponseNormalizer
from app.utils.codes import (
    generate_entity_code,
    PREFIX_CONTACT,
    PREFIX_LEAD,
    PREFIX_SALES_PERSON,
)
from typing import List, Dict, Any

router = APIRouter(
    prefix="/crm",
    tags=["Modules - CRM"]
)


def check_permission(tenant_id: str, action: str, doctype: str = ""):
    """Check CRM permission.
    
    Args:
        tenant_id: The tenant_id resolved by require_tenant_access (from token or X-Tenant-ID header)
        action: The action being performed (view, create, update, delete)
        doctype: The ERPNext doctype being accessed
    """
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    return True


def _get_tenant_country_code(db: Session, tenant_id: str) -> str:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return (tenant.country_code if tenant and tenant.country_code else "GLB")


def _create_with_human_readable_name(
    *,
    tenant_id: str,
    doctype: str,
    data: Dict[str, Any],
    db: Session,
    prefix: str,
) -> Dict[str, Any]:
    """Create a Frappe resource and enforce a stable, human-readable `name` (primary key)."""

    country_code = _get_tenant_country_code(db, tenant_id)
    desired_name = generate_entity_code(prefix, country_code=country_code)

    created = erpnext_adapter.create_resource(doctype, data, tenant_id)
    old_name = created.get("name") if isinstance(created, dict) else None

    if old_name and old_name != desired_name:
        try:
            erpnext_adapter.proxy_request(
                tenant_id,
                "method/frappe.client.rename_doc",
                method="POST",
                json_data={
                    "doctype": doctype,
                    "old_name": old_name,
                    "new_name": desired_name,
                    "merge": 0,
                },
            )
            renamed = erpnext_adapter.get_resource(doctype, desired_name, tenant_id)
            if renamed:
                return renamed
        except Exception:
            pass

    return created


# ==================== Configuration (Master Data) ====================

@router.get("/customer-groups")
def list_customer_groups(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Customer Groups."""
    check_permission(tenant_id, "view", "Customer Group")
    result = erpnext_adapter.list_resource("Customer Group", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/customer-groups", status_code=status.HTTP_201_CREATED)
def create_customer_group(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Customer Group."""
    check_permission(tenant_id, "create", "Customer Group")
    result = erpnext_adapter.create_resource("Customer Group", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/customer-groups/{group_name}")
def get_customer_group(
    group_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Customer Group details."""
    check_permission(tenant_id, "view", "Customer Group")
    group = erpnext_adapter.get_resource("Customer Group", group_name, tenant_id)
    if not group:
        raise HTTPException(status_code=404, detail="Customer Group not found")
    return ResponseNormalizer.normalize_erpnext(group)


@router.put("/customer-groups/{group_name}")
def update_customer_group(
    group_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Customer Group."""
    check_permission(tenant_id, "edit", "Customer Group")
    result = erpnext_adapter.update_resource("Customer Group", group_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/customer-groups/{group_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_group(
    group_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Customer Group."""
    check_permission(tenant_id, "delete", "Customer Group")
    erpnext_adapter.delete_resource("Customer Group", group_name, tenant_id)
    return None


@router.get("/territories")
def list_territories(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Territories."""
    check_permission(tenant_id, "view", "Territory")
    result = erpnext_adapter.list_resource("Territory", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/territories", status_code=status.HTTP_201_CREATED)
def create_territory(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Territory."""
    check_permission(tenant_id, "create", "Territory")
    result = erpnext_adapter.create_resource("Territory", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/territories/{territory_name}")
def get_territory(
    territory_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Territory details."""
    check_permission(tenant_id, "view", "Territory")
    territory = erpnext_adapter.get_resource("Territory", territory_name, tenant_id)
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    return ResponseNormalizer.normalize_erpnext(territory)


@router.put("/territories/{territory_name}")
def update_territory(
    territory_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Territory."""
    check_permission(tenant_id, "edit", "Territory")
    result = erpnext_adapter.update_resource("Territory", territory_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/territories/{territory_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_territory(
    territory_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Territory."""
    check_permission(tenant_id, "delete", "Territory")
    erpnext_adapter.delete_resource("Territory", territory_name, tenant_id)
    return None


@router.get("/sales-persons")
def list_sales_persons(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Sales Persons."""
    check_permission(tenant_id, "view", "Sales Person")
    result = erpnext_adapter.list_resource("Sales Person", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/sales-persons", status_code=status.HTTP_201_CREATED)
def create_sales_person(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
):
    """Create Sales Person."""
    check_permission(tenant_id, "create", "Sales Person")
    result = _create_with_human_readable_name(
        tenant_id=tenant_id,
        doctype="Sales Person",
        data=data,
        db=db,
        prefix=PREFIX_SALES_PERSON,
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/sales-persons/{sales_person_name}")
def get_sales_person(
    sales_person_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Sales Person details."""
    check_permission(tenant_id, "view", "Sales Person")
    sp = erpnext_adapter.get_resource("Sales Person", sales_person_name, tenant_id)
    if not sp:
        raise HTTPException(status_code=404, detail="Sales Person not found")
    return sp


@router.put("/sales-persons/{sales_person_name}")
def update_sales_person(
    sales_person_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Sales Person."""
    check_permission(tenant_id, "edit", "Sales Person")
    result = erpnext_adapter.update_resource("Sales Person", sales_person_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/sales-persons/{sales_person_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_person(
    sales_person_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Sales Person."""
    check_permission(tenant_id, "delete", "Sales Person")
    erpnext_adapter.delete_resource("Sales Person", sales_person_name, tenant_id)
    return None


# ==================== Contacts ====================

@router.get("/contacts")
def list_contacts(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Contacts.
    
    Query parameters: filters, fields, limit_page_length
    """
    check_permission(tenant_id, "view", "Contact")
    result = erpnext_adapter.list_resource("Contact", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
def create_contact(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
):
    """
    Create Contact.
    
    Required fields:
    - first_name: str
    - email_id: str (optional but recommended)
    - is_primary_contact: bool
    """
    check_permission(tenant_id, "create", "Contact")
    result = _create_with_human_readable_name(
        tenant_id=tenant_id,
        doctype="Contact",
        data=data,
        db=db,
        prefix=PREFIX_CONTACT,
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/contacts/{contact_name}")
def get_contact(
    contact_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Contact details."""
    check_permission(tenant_id, "view", "Contact")
    contact = erpnext_adapter.get_resource("Contact", contact_name, tenant_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ResponseNormalizer.normalize_erpnext(contact)


@router.put("/contacts/{contact_name}")
def update_contact(
    contact_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Contact details."""
    check_permission(tenant_id, "edit", "Contact")
    result = erpnext_adapter.update_resource("Contact", contact_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/contacts/{contact_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Contact."""
    check_permission(tenant_id, "delete", "Contact")
    erpnext_adapter.delete_resource("Contact", contact_name, tenant_id)
    return None


# ==================== Leads ====================

@router.get("/leads")
def list_leads(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Leads.
    
    Leads are potential customers with contact information
    """
    check_permission(tenant_id, "view", "Lead")
    result = erpnext_adapter.list_resource("Lead", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/leads", status_code=status.HTTP_201_CREATED)
def create_lead(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
):
    """
    Create Lead.
    
    Required fields:
    - lead_name: str
    - email_id: str (optional)
    - status: "Open" | "Converted" | "Junk" | "Lost"
    """
    check_permission(tenant_id, "create", "Lead")
    result = _create_with_human_readable_name(
        tenant_id=tenant_id,
        doctype="Lead",
        data=data,
        db=db,
        prefix=PREFIX_LEAD,
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/leads/{lead_name}")
def get_lead(
    lead_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Get Lead details with enriched information.
    
    Returns:
    - Lead header (name, email, company, status)
    - Contact information (phone, mobile, website)
    - Sales info (source, rating, industry)
    - Timeline (creation/modification dates)
    """
    check_permission(tenant_id, "view", "Lead")
    lead = erpnext_adapter.get_resource("Lead", lead_name, tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Calculate days as lead (convert to opportunity once converted)
    try:
        from datetime import datetime
        created = datetime.fromisoformat(lead.get('creation', '').replace('Z', '+00:00'))
        days_as_lead = (datetime.now(created.tzinfo) - created).days
        lead['days_as_lead'] = max(0, days_as_lead)
    except:
        lead['days_as_lead'] = 0
    
    return lead


@router.put("/leads/{lead_name}")
def update_lead(
    lead_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Lead details."""
    check_permission(tenant_id, "edit", "Lead")
    result = erpnext_adapter.update_resource("Lead", lead_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/leads/{lead_name}/convert")
def convert_lead(
    lead_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Convert Lead to Customer/Opportunity.
    
    Required fields:
    - to_customer: bool (create Customer)
    - customer_name: str (if to_customer=true)
    """
    check_permission(tenant_id, "edit", "Lead")
    
    lead = erpnext_adapter.get_resource("Lead", lead_name, tenant_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Call ERPNext conversion method
    return erpnext_adapter.proxy_request(
        tenant_id,
        f"method/frappe.client.set_value",
        method="POST",
        json_data={
            "doctype": "Lead",
            "name": lead_name,
            "fieldname": {"status": "Converted"},
            "update_modified": True
        }
    )


@router.delete("/leads/{lead_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Lead."""
    check_permission(tenant_id, "delete", "Lead")
    erpnext_adapter.delete_resource("Lead", lead_name, tenant_id)
    return None


# ==================== Customers ====================

@router.get("/customers")
def list_customers(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Customers.
    
    Customers are accounts converted from Leads
    """
    check_permission(tenant_id, "view", "Customer")
    result = erpnext_adapter.list_resource("Customer", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def create_customer(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Customer.
    
    Required fields:
    - customer_name: str
    - customer_type: "Individual" | "Company"
    - customer_group: str
    """
    check_permission(tenant_id, "create", "Customer")
    result = erpnext_adapter.create_resource("Customer", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/customers/{customer_name}")
def get_customer(
    customer_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Customer details including addresses, contacts, and order history."""
    check_permission(tenant_id, "view", "Customer")
    customer = erpnext_adapter.get_resource("Customer", customer_name, tenant_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Fetch related addresses
    addresses = erpnext_adapter.list_resource(
        "Address",
        tenant_id,
        {"customer": customer_name}
    )
    customer["addresses"] = addresses if addresses else []
    
    # Fetch related contacts
    contacts = erpnext_adapter.list_resource(
        "Contact",
        tenant_id,
        {"customer": customer_name}
    )
    customer["contacts"] = contacts if contacts else []
    
    # Calculate credit statistics
    invoices = erpnext_adapter.list_resource(
        "Sales Invoice",
        tenant_id,
        {
            "customer": customer_name,
            "docstatus": 1  # Submitted invoices only
        }
    )
    
    outstanding_amount = sum([
        float(inv.get("outstanding_amount", 0)) 
        for inv in (invoices if invoices else [])
    ])
    total_value = sum([
        float(inv.get("grand_total", 0)) 
        for inv in (invoices if invoices else [])
    ])
    
    customer["outstanding_invoices_amount"] = outstanding_amount
    customer["total_lifetime_value"] = total_value
    customer["total_orders"] = len(invoices) if invoices else 0
    
    return ResponseNormalizer.normalize_erpnext(customer)


@router.put("/customers/{customer_name}")
def update_customer(
    customer_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Customer details."""
    check_permission(tenant_id, "edit", "Customer")
    result = erpnext_adapter.update_resource("Customer", customer_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/customers/{customer_name}/orders")
def get_customer_orders(
    customer_name: str,
    limit: int = 10,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get recent orders for this customer."""
    check_permission(tenant_id, "view", "Sales Invoice")
    
    orders = erpnext_adapter.list_resource(
        "Sales Invoice",
        tenant_id,
        {
            "customer": customer_name,
            "docstatus": 1  # Submitted only
        },
        {"field_name": "creation", "order": "desc", "limit": limit}
    )
    
    return {
        "customer": customer_name,
        "total_orders": len(orders) if orders else 0,
        "recent_orders": orders[:limit] if orders else []
    }


@router.delete("/customers/{customer_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Customer (only if no outstanding transactions)."""
    check_permission(tenant_id, "delete", "Customer")
    
    # Check if customer has any invoices
    invoices = erpnext_adapter.list_resource(
        "Sales Invoice",
        tenant_id,
        {"customer": customer_name}
    )
    
    if invoices:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete customer with existing invoices"
        )
    
    erpnext_adapter.delete_resource("Customer", customer_name, tenant_id)
    return None


# ==================== Opportunities ====================

@router.get("/opportunities")
def list_opportunities(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Sales Opportunities."""
    check_permission(tenant_id, "view", "Opportunity")
    result = erpnext_adapter.list_resource("Opportunity", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/opportunities", status_code=status.HTTP_201_CREATED)
def create_opportunity(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Opportunity.
    
    Required fields:
    - opportunity_from: "Lead" | "Customer"
    - party_name: Lead or Customer name
    - opportunity_amount: float
    - probability: 0-100
    """
    check_permission(tenant_id, "create", "Opportunity")
    result = erpnext_adapter.create_resource("Opportunity", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/opportunities/{opportunity_name}")
def get_opportunity(
    opportunity_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Opportunity details."""
    check_permission(tenant_id, "view", "Opportunity")
    opportunity = erpnext_adapter.get_resource("Opportunity", opportunity_name, tenant_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return ResponseNormalizer.normalize_erpnext(opportunity)


@router.put("/opportunities/{opportunity_name}")
def update_opportunity(
    opportunity_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Opportunity (e.g., change probability/amount)."""
    check_permission(tenant_id, "edit", "Opportunity")
    return erpnext_adapter.update_resource("Opportunity", opportunity_name, data, tenant_id)
