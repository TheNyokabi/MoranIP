from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.iam import User, Tenant
from app.models.rbac import Role
from app.models.pos_warehouse_access import WarehouseAccessRole, WarehouseAccessUser

router = APIRouter(prefix="/pos/warehouse-access", tags=["POS Warehouse Access"])


class WarehouseAccessRoleCreate(BaseModel):
    role_id: Optional[str] = None
    role_code: Optional[str] = None
    warehouses: List[str] = Field(default_factory=list)
    replace: bool = False


class WarehouseAccessUserCreate(BaseModel):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    warehouses: List[str] = Field(default_factory=list)
    replace: bool = False


def _ensure_admin(current_user: dict) -> None:
    roles = current_user.get("roles", [])
    if current_user.get("is_super_admin"):
        return
    if not any(role in roles for role in ["ADMIN", "OWNER", "SYSTEM"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required to manage warehouse access"
        )


def _resolve_role(db: Session, role_id: Optional[str], role_code: Optional[str]) -> Role:
    if role_id:
        try:
            role_uuid = uuid.UUID(role_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role_id")
        role = db.query(Role).filter(Role.id == role_uuid).first()
    elif role_code:
        role = db.query(Role).filter(Role.code == role_code).first()
    else:
        raise HTTPException(status_code=400, detail="role_id or role_code is required")

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


def _resolve_tenant_id(db: Session, tenant_id: str) -> str:
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return str(tenant.id)
    except ValueError:
        tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return str(tenant.id)


def _resolve_user(db: Session, user_id: Optional[str], user_email: Optional[str]) -> User:
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id")
        user = db.query(User).filter(User.id == user_uuid).first()
    elif user_email:
        user = db.query(User).filter(User.email == user_email).first()
    else:
        raise HTTPException(status_code=400, detail="user_id or user_email is required")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/roles")
def list_role_access(
    tenant_id: str,
    role_id: Optional[str] = None,
    role_code: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    role = _resolve_role(db, role_id, role_code) if (role_id or role_code) else None

    query = db.query(WarehouseAccessRole).filter(WarehouseAccessRole.tenant_id == tenant_id)
    if role:
        query = query.filter(WarehouseAccessRole.role_id == role.id)

    entries = query.order_by(WarehouseAccessRole.warehouse_name.asc()).all()
    return {
        "tenant_id": tenant_id,
        "role": {
            "id": str(role.id),
            "code": role.code,
            "name": role.name
        } if role else None,
        "warehouses": [entry.warehouse_name for entry in entries]
    }


@router.post("/roles")
def add_role_access(
    payload: WarehouseAccessRoleCreate,
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    role = _resolve_role(db, payload.role_id, payload.role_code)

    if payload.replace:
        db.query(WarehouseAccessRole).filter(
            WarehouseAccessRole.tenant_id == tenant_id,
            WarehouseAccessRole.role_id == role.id
        ).delete()

    created = []
    for warehouse_name in payload.warehouses:
        existing = db.query(WarehouseAccessRole).filter(
            WarehouseAccessRole.tenant_id == tenant_id,
            WarehouseAccessRole.role_id == role.id,
            WarehouseAccessRole.warehouse_name == warehouse_name
        ).first()
        if existing:
            continue
        entry = WarehouseAccessRole(
            tenant_id=tenant_id,
            role_id=role.id,
            warehouse_name=warehouse_name
        )
        db.add(entry)
        created.append(entry)

    db.commit()
    return {
        "tenant_id": tenant_id,
        "role": {
            "id": str(role.id),
            "code": role.code,
            "name": role.name
        },
        "warehouses": [entry.warehouse_name for entry in created]
    }


@router.delete("/roles")
def remove_role_access(
    tenant_id: str,
    warehouse_name: str,
    role_id: Optional[str] = None,
    role_code: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    role = _resolve_role(db, role_id, role_code)

    deleted = db.query(WarehouseAccessRole).filter(
        WarehouseAccessRole.tenant_id == tenant_id,
        WarehouseAccessRole.role_id == role.id,
        WarehouseAccessRole.warehouse_name == warehouse_name
    ).delete()
    db.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Warehouse access entry not found")

    return {"tenant_id": tenant_id, "warehouse_name": warehouse_name, "removed": True}


@router.get("/users")
def list_user_access(
    tenant_id: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    user = _resolve_user(db, user_id, user_email) if (user_id or user_email) else None

    query = db.query(WarehouseAccessUser).filter(WarehouseAccessUser.tenant_id == tenant_id)
    if user:
        query = query.filter(WarehouseAccessUser.user_id == user.id)

    entries = query.order_by(WarehouseAccessUser.warehouse_name.asc()).all()
    return {
        "tenant_id": tenant_id,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "user_code": user.user_code
        } if user else None,
        "warehouses": [entry.warehouse_name for entry in entries]
    }


@router.post("/users")
def add_user_access(
    payload: WarehouseAccessUserCreate,
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    user = _resolve_user(db, payload.user_id, payload.user_email)

    if payload.replace:
        db.query(WarehouseAccessUser).filter(
            WarehouseAccessUser.tenant_id == tenant_id,
            WarehouseAccessUser.user_id == user.id
        ).delete()

    created = []
    for warehouse_name in payload.warehouses:
        existing = db.query(WarehouseAccessUser).filter(
            WarehouseAccessUser.tenant_id == tenant_id,
            WarehouseAccessUser.user_id == user.id,
            WarehouseAccessUser.warehouse_name == warehouse_name
        ).first()
        if existing:
            continue
        entry = WarehouseAccessUser(
            tenant_id=tenant_id,
            user_id=user.id,
            warehouse_name=warehouse_name
        )
        db.add(entry)
        created.append(entry)

    db.commit()
    return {
        "tenant_id": tenant_id,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "user_code": user.user_code
        },
        "warehouses": [entry.warehouse_name for entry in created]
    }


@router.delete("/users")
def remove_user_access(
    tenant_id: str,
    warehouse_name: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _ensure_admin(current_user)
    tenant_id = _resolve_tenant_id(db, tenant_id)
    user = _resolve_user(db, user_id, user_email)

    deleted = db.query(WarehouseAccessUser).filter(
        WarehouseAccessUser.tenant_id == tenant_id,
        WarehouseAccessUser.user_id == user.id,
        WarehouseAccessUser.warehouse_name == warehouse_name
    ).delete()
    db.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Warehouse access entry not found")

    return {"tenant_id": tenant_id, "warehouse_name": warehouse_name, "removed": True}
