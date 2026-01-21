from fastapi import APIRouter, Depends, HTTPException, Request, Body
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload
from app.middleware.response_normalizer import ResponseNormalizer
from app.models.iam import Capability
from sqlalchemy.orm import Session
from app.database import get_db
from typing import Any, Dict, Optional, List
import re

router = APIRouter(
    prefix="/erpnext",
    tags=["Engines - ERPNext"]
)


@router.get("/health")
def erpnext_health_check(
    payload: dict = Depends(get_current_token_payload)
):
    """
    Diagnostic endpoint to check ERPNext connectivity and authentication.
    Useful for troubleshooting connection issues.
    Returns detailed connection status information.
    """
    from app.services.erpnext_client import ERPNextClientAdapter
    from app.config import settings
    
    tenant_id = payload.get("tenant_id")
    # Create a fresh adapter instance for diagnostics
    adapter = ERPNextClientAdapter(tenant_id=tenant_id)
    
    health_status = {
        "erpnext_host": settings.ERPNEXT_HOST,
        "erpnext_site": getattr(settings, "ERPNEXT_SITE", "moran.localhost"),
        "erpnext_user": settings.ERPNEXT_USER,
        "tenant_id": tenant_id,
        "resolved_site": adapter._resolve_site_name(tenant_id),
        "connected": False,
        "authenticated": False,
        "error": None,
        "message": ""
    }
    
    try:
        # Test connection and login
        login_success, login_error = adapter._login(tenant_id)
        health_status["connected"] = True

        # Some ERPNext/Frappe versions return {"message": "Logged In"} on success.
        # A few older adapter implementations surfaced that message as an "error" even
        # when authentication succeeded. Treat it as success to avoid false negatives.
        if login_success or (isinstance(login_error, str) and login_error.strip() == "Logged In"):
            health_status["authenticated"] = True
            health_status["message"] = "ERPNext is connected and authenticated successfully"
            return health_status
        else:
            health_status["authenticated"] = False
            health_status["error"] = login_error or "Login failed"
            health_status["message"] = f"ERPNext connection successful but authentication failed: {login_error}"
            raise HTTPException(status_code=503, detail=health_status)
    except HTTPException:
        # Re-raise HTTP exceptions (already formatted)
        raise
    except Exception as e:
        health_status["connected"] = False
        health_status["error"] = str(e)
        health_status["message"] = f"Failed to connect to ERPNext: {str(e)}"
        raise HTTPException(status_code=503, detail=health_status)


def check_erpnext_permission(
    payload: dict, 
    action: str, 
    doctype: str = None,
    db: Session = None,
    request: Request = None
):
    """
    Check ERPNext permissions based on JWT token and RBAC capabilities.
    
    Maps DocTypes to capabilities:
    - Item, Warehouse, Stock Entry → inventory.*
    - Customer, Lead, Contact → crm.*
    - GL Entry, Journal Entry → accounting.*
    - Employee, Attendance → hr.*
    - BOM, Work Order → manufacturing.*
    - Project, Task → projects.*
    - POS Profile, POS Order → pos.*
    
    Args:
        payload: JWT token payload with tenant_id, user_code, roles
        action: Action type ('view', 'create', 'edit', 'delete')
        doctype: DocType name (optional - if not provided, allow if authenticated)
        db: Database session for RBAC lookup
        request: FastAPI Request object to check headers for tenant_id
        
    Raises:
        HTTPException: 403 if user lacks required capability
    """
    tenant_id = payload.get("tenant_id")
    tenant_id_from_header = False
    
    # If tenant_id not in payload, try to get from headers (for identity tokens)
    if not tenant_id and request:
        tenant_id = request.headers.get("X-Tenant-ID")
        tenant_id_from_header = bool(tenant_id)
    
    user_code = payload.get("user_code")
    user_id = payload.get("sub")
    is_super_admin = payload.get("is_super_admin", False)
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    
    # If tenant_id came from header (identity token), verify membership
    if tenant_id_from_header and db and user_id:
        try:
            import uuid
            from app.models.iam import Membership
            from sqlalchemy import select
            
            user_uuid = uuid.UUID(user_id)
            tenant_uuid = uuid.UUID(tenant_id)
            
            # SUPER_ADMIN bypasses membership check
            if not is_super_admin:
                stmt = select(Membership).where(
                    Membership.user_id == user_uuid,
                    Membership.tenant_id == tenant_uuid,
                    Membership.status == 'ACTIVE'
                )
                membership = db.execute(stmt).scalar_one_or_none()
                
                if not membership:
                    raise HTTPException(
                        status_code=403,
                        detail="Not a member of this tenant"
                    )
        except HTTPException:
            raise
        except (ValueError, TypeError) as e:
            # Invalid UUID format - log but don't fail (might be a different ID format)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Invalid tenant ID format in header: {tenant_id}, error: {e}")
        except Exception as e:
            # Log but don't fail - allow request to proceed
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error verifying tenant membership: {e}")
    
    # If no DocType specified, just check authentication
    if not doctype or not db:
        return True
    
    # Map DocTypes to capabilities
    doctype_capability_map = {
        # Inventory
        "Item": "inventory.view",
        "Warehouse": "inventory.view",
        "Stock Entry": "inventory.create",
        "Stock Transfer": "inventory.create",
        # CRM
        "Customer": "crm.view",
        "Contact": "crm.view",
        "Lead": "crm.create",
        "Opportunity": "crm.create",
        # Accounting
        "GL Entry": "accounting.view",
        "Journal Entry": "accounting.create",
        "Payment Entry": "accounting.create",
        "Account": "accounting.view",
        "Sales Invoice": "accounting.view",
        # HR
        "Employee": "hr.view",
        "Attendance": "hr.create",
        "Leave": "hr.create",
        "Salary Structure": "hr.view",
        # Manufacturing
        "BOM": "manufacturing.view",
        "Work Order": "manufacturing.create",
        "Production Plan": "manufacturing.view",
        # Projects
        "Project": "projects.view",
        "Task": "projects.create",
        "Timesheet": "projects.create",
        # POS
        "POS Profile": "pos.view",
        "POS Order": "pos.create",
        "POS Session": "pos.view",
    }
    
    # Map action to required capability suffix
    action_map = {
        "view": "view",
        "read": "view",
        "list": "view",
        "create": "create",
        "edit": "edit",
        "update": "edit",
        "delete": "delete",
        "write": "edit"
    }
    
    capability_suffix = action_map.get(action, "view")
    required_capability_pattern = doctype_capability_map.get(doctype)
    
    # If DocType not in map, allow (assume permission granted)
    if not required_capability_pattern:
        return True
    
    # For actions other than 'view', require explicit edit/create/delete capability
    if capability_suffix != "view":
        required_capability = required_capability_pattern.replace(".view", f".{capability_suffix}")
    else:
        required_capability = required_capability_pattern
    
    try:
        # Query user's capabilities for this tenant
        from app.models.iam import StaffProfile
        
        staff = db.query(StaffProfile).filter(
            StaffProfile.user_code == user_code,
            StaffProfile.tenant_id == tenant_id
        ).first()
        
        if not staff:
            raise HTTPException(
                status_code=403, 
                detail=f"No staff profile found for user in tenant {tenant_id}"
            )
        
        # Check if user has required capability
        has_capability = db.query(Capability).filter(
            Capability.staff_id == staff.id,
            Capability.name == required_capability,
            Capability.is_active == True
        ).first()
        
        if not has_capability:
            raise HTTPException(
                status_code=403, 
                detail=f"User lacks required capability: {required_capability} for {doctype}"
            )
        
        return True
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error but don't fail - allow if we can't verify (fail-open for now)
        print(f"Permission check error for {user_code}: {str(e)}")
        return True


# --- Resources ---

@router.get("/resource/{doctype}")
def list_resource(
    doctype: str, 
    request: Request,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    List documents of a specific DocType.
    Requires authentication and 'view' capability for DocType.
    """
    check_erpnext_permission(payload, "view", doctype, db, request)
    tenant_id = payload.get("tenant_id") or request.headers.get("X-Tenant-ID")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required. Please select a workspace or provide X-Tenant-ID header.")

    response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/{doctype}",
        method="GET",
        params=dict(request.query_params),
    )
    return ResponseNormalizer.normalize_erpnext(response)


@router.post("/resource/{doctype}")
def create_resource(
    doctype: str, 
    request: Request, 
    payload: Dict[str, Any] = Body(...),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Create a new document.
    Requires authentication and 'create' capability for DocType.
    """
    check_erpnext_permission(token_payload, "create", doctype, db, request)
    tenant_id = token_payload.get("tenant_id") or request.headers.get("X-Tenant-ID")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required. Please select a workspace or provide X-Tenant-ID header.")

    def _extract_missing_links(msg: str) -> tuple[list[str], list[str]]:
        """Extract missing Item Group and UOM names from ERPNext error text."""
        missing_item_groups: list[str] = []
        missing_uoms: list[str] = []
        if not msg:
            return missing_item_groups, missing_uoms

        # Example: "Could not find Item Group: Products, Default Unit of Measure: Nos"
        m_ig = re.findall(r"Item Group:\s*([^,]+)", msg, flags=re.IGNORECASE)
        m_uom = re.findall(r"(?:Unit of Measure|UOM):\s*([^,]+)", msg, flags=re.IGNORECASE)
        m_default_uom = re.findall(r"Default Unit of Measure:\s*([^,]+)", msg, flags=re.IGNORECASE)

        for val in (m_ig or []):
            name = (val or "").strip()
            if name:
                missing_item_groups.append(name)
        for val in (m_uom or []) + (m_default_uom or []):
            name = (val or "").strip()
            if name:
                missing_uoms.append(name)

        return list(dict.fromkeys(missing_item_groups)), list(dict.fromkeys(missing_uoms))

    def _ensure_uom(uom_name: str) -> bool:
        """Ensure a UOM exists in ERPNext. Returns True if created or already existed."""
        try:
            erpnext_adapter.get_resource("UOM", uom_name, tenant_id)
            return True
        except HTTPException as e:
            if e.status_code != 404:
                raise
            try:
                erpnext_adapter.create_resource(
                    "UOM",
                    {
                        "uom_name": uom_name,
                        "must_be_whole_number": 1 if uom_name == "Nos" else 0,
                    },
                    tenant_id,
                )
                return True
            except HTTPException as create_err:
                if create_err.status_code == 409:
                    return True
                raise

    def _ensure_item_group(item_group_name: str) -> bool:
        """Ensure an Item Group exists in ERPNext. Returns True if created or already existed."""
        try:
            erpnext_adapter.get_resource("Item Group", item_group_name, tenant_id)
            return True
        except HTTPException as e:
            if e.status_code != 404:
                raise
            try:
                erpnext_adapter.create_resource(
                    "Item Group",
                    {
                        "item_group_name": item_group_name,
                        "parent_item_group": "All Item Groups",
                        "is_group": 0,
                    },
                    tenant_id,
                )
                return True
            except HTTPException as create_err:
                if create_err.status_code == 409:
                    return True
                raise

    try:
        response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/{doctype}",
            method="POST",
            json_data=payload,
        )
        return ResponseNormalizer.normalize_erpnext(response)
    except HTTPException as e:
        # Self-heal common ERPNext defaults for Item creation.
        if doctype == "Item" and e.status_code == 417:
            detail = e.detail
            msg = ""
            if isinstance(detail, dict):
                msg = str(detail.get("message") or "")
            elif isinstance(detail, str):
                msg = detail

            missing_item_groups, missing_uoms = _extract_missing_links(msg)

            # Only auto-create a small, known-safe set of defaults.
            allowed_item_groups = {"Products"}
            allowed_uoms = {"Nos"}

            created_any = False
            for ig in missing_item_groups:
                if ig in allowed_item_groups:
                    created_any = _ensure_item_group(ig) or created_any
            for uom in missing_uoms:
                if uom in allowed_uoms:
                    created_any = _ensure_uom(uom) or created_any

            if created_any:
                response = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/{doctype}",
                    method="POST",
                    json_data=payload,
                )
                return ResponseNormalizer.normalize_erpnext(response)

        raise


@router.get("/resource/{doctype}/{name}")
def get_resource_detail(
    doctype: str, 
    name: str, 
    request: Request,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Get a specific document by name.
    Requires authentication.
    """
    check_erpnext_permission(payload, "view", doctype, db, request)
    tenant_id = payload.get("tenant_id") or request.headers.get("X-Tenant-ID")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required. Please select a workspace or provide X-Tenant-ID header.")

    data = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/{doctype}/{name}",
        method="GET",
    )
    return ResponseNormalizer.normalize_erpnext(data)


@router.put("/resource/{doctype}/{name}")
def update_resource(
    doctype: str, 
    name: str, 
    request: Request, 
    payload: Dict[str, Any] = Body(...),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Update a specific document.
    Requires authentication.
    """
    check_erpnext_permission(token_payload, "edit", doctype, db, request)
    tenant_id = token_payload.get("tenant_id") or request.headers.get("X-Tenant-ID")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required. Please select a workspace or provide X-Tenant-ID header.")

    response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/{doctype}/{name}",
        method="PUT",
        json_data=payload,
    )
    return ResponseNormalizer.normalize_erpnext(response)


@router.delete("/resource/{doctype}/{name}")
def delete_resource(
    doctype: str, 
    name: str, 
    request: Request,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Delete a specific document.
    Requires authentication.
    """
    check_erpnext_permission(payload, "delete", doctype, db, request)
    tenant_id = payload.get("tenant_id") or request.headers.get("X-Tenant-ID")
    
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required. Please select a workspace or provide X-Tenant-ID header.")

    response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/{doctype}/{name}",
        method="DELETE",
    )
    return ResponseNormalizer.normalize_erpnext(response)


# --- RPC Methods ---

@router.post("/method/{method_path:path}")
def execute_method(
    method_path: str, 
    request: Request, 
    payload: Dict[str, Any] = Body(default={}),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Execute an arbitrary RPC method (e.g., 'frappe.auth.get_logged_user').
    Requires authentication.
    """
    check_erpnext_permission(token_payload, "execute", None, db, request)
    tenant_id = token_payload.get("tenant_id") or request.headers.get("X-Tenant-ID", "demo-erpnext")

    response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"method/{method_path}",
        method="POST",
        json_data=payload,
    )
    return ResponseNormalizer.normalize_erpnext(response)
