from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from sqlalchemy.orm import Session
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.database import get_db
from app.models.iam import Tenant
from app.utils.codes import generate_entity_code, PREFIX_EMPLOYEE
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/hr",
    tags=["Modules - HR"]
)


def _get_tenant_country_code(db: Session, tenant_id: str) -> str:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return (tenant.country_code if tenant and tenant.country_code else "GLB")


# ==================== Employees ====================

@router.get("/employees")
def list_employees(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Employees."""
    result = erpnext_adapter.list_resource("Employee", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/employees", status_code=status.HTTP_201_CREATED)
def create_employee(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
):
    """
    Create Employee.
    
    Required fields:
    - first_name: str
    - last_name: str
    - company: str
    - date_of_joining: date
    - designation: str
    """

    country_code = _get_tenant_country_code(db, tenant_id)
    desired_name = generate_entity_code(PREFIX_EMPLOYEE, country_code=country_code)

    created = erpnext_adapter.create_resource("Employee", data, tenant_id)
    old_name = created.get("name") if isinstance(created, dict) else None

    if old_name and old_name != desired_name:
        try:
            erpnext_adapter.proxy_request(
                tenant_id,
                "method/frappe.client.rename_doc",
                method="POST",
                json_data={
                    "doctype": "Employee",
                    "old_name": old_name,
                    "new_name": desired_name,
                    "merge": 0,
                },
            )
            renamed = erpnext_adapter.get_resource("Employee", desired_name, tenant_id)
            if renamed:
                return renamed
        except Exception:
            pass

    return created


@router.get("/employees/{employee_id}")
def get_employee(
    employee_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Employee details with salary, leave, documents, and attendance."""
    employee = erpnext_adapter.get_resource("Employee", employee_id, tenant_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Fetch salary structure assignment (current salary)
    salary_structure = erpnext_adapter.list_resource(
        "Salary Structure Assignment",
        tenant_id,
        {
            "employee": employee_id,
            "docstatus": 1  # Approved salary structures only
        }
    )
    
    if salary_structure:
        latest_assignment = salary_structure[0]
        # Extract salary info
        employee["current_gross_salary"] = latest_assignment.get("salary_structure", {}).get("total_in_words", 0)
        employee["annual_ctc"] = latest_assignment.get("ctc", 0)
    else:
        employee["current_gross_salary"] = 0
        employee["annual_ctc"] = 0
    
    # Fetch salary structure details (components)
    if salary_structure:
        salary_details = erpnext_adapter.list_resource(
            "Salary Detail",
            tenant_id,
            {"parent": salary_structure[0].get("name")}
        )
        employee["salary_components"] = salary_details if salary_details else []
    else:
        employee["salary_components"] = []
    
    # Fetch salary slips
    salary_slips = erpnext_adapter.list_resource(
        "Salary Slip",
        tenant_id,
        {
            "employee": employee_id,
            "docstatus": 1  # Submitted slips only
        },
        {"field_name": "start_date", "order": "desc", "limit": 12}  # Last 12 months
    )
    employee["salary_slips"] = salary_slips if salary_slips else []
    
    # Calculate YTD earnings/deductions
    from datetime import datetime
    current_year = datetime.now().year
    ytd_slips = [s for s in (salary_slips or []) if datetime.strptime(s.get("start_date", ""), "%Y-%m-%d").year == current_year]
    employee["ytd_earnings"] = sum([float(s.get("gross_pay", 0)) for s in ytd_slips])
    employee["ytd_deductions"] = sum([float(s.get("total_deduction", 0)) for s in ytd_slips])
    
    # Fetch leave balances
    leave_balances = erpnext_adapter.list_resource(
        "Employee Leave Balance",
        tenant_id,
        {"employee": employee_id}
    )
    employee["leave_balances"] = leave_balances if leave_balances else []
    
    # Fetch recent attendance
    attendance = erpnext_adapter.list_resource(
        "Attendance",
        tenant_id,
        {"employee": employee_id},
        {"field_name": "attendance_date", "order": "desc", "limit": 20}
    )
    employee["attendance"] = attendance if attendance else []
    
    # Fetch documents
    documents = erpnext_adapter.list_resource(
        "Employee Document",
        tenant_id,
        {"employee": employee_id}
    )
    employee["documents"] = documents if documents else []
    
    return ResponseNormalizer.normalize_erpnext(employee)
@router.put("/employees/{employee_id}")
def update_employee(
    employee_id: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Employee details (contact, address, designation, etc)."""
    result = erpnext_adapter.update_resource("Employee", employee_id, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/employees/{employee_id}/leave-balance")
def get_employee_leave_balance(
    employee_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get employee leave balance summary."""
    
    leave_balances = erpnext_adapter.list_resource(
        "Employee Leave Balance",
        tenant_id,
        {"employee": employee_id}
    )
    
    total_available = sum([lb.get("closing_balance", 0) for lb in (leave_balances or [])])
    
    return {
        "employee": employee_id,
        "leave_types": leave_balances or [],
        "total_available": total_available
    }


@router.get("/employees/{employee_id}/salary-history")
def get_employee_salary_history(
    employee_id: str,
    limit: int = 12,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get recent salary slips for employee."""
    
    salary_slips = erpnext_adapter.list_resource(
        "Salary Slip",
        tenant_id,
        {
            "employee": employee_id,
            "docstatus": 1
        },
        {"field_name": "start_date", "order": "desc", "limit": limit}
    )
    
    return {
        "employee": employee_id,
        "salary_slips": salary_slips if salary_slips else []
    }


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete Employee (only if no salary slips exist)."""
    
    # Check if employee has any salary slips
    salary_slips = erpnext_adapter.list_resource(
        "Salary Slip",
        tenant_id,
        {"employee": employee_id}
    )
    
    if salary_slips:
        raise HTTPException(
            status_code=403,
            detail="Cannot delete employee with existing salary records"
        )
    
    erpnext_adapter.delete_resource("Employee", employee_id, tenant_id)
    return None


# ==================== Departments ====================

@router.get("/departments")
def list_departments(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List all departments."""
    result = erpnext_adapter.list_resource("Department", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/departments", status_code=status.HTTP_201_CREATED)
def create_department(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Department."""
    result = erpnext_adapter.create_resource("Department", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/departments/{department_name}")
def get_department(
    department_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Department details."""
    department = erpnext_adapter.get_resource("Department", department_name, tenant_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return ResponseNormalizer.normalize_erpnext(department)
@router.put("/departments/{department_name}")
def update_department(
    department_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Department."""
    result = erpnext_adapter.update_resource("Department", department_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/departments/{department_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Department."""
    erpnext_adapter.delete_resource("Department", department_name, tenant_id)
    return None


# ==================== Designations ====================

@router.get("/designations")
def list_designations(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List all designations."""
    result = erpnext_adapter.list_resource("Designation", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/designations", status_code=status.HTTP_201_CREATED)
def create_designation(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Designation."""
    result = erpnext_adapter.create_resource("Designation", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/designations/{designation_name}")
def get_designation(
    designation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Designation details."""
    designation = erpnext_adapter.get_resource("Designation", designation_name, tenant_id)
    if not designation:
        raise HTTPException(status_code=404, detail="Designation not found")
    return ResponseNormalizer.normalize_erpnext(designation)
@router.put("/designations/{designation_name}")
def update_designation(
    designation_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Designation."""
    result = erpnext_adapter.update_resource("Designation", designation_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/designations/{designation_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_designation(
    designation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Designation."""
    erpnext_adapter.delete_resource("Designation", designation_name, tenant_id)
    return None


# ==================== Holiday Lists (Master Data) ====================

@router.get("/holiday-lists")
def list_holiday_lists(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Holiday Lists."""
    result = erpnext_adapter.list_resource("Holiday List", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/holiday-lists", status_code=status.HTTP_201_CREATED)
def create_holiday_list(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Holiday List."""
    result = erpnext_adapter.create_resource("Holiday List", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/holiday-lists/{holiday_list_name}")
def get_holiday_list(
    holiday_list_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Holiday List details."""
    holiday_list = erpnext_adapter.get_resource("Holiday List", holiday_list_name, tenant_id)
    if not holiday_list:
        raise HTTPException(status_code=404, detail="Holiday List not found")
    return holiday_list


@router.put("/holiday-lists/{holiday_list_name}")
def update_holiday_list(
    holiday_list_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Holiday List."""
    result = erpnext_adapter.update_resource("Holiday List", holiday_list_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/holiday-lists/{holiday_list_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday_list(
    holiday_list_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Holiday List."""
    erpnext_adapter.delete_resource("Holiday List", holiday_list_name, tenant_id)
    return None


# ==================== Shift Types (Master Data) ====================

@router.get("/shift-types")
def list_shift_types(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Shift Types."""
    try:
        result = erpnext_adapter.list_resource("Shift Type", tenant_id)

        return ResponseNormalizer.normalize_erpnext(result)
    except HTTPException as e:
        # ERPNext v15 often requires the separate HRMS app for Shift Type.
        if e.status_code == 404 and isinstance(e.detail, dict) and e.detail.get("type") == "not_found":
            return []
        raise


@router.post("/shift-types", status_code=status.HTTP_201_CREATED)
def create_shift_type(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Shift Type."""
    try:
        result = erpnext_adapter.create_resource("Shift Type", data, tenant_id)

        return ResponseNormalizer.normalize_erpnext(result)
    except HTTPException as e:
        if e.status_code == 404 and isinstance(e.detail, dict) and e.detail.get("type") == "not_found":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Shift Types are unavailable: ERPNext site is missing the 'Shift Type' DocType (install HRMS app).",
            )
        raise


@router.get("/shift-types/{shift_type_name}")
def get_shift_type(
    shift_type_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Shift Type details."""
    try:
        st = erpnext_adapter.get_resource("Shift Type", shift_type_name, tenant_id)
    except HTTPException as e:
        if e.status_code == 404 and isinstance(e.detail, dict) and e.detail.get("type") == "not_found":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Shift Types are unavailable: ERPNext site is missing the 'Shift Type' DocType (install HRMS app).",
            )
        raise
    if not st:
        raise HTTPException(status_code=404, detail="Shift Type not found")
    return st


@router.put("/shift-types/{shift_type_name}")
def update_shift_type(
    shift_type_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Shift Type."""
    try:
        result = erpnext_adapter.update_resource("Shift Type", shift_type_name, data, tenant_id)

        return ResponseNormalizer.normalize_erpnext(result)
    except HTTPException as e:
        if e.status_code == 404 and isinstance(e.detail, dict) and e.detail.get("type") == "not_found":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Shift Types are unavailable: ERPNext site is missing the 'Shift Type' DocType (install HRMS app).",
            )
        raise


@router.delete("/shift-types/{shift_type_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift_type(
    shift_type_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Shift Type."""
    try:
        erpnext_adapter.delete_resource("Shift Type", shift_type_name, tenant_id)
        return None
    except HTTPException as e:
        if e.status_code == 404 and isinstance(e.detail, dict) and e.detail.get("type") == "not_found":
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Shift Types are unavailable: ERPNext site is missing the 'Shift Type' DocType (install HRMS app).",
            )
        raise


# ==================== Attendance ====================

@router.get("/attendance")
def list_attendance(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Attendance records."""
    result = erpnext_adapter.list_resource("Attendance", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/attendance", status_code=status.HTTP_201_CREATED)
def create_attendance(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Attendance record.
    
    Required fields:
    - employee: Employee ID
    - attendance_date: date
    - status: "Present" | "Absent" | "Half Day"
    """
    result = erpnext_adapter.create_resource("Attendance", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Leave ====================

@router.get("/leaves")
def list_leaves(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Leave applications."""
    result = erpnext_adapter.list_resource("Leave Application", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/leaves", status_code=status.HTTP_201_CREATED)
def create_leave(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Leave Application.
    
    Required fields:
    - employee: Employee ID
    - leave_type: str
    - from_date: date
    - to_date: date
    - status: "Draft" | "Submitted"
    """
    result = erpnext_adapter.create_resource("Leave Application", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Salary Structure ====================

@router.get("/salary-structures")
def list_salary_structures(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Salary Structures."""
    result = erpnext_adapter.list_resource("Salary Structure", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/salary-structures", status_code=status.HTTP_201_CREATED)
def create_salary_structure(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Salary Structure."""
    result = erpnext_adapter.create_resource("Salary Structure", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)
