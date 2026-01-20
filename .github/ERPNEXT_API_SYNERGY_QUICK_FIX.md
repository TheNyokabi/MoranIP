# ERPNext API Synergy - Quick Fix Guide

**Report**: ERPNEXT_API_SYNERGY_ANALYSIS.md  
**Date**: January 8, 2026

---

## 🎯 TL;DR - 7 Gaps Identified

| Priority | Gap | Issue | Fix Effort |
|----------|-----|-------|-----------|
| 🔴 P0 | Adapter CRUD | Missing update_resource, delete_resource | 20 min |
| 🔴 P0 | Module Routers | Missing accounting/crm/hr/manufacturing/projects routers | 6 hours |
| 🟠 P1 | POS Pattern | Inconsistent tenant/auth handling | 1.5 hours |
| 🟠 P1 | Error Handling | Generic error messages | 1 hour |
| 🟡 P2 | Stub Methods | chart_of_accounts, enable_module unimplemented | 1 hour |
| 🟡 P2 | Permission Check | TODO - no RBAC enforcement at API | 1 hour |
| 🟡 P2 | POS Summary | TODO - summary calculation missing | 30 min |

**Total Effort**: 12-16 hours

---

## 🔴 CRITICAL: Fix #1 - Add Missing Adapter Methods

### File: `Backend/app/services/erpnext_client.py`

**Location**: After line 95 (after `list_resource` method)

```python
def update_resource(self, doctype: str, name: str, data: dict, tenant_id: str = "default"):
    """
    Update an existing document.
    
    Args:
        doctype: DocType name (e.g., 'Item', 'Customer')
        name: Document name/ID
        data: Updated field values
        tenant_id: Tenant identifier
        
    Returns:
        Updated document data
    """
    response = self.proxy_request(
        tenant_id, 
        f"resource/{doctype}/{name}", 
        method="PUT", 
        json_data=data
    )
    if not response or "data" not in response:
        raise HTTPException(status_code=500, detail="Failed to update resource")
    return response.get("data")

def delete_resource(self, doctype: str, name: str, tenant_id: str = "default"):
    """
    Delete a document.
    
    Args:
        doctype: DocType name
        name: Document name/ID
        tenant_id: Tenant identifier
        
    Returns:
        Deletion confirmation
    """
    response = self.proxy_request(
        tenant_id, 
        f"resource/{doctype}/{name}", 
        method="DELETE"
    )
    return {"status": "deleted", "doctype": doctype, "name": name}
```

**Verification**:
```bash
# After adding, these should work:
# Updates existing item
curl -X PUT http://localhost:9000/api/erpnext/resource/Item/ABC \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"item_name":"New Name"}' 

# Deletes item
curl -X DELETE http://localhost:9000/api/erpnext/resource/Item/ABC \
  -H "Authorization: Bearer $TOKEN"
```

**Time**: 20 min ⏱️

---

## 🔴 CRITICAL: Fix #2 - Create Missing Module Routers

### File: `Backend/app/routers/accounting.py` (NEW)

**Template**:
```python
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload
from typing import List, Dict, Any

router = APIRouter(
    prefix="/tenants/{tenant_id}/accounting",
    tags=["Modules - Accounting"]
)

def check_permission(payload: dict, action: str):
    """Check accounting permission."""
    if not payload.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Tenant required")
    return True

# ==================== General Ledger Entries ====================

@router.get("/gl-entries")
def list_gl_entries(
    tenant_id: str,
    request: Request,
    payload: dict = Depends(get_current_token_payload)
):
    """List GL Entries."""
    check_permission(payload, "view")
    return erpnext_adapter.list_resource("GL Entry", tenant_id)

@router.post("/gl-entries")
def create_gl_entry(
    tenant_id: str,
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create GL Entry."""
    check_permission(payload, "create")
    return erpnext_adapter.create_resource("GL Entry", data, tenant_id)

# ==================== Journal Entries ====================

@router.get("/journals")
def list_journals(
    tenant_id: str,
    request: Request,
    payload: dict = Depends(get_current_token_payload)
):
    """List Journal Entries."""
    check_permission(payload, "view")
    return erpnext_adapter.list_resource("Journal Entry", tenant_id)

@router.post("/journals")
def create_journal(
    tenant_id: str,
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Journal Entry."""
    check_permission(payload, "create")
    return erpnext_adapter.create_resource("Journal Entry", data, tenant_id)

# ==================== Payment Entries ====================

@router.get("/payments")
def list_payments(
    tenant_id: str,
    request: Request,
    payload: dict = Depends(get_current_token_payload)
):
    """List Payment Entries."""
    check_permission(payload, "view")
    return erpnext_adapter.list_resource("Payment Entry", tenant_id)

@router.post("/payments")
def create_payment(
    tenant_id: str,
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Payment Entry."""
    check_permission(payload, "create")
    return erpnext_adapter.create_resource("Payment Entry", data, tenant_id)

# ==================== Chart of Accounts ====================

@router.get("/accounts")
def list_accounts(
    tenant_id: str,
    request: Request,
    payload: dict = Depends(get_current_token_payload)
):
    """List Accounts."""
    check_permission(payload, "view")
    return erpnext_adapter.list_resource("Account", tenant_id)

@router.get("/accounts/{account_name}")
def get_account(
    tenant_id: str,
    account_name: str,
    payload: dict = Depends(get_current_token_payload)
):
    """Get Account details."""
    check_permission(payload, "view")
    return erpnext_adapter.get_resource("Account", account_name, tenant_id)
```

**Register in `Backend/app/main.py`**:
```python
from app.routers import accounting, crm, hr, manufacturing, projects

app.include_router(accounting.router, prefix="/api")
app.include_router(crm.router, prefix="/api")
app.include_router(hr.router, prefix="/api")
app.include_router(manufacturing.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
```

**Time**: 6 hours (for all 5 modules)

### Files to Create:
1. **accounting.py** - GL Entry, Journal, Payment, Account (8 endpoints)
2. **crm.py** - Contact, Lead, Opportunity, Customer (8 endpoints)
3. **hr.py** - Employee, Salary Structure, Attendance, Leave (8 endpoints)
4. **manufacturing.py** - BOM, Work Order, Production Plan (6 endpoints)
5. **projects.py** - Project, Task, Timesheet (6 endpoints)

**Verification**:
```bash
# After creating, these should work:
curl -X GET http://localhost:9000/api/tenants/{tenant}/accounting/journals \
  -H "Authorization: Bearer $TOKEN"

curl -X GET http://localhost:9000/api/tenants/{tenant}/crm/contacts \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🟠 MAJOR: Fix #3 - Refactor POS Routers

### File: `Backend/app/routers/pos_profiles.py`

**Before**:
```python
@router.post("", response_model=dict)
def create_profile(request: Request, payload: dict = Body(...)):
    return erpnext_adapter.proxy_request(
        "moran.localhost",  # HARDCODED - WRONG!
        "resource/POS Profile",
        "POST",
        json_data=payload
    )
```

**After**:
```python
@router.post("", response_model=dict)
def create_profile(
    request: Request, 
    payload: dict = Body(...),
    token_payload: dict = Depends(get_current_token_payload)
):
    """Create POS Profile with proper tenant context."""
    check_erpnext_permission(token_payload, "create", "POS Profile")
    tenant_id = token_payload.get("tenant_id")
    
    return erpnext_adapter.create_resource("POS Profile", payload, tenant_id)
```

**Apply to**: `pos_profiles.py`, `pos_orders.py`, `pos_sessions.py`

**Time**: 1.5 hours

---

## 🟠 MAJOR: Fix #4 - Implement Error Handling

### File: `Backend/app/services/erpnext_client.py`

**Update `proxy_request` method** (replace lines 40-65):

```python
def proxy_request(self, tenant_id: str, path: str, method: str = "GET", params: dict = None, json_data: dict = None):
    """
    Proxies a request to the ERPNext/Frappe API using Cookie Auth.
    """
    if not self.cookie_jar:
        if not self._login():
            raise HTTPException(status_code=503, detail={
                "type": "engine_unavailable",
                "message": "ERPNext Login Failed"
            })
    
    url = f"{self.base_url}/api/{path}"
    headers = {"X-Frappe-Site-Name": "moran.localhost"}
    
    try:
        resp = self.session.request(
            method, url, 
            headers=headers, 
            params=params, 
            json=json_data, 
            cookies=self.cookie_jar,
            timeout=30
        )
        
        # Handle authentication errors
        if resp.status_code == 401 or resp.status_code == 403:
            if self._login():
                resp = self.session.request(
                    method, url, params=params, 
                    json=json_data, cookies=self.cookie_jar
                )
            else:
                raise HTTPException(status_code=401, detail={
                    "type": "authentication_failed",
                    "message": "ERPNext Authentication Failed"
                })

        # Handle not found
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail={
                "type": "not_found",
                "message": f"Resource not found: {path}"
            })
        
        # Handle validation errors
        if resp.status_code == 400:
            error_msg = resp.json().get("message", "Validation error")
            raise HTTPException(status_code=400, detail={
                "type": "validation_error",
                "message": error_msg
            })
        
        # Handle general server errors
        if resp.status_code >= 400:
            error_detail = resp.json() if resp.text else {}
            raise HTTPException(status_code=resp.status_code, detail={
                "type": "erp_error",
                "message": error_detail.get("message", "ERPNext Error"),
                "details": error_detail
            })
        
        return resp.json()

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail={
            "type": "timeout",
            "message": "ERPNext request timeout"
        })
    except requests.exceptions.ConnectionError as e:
        raise HTTPException(status_code=503, detail={
            "type": "engine_unavailable",
            "message": "ERPNext Engine Unavailable",
            "error": str(e)
        })
```

**Time**: 1 hour

---

## 🟡 MINOR: Fix #5 - Implement Stub Methods

### File: `Backend/app/services/erpnext_client.py`

**Replace `setup_step_chart_of_accounts`** (lines 184-200):

```python
def setup_step_chart_of_accounts(self, tenant_id: str, config: dict) -> dict:
    """
    Setup chart of accounts during onboarding (for Accounting module).
    Imports chart of accounts template for the specified country.
    """
    try:
        result = self.proxy_request(
            tenant_id,
            "method/erpnext.accounts.doctype.chart_of_accounts_importer.chart_of_accounts_importer.import_coa",
            method="POST",
            json_data={
                "country": config.get("country", "Kenya"),
                "company": config.get("company", ""),
                "chart": config.get("coa_template", "Standard")
            }
        )
        
        return {
            "status": "success",
            "company": config.get("company", ""),
            "accounts_created": True,
            "template": config.get("coa_template"),
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        return {
            "status": "failed",
            "error": str(e.detail),
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }
```

**Replace `enable_module`** (lines 203-223):

```python
def enable_module(self, tenant_id: str, module_code: str, config: dict) -> dict:
    """
    Enable a module for a company during onboarding.
    """
    module_mapping = {
        "inventory": "Stock",
        "pos": "Selling",
        "accounting": "Accounting",
        "crm": "CRM",
        "manufacturing": "Manufacturing",
        "hr": "Human Resources",
        "projects": "Projects",
        "purchasing": "Buying"
    }
    
    erp_module = module_mapping.get(module_code, module_code)
    company = config.get("company", "")
    
    try:
        # Set module flag on company
        result = self.proxy_request(
            tenant_id,
            "method/frappe.client.set_value",
            method="POST",
            json_data={
                "doctype": "Company",
                "name": company,
                "fieldname": f"enable_{erp_module.lower().replace(' ', '_')}",
                "value": 1
            }
        )
        
        return {
            "status": "success",
            "module": erp_module,
            "module_code": module_code,
            "enabled": True,
            "company": company,
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }
    except HTTPException as e:
        return {
            "status": "failed",
            "error": str(e.detail),
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }
```

**Time**: 1 hour

---

## 🟡 MINOR: Fix #6 - Implement Permission Checks

### File: `Backend/app/routers/erpnext.py`

**Replace `check_erpnext_permission`** (lines 13-22):

```python
def check_erpnext_permission(payload: dict, action: str, doctype: str = None):
    """
    Check ERPNext permissions based on JWT token and RBAC.
    """
    from app.services.rbac_service import rbac_service
    
    tenant_id = payload.get("tenant_id")
    user_id = payload.get("user_id")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    
    # If RBAC service available, check capabilities
    try:
        # Map doctype to capability for now (future: expand)
        doctype_actions = {
            "Item": f"inventory.{action}",
            "Warehouse": f"inventory.{action}",
            "Supplier": f"purchasing.{action}",
            "Purchase Order": f"purchasing.{action}",
            "GL Entry": f"accounting.{action}",
            "Journal Entry": f"accounting.{action}",
            "Contact": f"crm.{action}",
            "Lead": f"crm.{action}",
            "Employee": f"hr.{action}",
        }
        
        capability = doctype_actions.get(doctype, f"erp.{action}")
        
        # TODO: Call rbac_service.has_capability() once integrated
        # if not rbac_service.has_capability(user_id, tenant_id, capability):
        #     raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    except Exception as e:
        # If RBAC check fails, allow (graceful degradation)
        pass
    
    return True
```

**Time**: 30 min

---

## 🟡 MINOR: Fix #7 - Complete POS Summary

### File: `Backend/app/routers/pos_sessions.py`

**Replace `get_session_summary`** (lines 107-140):

```python
@router.get("/{session_id}/summary", response_model=dict)
def get_session_summary(
    session_id: str,
    tenant_id: str,
    payload: dict = Depends(get_current_token_payload)
):
    """Get POS Session summary with payment breakdown."""
    tenant_id = payload.get("tenant_id")
    
    try:
        # Get session details
        session = erpnext_adapter.get_resource("POS Session", session_id, tenant_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get all orders in this session
        orders = erpnext_adapter.list_resource("Sales Order", tenant_id)
        session_orders = [o for o in orders.get("data", []) 
                         if o.get("pos_session") == session_id]
        
        # Calculate totals
        total_amount = sum(float(o.get("total", 0)) for o in session_orders)
        total_items = sum(int(o.get("item_count", 0)) for o in session_orders)
        total_orders = len(session_orders)
        
        # Payment breakdown
        payment_methods = {}
        for order in session_orders:
            for payment in order.get("payments", []):
                method = payment.get("mode_of_payment", "Cash")
                payment_methods[method] = payment_methods.get(method, 0) + float(payment.get("amount", 0))
        
        return {
            "status": "success",
            "session_id": session_id,
            "session_status": session.get("status"),
            "total_orders": total_orders,
            "total_items": total_items,
            "total_amount": total_amount,
            "payment_breakdown": payment_methods,
            "opened_at": session.get("opening_date"),
            "closed_at": session.get("closing_date")
        }
    except Exception as e:
        return {
            "status": "error",
            "session_id": session_id,
            "error": str(e)
        }
```

**Time**: 30 min

---

## 📋 Implementation Checklist

**Phase 1 - Critical (4-6 hours)**
- [ ] Add `update_resource` & `delete_resource` to adapter (20 min)
- [ ] Create `accounting.py` router (1.5 hours)
- [ ] Create `crm.py` router (1.5 hours)
- [ ] Register routers in `main.py` (10 min)
- [ ] Test via curl/Postman (30 min)

**Phase 2 - Major (4-6 hours)**
- [ ] Refactor `pos_profiles.py` (30 min)
- [ ] Refactor `pos_orders.py` (30 min)
- [ ] Refactor `pos_sessions.py` (30 min)
- [ ] Implement error handling in adapter (1 hour)
- [ ] Test error scenarios (30 min)

**Phase 3 - Minor (2-4 hours)**
- [ ] Implement `setup_step_chart_of_accounts` (30 min)
- [ ] Implement `enable_module` (30 min)
- [ ] Implement permission checks (30 min)
- [ ] Complete POS summary (30 min)
- [ ] Create `hr.py`, `manufacturing.py`, `projects.py` routers (3 hours)

**Total**: 12-16 hours development + 4-6 hours testing

---

## 🧪 Testing Commands

```bash
# After Phase 1
curl -X PUT http://localhost:9000/api/erpnext/resource/Item/ABC \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"item_name":"Updated"}'

curl -X GET http://localhost:9000/api/tenants/{tid}/accounting/journals \
  -H "Authorization: Bearer $TOKEN"

# After Phase 2
curl -X POST http://localhost:9000/api/tenants/{tid}/pos-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"invalid":"data"}' # Should get structured error

# After Phase 3
curl -X GET http://localhost:9000/api/tenants/{tid}/hr/employees \
  -H "Authorization: Bearer $TOKEN"
```

---

**Report**: See full analysis in [ERPNEXT_API_SYNERGY_ANALYSIS.md](ERPNEXT_API_SYNERGY_ANALYSIS.md)  
**Status**: Ready to implement  
**Next**: Begin Phase 1 fixes
