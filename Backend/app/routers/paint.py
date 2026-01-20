"""
Paint Management Router
Handles custom paint sales with color codes and tint formulas
"""
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_token_payload
from app.models.iam import Tenant
from app.models.paint import (
    ColorCode, TintFormula, TintFormulaComponent, PaintSaleTransaction,
    ColorCodeCreate, ColorCodeUpdate, TintFormulaCreate, TintFormulaUpdate,
    PaintSaleRequest, PaintFormulaCalculation
)
from app.services.erpnext_client import erpnext_adapter
from app.services.paint_service import PaintService
from app.middleware.response_normalizer import ResponseNormalizer

router = APIRouter(
    prefix="/paint",
    tags=["Paint Management"]
)


# ==================== Color Code Management ====================

@router.get("/color-codes", response_model=Dict[str, Any])
async def list_color_codes(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    color_system: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List color codes with optional filtering."""
    query = db.query(ColorCode).filter(ColorCode.tenant_id == tenant_id)

    if status:
        query = query.filter(ColorCode.status == status)
    if color_system:
        query = query.filter(ColorCode.color_system == color_system)

    total = query.count()
    color_codes = query.offset(offset).limit(limit).all()

    return {
        "data": [{
            "id": cc.id,
            "name": cc.name,
            "color_system": cc.color_system,
            "hex_code": cc.hex_code,
            "rgb_values": cc.rgb_values,
            "status": cc.status,
            "created_at": cc.created_at.isoformat() if cc.created_at else None,
            "updated_at": cc.updated_at.isoformat() if cc.updated_at else None
        } for cc in color_codes],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/color-codes", status_code=status.HTTP_201_CREATED)
async def create_color_code(
    data: ColorCodeCreate,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Create a new color code."""
    # Check if color code already exists
    existing = db.query(ColorCode).filter(
        ColorCode.id == data.id,
        ColorCode.tenant_id == tenant_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Color code {data.id} already exists"
        )

    color_code = ColorCode(
        id=data.id,
        name=data.name,
        color_system=data.color_system,
        hex_code=data.hex_code,
        rgb_values=data.rgb_values,
        tenant_id=tenant_id
    )

    db.add(color_code)
    db.commit()
    db.refresh(color_code)

    return {
        "id": color_code.id,
        "name": color_code.name,
        "color_system": color_code.color_system,
        "hex_code": color_code.hex_code,
        "rgb_values": color_code.rgb_values,
        "status": color_code.status,
        "created_at": color_code.created_at.isoformat()
    }


@router.get("/color-codes/{color_code_id}")
async def get_color_code(
    color_code_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get a specific color code with its formulas."""
    color_code = db.query(ColorCode).filter(
        ColorCode.id == color_code_id,
        ColorCode.tenant_id == tenant_id
    ).first()

    if not color_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Color code {color_code_id} not found"
        )

    # Get active formulas for this color code
    formulas = db.query(TintFormula).filter(
        TintFormula.color_code_id == color_code_id,
        TintFormula.tenant_id == tenant_id,
        TintFormula.is_active == True
    ).all()

    return {
        "id": color_code.id,
        "name": color_code.name,
        "color_system": color_code.color_system,
        "hex_code": color_code.hex_code,
        "rgb_values": color_code.rgb_values,
        "status": color_code.status,
        "formulas": [{
            "id": f.id,
            "name": f.name,
            "base_paint_item": f.base_paint_item,
            "output_volume_ml": f.output_volume_ml,
            "version": f.version,
            "created_at": f.created_at.isoformat()
        } for f in formulas],
        "created_at": color_code.created_at.isoformat(),
        "updated_at": color_code.updated_at.isoformat()
    }


@router.put("/color-codes/{color_code_id}")
async def update_color_code(
    color_code_id: str,
    data: ColorCodeUpdate,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Update a color code."""
    color_code = db.query(ColorCode).filter(
        ColorCode.id == color_code_id,
        ColorCode.tenant_id == tenant_id
    ).first()

    if not color_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Color code {color_code_id} not found"
        )

    # Update fields
    for field, value in data.dict(exclude_unset=True).items():
        setattr(color_code, field, value)

    color_code.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(color_code)

    return {"message": f"Color code {color_code_id} updated successfully"}


# ==================== Tint Formula Management ====================

@router.get("/formulas", response_model=Dict[str, Any])
async def list_formulas(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    color_code_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
):
    """List tint formulas with optional filtering."""
    query = db.query(TintFormula).filter(TintFormula.tenant_id == tenant_id)

    if color_code_id:
        query = query.filter(TintFormula.color_code_id == color_code_id)
    if is_active is not None:
        query = query.filter(TintFormula.is_active == is_active)

    total = query.count()
    formulas = query.offset(offset).limit(limit).all()

    return {
        "data": [{
            "id": f.id,
            "color_code_id": f.color_code_id,
            "name": f.name,
            "base_paint_item": f.base_paint_item,
            "output_volume_ml": f.output_volume_ml,
            "version": f.version,
            "is_active": f.is_active,
            "created_at": f.created_at.isoformat()
        } for f in formulas],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/formulas", status_code=status.HTTP_201_CREATED)
async def create_formula(
    data: TintFormulaCreate,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Create a new tint formula."""
    import uuid

    # Verify color code exists
    color_code = db.query(ColorCode).filter(
        ColorCode.id == data.color_code_id,
        ColorCode.tenant_id == tenant_id
    ).first()

    if not color_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Color code {data.color_code_id} not found"
        )

    # Get the next version number for this color code
    max_version = (
        db.query(func.max(TintFormula.version))
        .filter(
            TintFormula.color_code_id == data.color_code_id,
            TintFormula.tenant_id == tenant_id,
        )
        .scalar()
    ) or 0

    formula = TintFormula(
        id=str(uuid.uuid4()),
        color_code_id=data.color_code_id,
        name=data.name,
        base_paint_item=data.base_paint_item,
        output_volume_ml=data.output_volume_ml,
        version=max_version + 1,
        tenant_id=tenant_id
    )

    db.add(formula)
    db.flush()  # Get the ID

    # Add components
    for component_data in data.components:
        component = TintFormulaComponent(
            id=str(uuid.uuid4()),
            formula_id=formula.id,
            tint_item_code=component_data.tint_item_code,
            quantity_per_unit=component_data.quantity_per_unit,
            unit_of_measure=component_data.unit_of_measure
        )
        db.add(component)

    db.commit()
    db.refresh(formula)

    return {
        "id": formula.id,
        "color_code_id": formula.color_code_id,
        "name": formula.name,
        "base_paint_item": formula.base_paint_item,
        "output_volume_ml": formula.output_volume_ml,
        "version": formula.version,
        "components": len(data.components)
    }


@router.get("/formulas/{formula_id}")
async def get_formula(
    formula_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get a specific tint formula with components."""
    formula = db.query(TintFormula).filter(
        TintFormula.id == formula_id,
        TintFormula.tenant_id == tenant_id
    ).first()

    if not formula:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Formula {formula_id} not found"
        )

    components = db.query(TintFormulaComponent).filter(
        TintFormulaComponent.formula_id == formula_id
    ).all()

    return {
        "id": formula.id,
        "color_code_id": formula.color_code_id,
        "name": formula.name,
        "base_paint_item": formula.base_paint_item,
        "output_volume_ml": formula.output_volume_ml,
        "version": formula.version,
        "is_active": formula.is_active,
        "components": [{
            "id": c.id,
            "tint_item_code": c.tint_item_code,
            "quantity_per_unit": c.quantity_per_unit,
            "unit_of_measure": c.unit_of_measure,
            "notes": c.notes
        } for c in components],
        "created_at": formula.created_at.isoformat(),
        "updated_at": formula.updated_at.isoformat()
    }


# ==================== Paint Sales ====================

@router.post("/calculate-formula")
async def calculate_paint_formula(
    request: PaintSaleRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Calculate the materials needed for a paint sale."""
    # Check if color code exists, create if not
    color_code = db.query(ColorCode).filter(
        ColorCode.id == request.color_code,
        ColorCode.tenant_id == tenant_id
    ).first()

    if not color_code:
        # Auto-create color code if it doesn't exist
        import uuid
        color_code = ColorCode(
            id=request.color_code,
            name=None,  # No name provided yet
            color_system="CUSTOM",  # Default to custom
            status="ACTIVE",
            tenant_id=tenant_id
        )
        db.add(color_code)
        db.commit()
        db.refresh(color_code)

    # Get the active formula for this color code
    formula = db.query(TintFormula).filter(
        TintFormula.color_code_id == request.color_code,
        TintFormula.tenant_id == tenant_id,
        TintFormula.is_active == True
    ).first()

    if not formula:
        # Return calculation with no formula - frontend will handle this
        return PaintFormulaCalculation(
            color_code=request.color_code,
            color_name=color_code.name if color_code else None,
            quantity_requested_liters=request.quantity_liters,
            base_paint={
                "item_code": "UNKNOWN",
                "quantity": request.quantity_liters,
                "uom": "Liter",
                "unit_cost": 0,
                "total_cost": 0
            },
            tints=[],
            total_estimated_cost=0,
            formula_version=0
        )

    # Calculate scaling factor (requested volume / formula output volume)
    scale_factor = request.quantity_liters * 1000 / formula.output_volume_ml  # Convert liters to ml

    # Get components
    components = db.query(TintFormulaComponent).filter(
        TintFormulaComponent.formula_id == formula.id
    ).all()

    # Calculate base paint quantity
    base_paint_quantity = request.quantity_liters

    # Calculate tint quantities
    tints = []
    total_tint_cost = 0

    for component in components:
        tint_quantity = component.quantity_per_unit * scale_factor / 1000  # Convert ml to liters for consistency

        # Get item price from ERPNext
        try:
            item_data = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Item/{component.tint_item_code}",
                method="GET"
            )
            if isinstance(item_data, dict) and item_data.get("data"):
                item_info = item_data["data"]
                unit_cost = item_info.get("valuation_rate", item_info.get("standard_rate", 0))
                tint_cost = unit_cost * tint_quantity
                total_tint_cost += tint_cost
            else:
                unit_cost = 0
        except:
            unit_cost = 0

        tints.append({
            "item_code": component.tint_item_code,
            "quantity": round(tint_quantity, 4),
            "uom": "Liter",  # Normalized for display
            "unit_cost": unit_cost,
            "total_cost": round(tint_cost, 2) if unit_cost else 0
        })

    # Get base paint cost
    try:
        base_item_data = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Item/{formula.base_paint_item}",
            method="GET"
        )
        if isinstance(base_item_data, dict) and base_item_data.get("data"):
            base_item_info = base_item_data["data"]
            base_unit_cost = base_item_info.get("valuation_rate", base_item_info.get("standard_rate", 0))
            base_paint_cost = base_unit_cost * base_paint_quantity
        else:
            base_unit_cost = 0
            base_paint_cost = 0
    except:
        base_unit_cost = 0
        base_paint_cost = 0

    base_paint = {
        "item_code": formula.base_paint_item,
        "quantity": round(base_paint_quantity, 4),
        "uom": "Liter",
        "unit_cost": base_unit_cost,
        "total_cost": round(base_paint_cost, 2)
    }

    total_cost = base_paint_cost + total_tint_cost

    return PaintFormulaCalculation(
        color_code=request.color_code,
        color_name=color_code.name if color_code else None,
        quantity_requested_liters=request.quantity_liters,
        base_paint=base_paint,
        tints=tints,
        total_estimated_cost=round(total_cost, 2),
        formula_version=formula.version
    )


@router.post("/sell")
async def sell_paint(
    request: PaintSaleRequest,
    pos_profile_id: str,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """Process a paint sale with composite inventory deduction."""
    import uuid

    # First calculate the formula
    calculation = await calculate_paint_formula(request, tenant_id, db)

    # Create POS invoice for the finished paint
    finished_paint_item = f"CUSTOM-PAINT-{request.color_code}"

    # Check if finished paint item exists, create if not
    try:
        existing_item = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Item/{finished_paint_item}",
            method="GET"
        )
        if not (isinstance(existing_item, dict) and existing_item.get("data")):
            # Create virtual finished paint item
            item_data = {
                "item_code": finished_paint_item,
                "item_name": f"Custom Paint - {request.color_code}",
                "item_group": "Paint",
                "stock_uom": "Liter",
                "is_stock_item": 0,  # Virtual item, no stock
                "is_finished_paint": 1,
                "paint_color_system": "Custom",
                "paint_color_code": request.color_code,
                "standard_rate": calculation.total_estimated_cost / request.quantity_liters,
                "valuation_rate": calculation.total_estimated_cost / request.quantity_liters
            }
            erpnext_adapter.create_resource("Item", item_data, tenant_id)
    except Exception as e:
        # Item might already exist, continue
        pass

    # Create POS invoice
    invoice_data = {
        "customer": request.customer,
        "customer_type": request.customer_type,
        "pos_profile_id": pos_profile_id,
        "items": [{
            "item_code": finished_paint_item,
            "qty": request.quantity_liters,
            "rate": calculation.total_estimated_cost / request.quantity_liters,
            "is_vatable": True
        }],
        "payments": [{"mode_of_payment": "Cash", "amount": calculation.total_estimated_cost}],
        "notes": f"Custom paint: {request.color_code}, Formula v{calculation.formula_version}"
    }

    # Submit the invoice
    invoice_result = erpnext_adapter.create_resource("POS Invoice", invoice_data, tenant_id)

    if isinstance(invoice_result, dict) and invoice_result.get("data"):
        invoice_name = invoice_result["data"].get("name")

        # Record the paint sale transaction for audit
        transaction = PaintSaleTransaction(
            id=str(uuid.uuid4()),
            pos_invoice_name=invoice_name,
            color_code_id=request.color_code,
            formula_id=calculation.formula_version,  # This should be the actual formula ID
            quantity_sold_liters=request.quantity_liters,
            base_paint_deducted=calculation.base_paint,
            tints_deducted=calculation.tints,
            total_cost=calculation.total_estimated_cost,
            operator_id=token_payload.get("sub"),
            pos_profile=pos_profile_id,
            tenant_id=tenant_id
        )

        db.add(transaction)
        db.commit()

        return {
            "invoice_name": invoice_name,
            "total_amount": calculation.total_estimated_cost,
            "materials_used": {
                "base_paint": calculation.base_paint,
                "tints": calculation.tints
            },
            "transaction_id": transaction.id
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create POS invoice"
        )