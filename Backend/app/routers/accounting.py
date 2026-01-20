from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/accounting",
    tags=["Modules - Accounting"]
)


def check_permission(payload: dict, action: str, doctype: str = ""):
    """Check accounting permission."""
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    return True


# ==================== General Ledger Entries ====================

@router.get("/gl-entries")
def list_gl_entries(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List GL Entries.
    
    Query parameters: filters, fields, limit_page_length
    """
    check_permission(payload, "view", "GL Entry")
    return erpnext_adapter.list_resource("GL Entry", tenant_id)


@router.post("/gl-entries", status_code=status.HTTP_201_CREATED)
def create_gl_entry(
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Create GL Entry."""
    check_permission(payload, "create", "GL Entry")
    result = erpnext_adapter.create_resource("GL Entry", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/gl-entries/{entry_id}")
def get_gl_entry(
    entry_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get GL Entry details."""
    check_permission(payload, "view", "GL Entry")
    result = erpnext_adapter.get_resource("GL Entry", entry_id, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Journal Entries ====================

@router.get("/journals")
def list_journals(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Journal Entries."""
    check_permission(payload, "view", "Journal Entry")
    result = erpnext_adapter.list_resource("Journal Entry", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/journals", status_code=status.HTTP_201_CREATED)
def create_journal(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Journal Entry.
    
    Required fields:
    - company: str
    - posting_date: date
    - accounts: List[{account: str, debit: float, credit: float}]
    """
    check_permission(payload, "create", "Journal Entry")
    result = erpnext_adapter.create_resource("Journal Entry", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/journals/{journal_id}")
def get_journal(
    journal_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Get Journal Entry details with enriched account information.
    
    Returns:
    - Journal header (company, date, narration)
    - Accounts with enriched details (account_name, cost_center)
    - Summary (total debit, total credit, difference)
    """
    check_permission(payload, "view", "Journal Entry")
    journal = erpnext_adapter.get_resource("Journal Entry", journal_id, tenant_id)
    
    if not journal:
        raise HTTPException(status_code=404, detail="Journal Entry not found")
    
    # Enrich accounts with account details
    if 'accounts' in journal:
        for account in journal['accounts']:
            if account.get('account'):
                try:
                    acc_details = erpnext_adapter.get_resource('Account', account['account'], tenant_id)
                    account['account_name'] = acc_details.get('account_name', '')
                    account['account_type'] = acc_details.get('account_type', '')
                    account['cost_center'] = acc_details.get('cost_center', '')
                except:
                    pass
    
    return journal


@router.put("/journals/{journal_id}")
def update_journal(
    journal_id: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Journal Entry (only if Draft)."""
    check_permission(payload, "edit", "Journal Entry")
    result = erpnext_adapter.update_resource("Journal Entry", journal_id, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/journals/{journal_id}/submit")
def submit_journal(
    journal_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Submit Journal Entry."""
    check_permission(payload, "edit", "Journal Entry")
    
    journal = erpnext_adapter.get_resource("Journal Entry", journal_id, tenant_id)
    if not journal:
        raise HTTPException(status_code=404, detail="Journal Entry not found")
    
    if journal.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only submit Draft journals")
    
    result = erpnext_adapter.proxy_request(
        tenant_id,
        f"method/run_doc_method",
        method="POST",
        json_data={
            "docs": [{"doctype": "Journal Entry", "name": journal_id}],
            "method": "submit"
        }
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/journals/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journal(
    journal_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Journal Entry (only if Draft)."""
    check_permission(payload, "delete", "Journal Entry")
    
    journal = erpnext_adapter.get_resource("Journal Entry", journal_id, tenant_id)
    if not journal:
        raise HTTPException(status_code=404, detail="Journal Entry not found")
    
    if journal.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only delete Draft journals")
    
    erpnext_adapter.delete_resource("Journal Entry", journal_id, tenant_id)
    return None


# ==================== Payment Entries ====================

@router.get("/payments")
def list_payments(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Payment Entries.
    
    Payment Entry can be for Customer or Supplier
    """
    check_permission(payload, "view", "Payment Entry")
    result = erpnext_adapter.list_resource("Payment Entry", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/payments", status_code=status.HTTP_201_CREATED)
def create_payment(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Payment Entry.
    
    Required fields:
    - payment_type: "Pay" | "Receive"
    - party_type: "Customer" | "Supplier"
    - party: party name
    - posting_date: date
    - paid_amount: float
    """
    check_permission(payload, "create", "Payment Entry")
    result = erpnext_adapter.create_resource("Payment Entry", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/payments/{payment_id}")
def get_payment(
    payment_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Payment Entry details."""
    check_permission(payload, "view", "Payment Entry")
    result = erpnext_adapter.get_resource("Payment Entry", payment_id, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Chart of Accounts ====================

@router.get("/accounts")
def list_accounts(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Chart of Accounts.
    
    Query parameters: company (required for filtering)
    """
    check_permission(payload, "view", "Account")
    result = erpnext_adapter.list_resource("Account", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/chart-of-accounts", status_code=status.HTTP_201_CREATED)
def create_account(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create new Chart of Account entry.
    
    Required fields:
    - account_name: str
    - account_type: str (Asset, Liability, Equity, Income, Expense)
    - company: str
    - parent_account: str (optional, for hierarchy)
    - is_group: bool (default: false)
    """
    check_permission(payload, "create", "Account")
    result = erpnext_adapter.create_resource("Account", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/chart-of-accounts")
def list_chart_of_accounts(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Chart of Accounts with filtering options.
    
    Query parameters: 
    - account_type: filter by type
    - is_group: filter by group status
    - company: filter by company
    """
    check_permission(payload, "view", "Account")
    result = erpnext_adapter.list_resource("Account", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/chart-of-accounts/{account_name}")
def get_account(
    account_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Account details including balance, hierarchy, and settings."""
    check_permission(payload, "view", "Account")
    account = erpnext_adapter.get_resource("Account", account_name, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/chart-of-accounts/{account_name}", status_code=status.HTTP_200_OK)
def update_account(
    account_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Update Chart of Account entry.
    
    Updatable fields:
    - account_name: str
    - parent_account: str
    - disabled: bool
    """
    check_permission(payload, "update", "Account")
    updated_account = erpnext_adapter.update_resource("Account", account_name, data, tenant_id)
    if not updated_account:
        raise HTTPException(status_code=404, detail="Account not found")
    return updated_account


@router.delete("/chart-of-accounts/{account_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Chart of Account entry (if no transactions exist)."""
    check_permission(payload, "delete", "Account")
    erpnext_adapter.delete_resource("Account", account_name, tenant_id)
    return None


@router.get("/accounts/{account_name}")
def get_account_legacy(
    account_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Account details including balance (legacy endpoint)."""
    check_permission(payload, "view", "Account")
    account = erpnext_adapter.get_resource("Account", account_name, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


# ==================== Company Setup ====================

@router.get("/companies")
def list_companies(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List all companies for this tenant."""
    check_permission(payload, "view", "Company")
    result = erpnext_adapter.list_resource("Company", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/companies", status_code=status.HTTP_201_CREATED)
def create_company(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create new company.
    
    Required fields:
    - company_name: str
    - company_code: str (e.g., "ACM")
    - country: str
    - default_currency: str (e.g., "KES")
    - company_type: str (Individual, Partnership, Private Limited, Public Limited, Cooperative)
    """
    check_permission(payload, "create", "Company")
    result = erpnext_adapter.create_resource("Company", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/companies/{company_name}")
def get_company(
    company_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get company details including financial year, accounting settings."""
    check_permission(payload, "view", "Company")
    company = erpnext_adapter.get_resource("Company", company_name, tenant_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/companies/{company_name}", status_code=status.HTTP_200_OK)
def update_company(
    company_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Update company information.
    
    Updatable fields:
    - company_name: str
    - website: str
    - phone_no: str
    - company_logo: str
    - country: str
    - address_line_1: str
    - city: str
    - postal_code: str
    """
    check_permission(payload, "update", "Company")
    updated_company = erpnext_adapter.update_resource("Company", company_name, data, tenant_id)
    if not updated_company:
        raise HTTPException(status_code=404, detail="Company not found")
    return updated_company


# ==================== Sales Invoices ====================

@router.get("/sales-invoices")
def list_sales_invoices(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Sales Invoices."""
    check_permission(payload, "view", "Sales Invoice")
    result = erpnext_adapter.list_resource("Sales Invoice", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/sales-invoices", status_code=status.HTTP_201_CREATED)
def create_sales_invoice(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Sales Invoice."""
    check_permission(payload, "create", "Sales Invoice")
    result = erpnext_adapter.create_resource("Sales Invoice", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/sales-invoices/{invoice_id}")
def get_sales_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Sales Invoice with full details including items, customer, taxes."""
    check_permission(payload, "view", "Sales Invoice")
    invoice = erpnext_adapter.get_resource("Sales Invoice", invoice_id, tenant_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales Invoice not found")
    
    # Fetch related customer and item details
    if invoice.get("customer"):
        customer = erpnext_adapter.get_resource("Customer", invoice["customer"], tenant_id)
        if customer:
            invoice["customer_details"] = customer
    
    # Enrich line items with item details
    items = invoice.get("items", [])
    for item in items:
        if item.get("item_code"):
            item_detail = erpnext_adapter.get_resource("Item", item["item_code"], tenant_id)
            if item_detail:
                item["item_details"] = item_detail
    
    return invoice


@router.put("/sales-invoices/{invoice_id}")
def update_sales_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Sales Invoice (only in Draft status)."""
    check_permission(payload, "write", "Sales Invoice")
    
    # Verify invoice exists and is in draft status
    invoice = erpnext_adapter.get_resource("Sales Invoice", invoice_id, tenant_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales Invoice not found")
    
    if invoice.get("docstatus") != 0:  # 0 = Draft, 1 = Submitted, 2 = Cancelled
        raise HTTPException(status_code=403, detail="Can only edit Draft invoices")
    
    result = erpnext_adapter.update_resource("Sales Invoice", invoice_id, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/sales-invoices/{invoice_id}/submit", status_code=status.HTTP_200_OK)
def submit_sales_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Submit Sales Invoice (Draft → Submitted)."""
    check_permission(payload, "submit", "Sales Invoice")
    
    # Use ERPNext's submit endpoint
    result = erpnext_adapter.call_method(
        "frappe.client.submit",
        {"doc": {"doctype": "Sales Invoice", "name": invoice_id}},
        tenant_id
    )
    return result


@router.post("/sales-invoices/{invoice_id}/amend", status_code=status.HTTP_201_CREATED)
def amend_sales_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Create amended copy of submitted Sales Invoice."""
    check_permission(payload, "create", "Sales Invoice")
    
    result = erpnext_adapter.call_method(
        "frappe.client.get_value",
        {"doctype": "Sales Invoice", "filters": {"name": invoice_id}, "fieldname": ["*"]},
        tenant_id
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Sales Invoice not found")
    
    # Create amended version
    amended_doc = result.copy()
    amended_doc["amended_from"] = invoice_id
    amended_doc["docstatus"] = 0
    
    return erpnext_adapter.create_resource("Sales Invoice", amended_doc, tenant_id)


@router.delete("/sales-invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Sales Invoice (only if Draft)."""
    check_permission(payload, "delete", "Sales Invoice")
    
    invoice = erpnext_adapter.get_resource("Sales Invoice", invoice_id, tenant_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales Invoice not found")
    
    if invoice.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only delete Draft invoices")
    
    erpnext_adapter.delete_resource("Sales Invoice", invoice_id, tenant_id)
    return None


# ==================== Payment Entries ====================

@router.get("/payment-entries")
def list_payment_entries(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Payment Entries."""
    check_permission(payload, "view", "Payment Entry")
    result = erpnext_adapter.list_resource("Payment Entry", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/payment-entries", status_code=status.HTTP_201_CREATED)
def create_payment_entry(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Payment Entry.
    
    Required fields:
    - payment_type: 'Receive' or 'Pay'
    - party_type: 'Customer' or 'Supplier'
    - party: Party code
    - posting_date: date
    - reference_no: str
    """
    check_permission(payload, "create", "Payment Entry")
    result = erpnext_adapter.create_resource("Payment Entry", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/payment-entries/{payment_id}")
def get_payment_entry(
    payment_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Get Payment Entry details with enriched invoice references.
    
    Returns:
    - Payment header (party, amount, date)
    - Allocated invoices with original amounts
    - Payment method details
    """
    check_permission(payload, "view", "Payment Entry")
    
    payment = erpnext_adapter.get_resource("Payment Entry", payment_id, tenant_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment Entry not found")
    
    # Enrich with invoice details
    if 'references' in payment:
        for ref in payment['references']:
            if ref.get('reference_doctype') == 'Sales Invoice':
                try:
                    invoice = erpnext_adapter.get_resource('Sales Invoice', ref['reference_name'], tenant_id)
                    ref['invoice_amount'] = invoice.get('grand_total', 0)
                    ref['invoice_date'] = invoice.get('posting_date', '')
                    ref['customer'] = invoice.get('customer', '')
                except:
                    pass
    
    return payment


@router.put("/payment-entries/{payment_id}")
def update_payment_entry(
    payment_id: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Payment Entry (only if Draft)."""
    check_permission(payload, "edit", "Payment Entry")
    result = erpnext_adapter.update_resource("Payment Entry", payment_id, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/payment-entries/{payment_id}/submit")
def submit_payment_entry(
    payment_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Submit Payment Entry."""
    check_permission(payload, "edit", "Payment Entry")
    
    payment = erpnext_adapter.get_resource("Payment Entry", payment_id, tenant_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment Entry not found")
    
    if payment.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only submit Draft payments")
    
    return erpnext_adapter.proxy_request(
        tenant_id,
        f"method/run_doc_method",
        method="POST",
        json_data={
            "docs": [{"doctype": "Payment Entry", "name": payment_id}],
            "method": "submit"
        }
    )


@router.delete("/payment-entries/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_entry(
    payment_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Payment Entry (only if Draft)."""
    check_permission(payload, "delete", "Payment Entry")
    
    payment = erpnext_adapter.get_resource("Payment Entry", payment_id, tenant_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment Entry not found")
    
    if payment.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only delete Draft payments")
    
    erpnext_adapter.delete_resource("Payment Entry", payment_id, tenant_id)
    return None

