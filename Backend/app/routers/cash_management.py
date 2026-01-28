"""
Cash Management Router

API endpoints for POS cash management including sessions, transactions,
and discrepancy handling.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from ..dependencies.auth import get_current_user, require_tenant_access
from ..database import get_db
from ..services.cash_management_service import CashManagementService
from ..models.cash_management import (
    CashSession, CashTransaction, CashDiscrepancy,
    CashSettings, CashDenomination
)

router = APIRouter(prefix="/cash", tags=["Cash Management"])


# ==================== Request/Response Models ====================

class OpenSessionRequest(BaseModel):
    opening_balance: float = Field(..., ge=0)
    pos_profile_id: Optional[str] = None
    pos_terminal_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    opening_notes: Optional[str] = None
    denominations: Optional[Dict[str, int]] = None  # e.g., {"1000": 5, "500": 10}


class CloseSessionRequest(BaseModel):
    closing_balance: float = Field(..., ge=0)
    closing_notes: Optional[str] = None
    denominations: Optional[Dict[str, int]] = None


class VerifyCloseRequest(BaseModel):
    approved: bool
    notes: Optional[str] = None


class RecordTransactionRequest(BaseModel):
    transaction_type: str = Field(..., pattern="^(sale_cash|sale_card|sale_mpesa|sale_credit|refund_cash|refund_card|payin|payout|float_add|float_remove|adjustment)$")
    amount: float = Field(..., gt=0)
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None


class AcknowledgeDiscrepancyRequest(BaseModel):
    explanation: Optional[str] = None


class ResolveDiscrepancyRequest(BaseModel):
    resolution_type: str = Field(..., pattern="^(repayment|payroll_deduction|waived|error_found|fraud_confirmed)$")
    resolution_notes: Optional[str] = None
    deduction_amount: Optional[float] = None
    deduction_date: Optional[datetime] = None
    disciplinary_action: Optional[str] = None


class CashSettingsUpdate(BaseModel):
    require_opening_verification: Optional[bool] = None
    require_closing_verification: Optional[bool] = None
    require_denomination_count: Optional[bool] = None
    default_float_amount: Optional[float] = None
    minimum_float_amount: Optional[float] = None
    maximum_float_amount: Optional[float] = None
    auto_flag_discrepancy_above: Optional[float] = None
    require_explanation_above: Optional[float] = None
    tolerance_amount: Optional[float] = None
    enable_auto_payroll_deduction: Optional[bool] = None
    max_auto_deduction_amount: Optional[float] = None
    deduction_requires_acknowledgment: Optional[bool] = None
    notify_manager_on_discrepancy: Optional[bool] = None
    manager_notification_threshold: Optional[float] = None
    allow_multiple_open_sessions: Optional[bool] = None
    auto_close_after_hours: Optional[int] = None


# ==================== Session Endpoints ====================

@router.post("/sessions/open")
async def open_cash_session(
    data: OpenSessionRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Open a new cash session for the current user.
    
    - Records opening balance
    - Optionally records denomination breakdown
    - Associates with POS profile/terminal
    """
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        session = service.open_session(
            cashier_id=user_id,
            opening_balance=Decimal(str(data.opening_balance)),
            pos_profile_id=data.pos_profile_id,
            pos_terminal_id=data.pos_terminal_id,
            warehouse_id=data.warehouse_id,
            opening_notes=data.opening_notes,
            denominations=data.denominations,
        )
        
        return {
            "message": "Cash session opened",
            "session_id": str(session.id),
            "session_number": session.session_number,
            "opening_balance": float(session.opening_balance),
            "opened_at": session.opened_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/close")
async def close_cash_session(
    session_id: str,
    data: CloseSessionRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Close a cash session and calculate discrepancy.
    
    - Records physical cash count
    - Compares with expected cash
    - Creates discrepancy record if needed
    """
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        result = service.close_session(
            session_id=session_id,
            closing_balance=Decimal(str(data.closing_balance)),
            closing_notes=data.closing_notes,
            denominations=data.denominations,
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sessions/{session_id}/verify")
async def verify_session_close(
    session_id: str,
    data: VerifyCloseRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify and approve a session closure (manager action).
    """
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        session = service.verify_session_close(
            session_id=session_id,
            verifier_id=user_id,
            approved=data.approved,
            notes=data.notes,
        )
        
        return {
            "message": "Session verification completed",
            "session_id": str(session.id),
            "status": session.status,
            "approved": data.approved,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/current")
async def get_current_session(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's open cash session"""
    user_id = current_user.get("user_id")
    
    session = db.query(CashSession).filter(
        CashSession.tenant_id == tenant_id,
        CashSession.cashier_id == user_id,
        CashSession.status == "open"
    ).first()
    
    if not session:
        return {"session": None, "has_open_session": False}
    
    service = CashManagementService(db, tenant_id, user_id)
    summary = service.get_session_summary(str(session.id))
    
    return {
        "has_open_session": True,
        "session": summary
    }


@router.get("/sessions/{session_id}")
async def get_session_details(
    session_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed summary of a cash session"""
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        summary = service.get_session_summary(session_id)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/sessions")
async def list_sessions(
    status: Optional[str] = None,
    cashier_id: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List cash sessions with optional filters"""
    query = db.query(CashSession).filter(CashSession.tenant_id == tenant_id)
    
    if status:
        query = query.filter(CashSession.status == status)
    if cashier_id:
        query = query.filter(CashSession.cashier_id == cashier_id)
    if from_date:
        query = query.filter(CashSession.opened_at >= from_date)
    if to_date:
        query = query.filter(CashSession.opened_at <= to_date)
    
    total = query.count()
    sessions = query.order_by(CashSession.opened_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "sessions": [
            {
                "id": str(s.id),
                "session_number": s.session_number,
                "status": s.status,
                "cashier_id": str(s.cashier_id) if s.cashier_id else None,
                "cashier_name": s.cashier_name,
                "opening_balance": float(s.opening_balance or 0),
                "closing_balance": float(s.closing_balance) if s.closing_balance else None,
                "has_discrepancy": s.has_discrepancy,
                "discrepancy_amount": float(s.discrepancy_amount or 0),
                "opened_at": s.opened_at.isoformat() if s.opened_at else None,
                "closed_at": s.closed_at.isoformat() if s.closed_at else None,
                "invoice_count": s.invoice_count or 0,
            }
            for s in sessions
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ==================== Transaction Endpoints ====================

@router.post("/sessions/{session_id}/transactions")
async def record_transaction(
    session_id: str,
    data: RecordTransactionRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a cash transaction in the session.
    
    Transaction types:
    - sale_cash, sale_card, sale_mpesa, sale_credit: Sales
    - refund_cash, refund_card: Refunds
    - payin, float_add: Cash added to drawer
    - payout, float_remove: Cash removed from drawer
    - adjustment: Manual adjustments
    """
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    # Determine direction based on transaction type
    direction = "in"
    if data.transaction_type in ["refund_cash", "payout", "float_remove"]:
        direction = "out"
    
    try:
        transaction = service.record_transaction(
            session_id=session_id,
            transaction_type=data.transaction_type,
            amount=Decimal(str(data.amount)),
            direction=direction,
            reference_type=data.reference_type,
            reference_id=data.reference_id,
            customer_id=data.customer_id,
            customer_name=data.customer_name,
            notes=data.notes,
        )
        
        return {
            "message": "Transaction recorded",
            "transaction_id": str(transaction.id),
            "transaction_number": transaction.transaction_number,
            "running_balance": float(transaction.running_balance) if transaction.running_balance else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sessions/{session_id}/transactions")
async def list_session_transactions(
    session_id: str,
    transaction_type: Optional[str] = None,
    limit: int = Query(100, le=500),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List transactions for a session"""
    query = db.query(CashTransaction).filter(
        CashTransaction.session_id == session_id,
        CashTransaction.tenant_id == tenant_id
    )
    
    if transaction_type:
        query = query.filter(CashTransaction.transaction_type == transaction_type)
    
    transactions = query.order_by(CashTransaction.created_at.desc()).limit(limit).all()
    
    return {
        "transactions": [
            {
                "id": str(t.id),
                "transaction_number": t.transaction_number,
                "transaction_type": t.transaction_type,
                "amount": float(t.amount),
                "direction": t.direction,
                "running_balance": float(t.running_balance) if t.running_balance else None,
                "reference_type": t.reference_type,
                "reference_id": t.reference_id,
                "customer_name": t.customer_name,
                "notes": t.notes,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ],
        "total": len(transactions),
    }


# ==================== Discrepancy Endpoints ====================

@router.get("/discrepancies")
async def list_discrepancies(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List cash discrepancies with optional filters"""
    query = db.query(CashDiscrepancy).filter(CashDiscrepancy.tenant_id == tenant_id)
    
    if status:
        query = query.filter(CashDiscrepancy.status == status)
    if employee_id:
        query = query.filter(CashDiscrepancy.employee_id == employee_id)
    if from_date:
        query = query.filter(CashDiscrepancy.created_at >= from_date)
    if to_date:
        query = query.filter(CashDiscrepancy.created_at <= to_date)
    
    total = query.count()
    discrepancies = query.order_by(CashDiscrepancy.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "discrepancies": [
            {
                "id": str(d.id),
                "discrepancy_number": d.discrepancy_number,
                "discrepancy_type": d.discrepancy_type,
                "amount": float(d.amount),
                "expected_amount": float(d.expected_amount),
                "actual_amount": float(d.actual_amount),
                "employee_id": str(d.employee_id) if d.employee_id else None,
                "employee_name": d.employee_name,
                "status": d.status,
                "resolution_type": d.resolution_type,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            }
            for d in discrepancies
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/discrepancies/{discrepancy_id}")
async def get_discrepancy(
    discrepancy_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get discrepancy details"""
    discrepancy = db.query(CashDiscrepancy).filter(
        CashDiscrepancy.id == discrepancy_id,
        CashDiscrepancy.tenant_id == tenant_id
    ).first()
    
    if not discrepancy:
        raise HTTPException(status_code=404, detail="Discrepancy not found")
    
    return {
        "id": str(discrepancy.id),
        "discrepancy_number": discrepancy.discrepancy_number,
        "discrepancy_type": discrepancy.discrepancy_type,
        "amount": float(discrepancy.amount),
        "expected_amount": float(discrepancy.expected_amount),
        "actual_amount": float(discrepancy.actual_amount),
        "employee_id": str(discrepancy.employee_id) if discrepancy.employee_id else None,
        "employee_name": discrepancy.employee_name,
        "status": discrepancy.status,
        "employee_explanation": discrepancy.employee_explanation,
        "investigation_notes": discrepancy.investigation_notes,
        "resolution_type": discrepancy.resolution_type,
        "resolution_notes": discrepancy.resolution_notes,
        "disciplinary_action": discrepancy.disciplinary_action,
        "deduction_amount": float(discrepancy.deduction_amount) if discrepancy.deduction_amount else None,
        "deduction_scheduled_date": discrepancy.deduction_scheduled_date.isoformat() if discrepancy.deduction_scheduled_date else None,
        "deduction_completed": discrepancy.deduction_completed,
        "created_at": discrepancy.created_at.isoformat() if discrepancy.created_at else None,
        "acknowledged_at": discrepancy.acknowledged_at.isoformat() if discrepancy.acknowledged_at else None,
        "resolved_at": discrepancy.resolved_at.isoformat() if discrepancy.resolved_at else None,
        "session_id": str(discrepancy.session_id) if discrepancy.session_id else None,
    }


@router.post("/discrepancies/{discrepancy_id}/acknowledge")
async def acknowledge_discrepancy(
    discrepancy_id: str,
    data: AcknowledgeDiscrepancyRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Employee acknowledges the discrepancy"""
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        discrepancy = service.acknowledge_discrepancy(
            discrepancy_id=discrepancy_id,
            employee_explanation=data.explanation,
        )
        
        return {
            "message": "Discrepancy acknowledged",
            "discrepancy_id": str(discrepancy.id),
            "status": discrepancy.status,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/discrepancies/{discrepancy_id}/resolve")
async def resolve_discrepancy(
    discrepancy_id: str,
    data: ResolveDiscrepancyRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolve a discrepancy (manager action)"""
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    try:
        discrepancy = service.resolve_discrepancy(
            discrepancy_id=discrepancy_id,
            resolution_type=data.resolution_type,
            resolution_notes=data.resolution_notes,
            deduction_amount=Decimal(str(data.deduction_amount)) if data.deduction_amount else None,
            deduction_date=data.deduction_date,
            disciplinary_action=data.disciplinary_action,
        )
        
        return {
            "message": "Discrepancy resolved",
            "discrepancy_id": str(discrepancy.id),
            "status": discrepancy.status,
            "resolution_type": discrepancy.resolution_type,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/employees/{employee_id}/discrepancy-history")
async def get_employee_discrepancy_history(
    employee_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get discrepancy history for an employee"""
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    
    history = service.get_employee_discrepancy_history(
        employee_id=employee_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    
    return history


# ==================== Settings Endpoints ====================

@router.get("/settings")
async def get_cash_settings(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cash management settings"""
    user_id = current_user.get("user_id")
    service = CashManagementService(db, tenant_id, user_id)
    settings = service.settings
    
    return {
        "require_opening_verification": settings.require_opening_verification,
        "require_closing_verification": settings.require_closing_verification,
        "require_denomination_count": settings.require_denomination_count,
        "default_float_amount": float(settings.default_float_amount) if settings.default_float_amount else 5000,
        "minimum_float_amount": float(settings.minimum_float_amount) if settings.minimum_float_amount else 1000,
        "maximum_float_amount": float(settings.maximum_float_amount) if settings.maximum_float_amount else 50000,
        "auto_flag_discrepancy_above": float(settings.auto_flag_discrepancy_above) if settings.auto_flag_discrepancy_above else 100,
        "require_explanation_above": float(settings.require_explanation_above) if settings.require_explanation_above else 50,
        "tolerance_amount": float(settings.tolerance_amount) if settings.tolerance_amount else 10,
        "enable_auto_payroll_deduction": settings.enable_auto_payroll_deduction,
        "max_auto_deduction_amount": float(settings.max_auto_deduction_amount) if settings.max_auto_deduction_amount else 1000,
        "deduction_requires_acknowledgment": settings.deduction_requires_acknowledgment,
        "notify_manager_on_discrepancy": settings.notify_manager_on_discrepancy,
        "manager_notification_threshold": float(settings.manager_notification_threshold) if settings.manager_notification_threshold else 500,
        "allow_multiple_open_sessions": settings.allow_multiple_open_sessions,
        "auto_close_after_hours": settings.auto_close_after_hours,
        "default_currency": settings.default_currency,
    }


@router.put("/settings")
async def update_cash_settings(
    data: CashSettingsUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update cash management settings"""
    settings = db.query(CashSettings).filter(
        CashSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        settings = CashSettings(tenant_id=tenant_id)
        db.add(settings)
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None and field in [
            "default_float_amount", "minimum_float_amount", "maximum_float_amount",
            "auto_flag_discrepancy_above", "require_explanation_above", "tolerance_amount",
            "max_auto_deduction_amount", "manager_notification_threshold"
        ]:
            value = Decimal(str(value))
        setattr(settings, field, value)
    
    settings.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Cash settings updated"}
