from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from app.database import get_db
from app.dependencies.permissions import require_permission
from app.models.rbac import RoleAuditLog, Role, Permission
from app.models.iam import User

router = APIRouter(
    prefix="/audit",
    tags=["Audit"],
)


# ==================== Response Models ====================

class AuditLogResponse(BaseModel):
    id: str
    user: Optional[dict]
    tenant_id: Optional[str]
    action: str
    target_user: Optional[dict]
    role: Optional[dict]
    permission: Optional[dict]
    metadata: Optional[dict]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Endpoints ====================

@router.get("/roles", response_model=List[AuditLogResponse])
async def get_role_audit_log(
    user_id: Optional[str] = Query(None, description="Filter by user who performed action"),
    target_user_id: Optional[str] = Query(None, description="Filter by user affected by action"),
    role_id: Optional[str] = Query(None, description="Filter by role"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:audit:view"))
):
    """
    Get role assignment/revocation audit history.
    
    Supports filtering by user, target user, role, action, and date range.
    """
    query = db.query(RoleAuditLog)
    
    # Apply filters
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            query = query.filter(RoleAuditLog.user_id == user_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
    
    if target_user_id:
        try:
            target_uuid = uuid.UUID(target_user_id)
            query = query.filter(RoleAuditLog.target_user_id == target_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target user ID format"
            )
    
    if role_id:
        try:
            role_uuid = uuid.UUID(role_id)
            query = query.filter(RoleAuditLog.role_id == role_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role ID format"
            )
    
    if action:
        query = query.filter(RoleAuditLog.action == action.upper())
    
    if start_date:
        query = query.filter(RoleAuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(RoleAuditLog.created_at <= end_date)
    
    # Order by most recent first
    query = query.order_by(RoleAuditLog.created_at.desc())
    
    # Apply pagination
    logs = query.offset(offset).limit(limit).all()
    
    # Build response
    result = []
    for log in logs:
        # Get user info
        user_info = None
        if log.user:
            user_info = {
                "id": str(log.user.id),
                "email": log.user.email,
                "full_name": log.user.full_name,
                "user_code": log.user.user_code
            }
        
        # Get target user info
        target_user_info = None
        if log.target_user:
            target_user_info = {
                "id": str(log.target_user.id),
                "email": log.target_user.email,
                "full_name": log.target_user.full_name,
                "user_code": log.target_user.user_code
            }
        
        # Get role info
        role_info = None
        if log.role:
            role_info = {
                "id": str(log.role.id),
                "code": log.role.code,
                "name": log.role.name,
                "role_code": log.role.role_code
            }
        
        # Get permission info
        permission_info = None
        if log.permission:
            permission_info = {
                "id": str(log.permission.id),
                "code": log.permission.code,
                "permission_code": log.permission.permission_code,
                "module": log.permission.module
            }
        
        result.append(AuditLogResponse(
            id=str(log.id),
            user=user_info,
            tenant_id=str(log.tenant_id) if log.tenant_id else None,
            action=log.action,
            target_user=target_user_info,
            role=role_info,
            permission=permission_info,
            metadata=log.metadata,
            ip_address=log.ip_address,
            created_at=log.created_at
        ))
    
    return result


@router.get("/permissions", response_model=List[AuditLogResponse])
async def get_permission_audit_log(
    user_id: Optional[str] = Query(None, description="Filter by user who performed action"),
    target_user_id: Optional[str] = Query(None, description="Filter by user affected by action"),
    permission_id: Optional[str] = Query(None, description="Filter by permission"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:audit:view"))
):
    """
    Get permission override audit history.
    
    Supports filtering by user, target user, permission, action, and date range.
    """
    query = db.query(RoleAuditLog).filter(
        RoleAuditLog.permission_id.isnot(None)
    )
    
    # Apply filters
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            query = query.filter(RoleAuditLog.user_id == user_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
    
    if target_user_id:
        try:
            target_uuid = uuid.UUID(target_user_id)
            query = query.filter(RoleAuditLog.target_user_id == target_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target user ID format"
            )
    
    if permission_id:
        try:
            perm_uuid = uuid.UUID(permission_id)
            query = query.filter(RoleAuditLog.permission_id == perm_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid permission ID format"
            )
    
    if action:
        query = query.filter(RoleAuditLog.action == action.upper())
    
    if start_date:
        query = query.filter(RoleAuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(RoleAuditLog.created_at <= end_date)
    
    # Order by most recent first
    query = query.order_by(RoleAuditLog.created_at.desc())
    
    # Apply pagination
    logs = query.offset(offset).limit(limit).all()
    
    # Build response (same as role audit log)
    result = []
    for log in logs:
        user_info = None
        if log.user:
            user_info = {
                "id": str(log.user.id),
                "email": log.user.email,
                "full_name": log.user.full_name,
                "user_code": log.user.user_code
            }
        
        target_user_info = None
        if log.target_user:
            target_user_info = {
                "id": str(log.target_user.id),
                "email": log.target_user.email,
                "full_name": log.target_user.full_name,
                "user_code": log.target_user.user_code
            }
        
        role_info = None
        if log.role:
            role_info = {
                "id": str(log.role.id),
                "code": log.role.code,
                "name": log.role.name,
                "role_code": log.role.role_code
            }
        
        permission_info = None
        if log.permission:
            permission_info = {
                "id": str(log.permission.id),
                "code": log.permission.code,
                "permission_code": log.permission.permission_code,
                "module": log.permission.module
            }
        
        result.append(AuditLogResponse(
            id=str(log.id),
            user=user_info,
            tenant_id=str(log.tenant_id) if log.tenant_id else None,
            action=log.action,
            target_user=target_user_info,
            role=role_info,
            permission=permission_info,
            metadata=log.metadata,
            ip_address=log.ip_address,
            created_at=log.created_at
        ))
    
    return result


@router.get("/actions", response_model=List[str])
async def list_audit_actions(
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:audit:view"))
):
    """
    Get all unique audit action types.
    """
    from sqlalchemy import distinct
    
    actions = db.query(distinct(RoleAuditLog.action)).all()
    
    return sorted([action[0] for action in actions if action[0]])


@router.get("/stats", response_model=dict)
async def get_audit_stats(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:audit:view"))
):
    """
    Get audit statistics.
    
    Returns counts by action type and other useful metrics.
    """
    from sqlalchemy import func
    
    query = db.query(RoleAuditLog)
    
    if start_date:
        query = query.filter(RoleAuditLog.created_at >= start_date)
    
    if end_date:
        query = query.filter(RoleAuditLog.created_at <= end_date)
    
    # Total count
    total_count = query.count()
    
    # Count by action
    action_counts = db.query(
        RoleAuditLog.action,
        func.count(RoleAuditLog.id).label('count')
    )
    
    if start_date:
        action_counts = action_counts.filter(RoleAuditLog.created_at >= start_date)
    if end_date:
        action_counts = action_counts.filter(RoleAuditLog.created_at <= end_date)
    
    action_counts = action_counts.group_by(RoleAuditLog.action).all()
    
    action_distribution = {
        action: count for action, count in action_counts
    }
    
    # Most active users
    active_users = db.query(
        RoleAuditLog.user_id,
        func.count(RoleAuditLog.id).label('count')
    ).filter(
        RoleAuditLog.user_id.isnot(None)
    )
    
    if start_date:
        active_users = active_users.filter(RoleAuditLog.created_at >= start_date)
    if end_date:
        active_users = active_users.filter(RoleAuditLog.created_at <= end_date)
    
    active_users = active_users.group_by(RoleAuditLog.user_id).order_by(
        func.count(RoleAuditLog.id).desc()
    ).limit(10).all()
    
    top_users = [
        {"user_id": str(user_id), "action_count": count}
        for user_id, count in active_users
    ]
    
    return {
        "total_count": total_count,
        "action_distribution": action_distribution,
        "top_users": top_users,
        "date_range": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }
