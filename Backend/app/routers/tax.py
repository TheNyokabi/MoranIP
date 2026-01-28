"""
Tax Router

API endpoints for tax management and calculations.

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
from ..services.tax_service import TaxService
from ..models.tax import (
    TaxType, TaxRate, ItemTaxTemplate, TaxTransaction,
    WithholdingTaxConfig, TaxSettings, TaxFilingPeriod
)

router = APIRouter(prefix="/tax", tags=["Tax Management"])


# ==================== Request/Response Models ====================

class TaxTypeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    tax_category: str = Field(..., pattern="^(sales_tax|purchase_tax|withholding|income_tax|duty|levy)$")
    is_compound: bool = False
    is_recoverable: bool = True
    affects_gross: bool = True
    output_account_id: Optional[str] = None
    input_account_id: Optional[str] = None
    expense_account_id: Optional[str] = None
    filing_frequency: str = "monthly"
    filing_due_day: int = 20


class TaxRateCreate(BaseModel):
    tax_type_id: str
    code: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    rate_percentage: float = Field(..., ge=0, le=100)
    rate_type: str = "percentage"
    fixed_amount: Optional[float] = None
    effective_from: Optional[datetime] = None
    applies_to_items: bool = True
    applies_to_services: bool = True
    is_default: bool = False


class ItemTaxTemplateCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    tax_rates: List[Dict] = []
    is_default: bool = False


class CalculateTaxRequest(BaseModel):
    item_code: str
    amount: float = Field(..., gt=0)
    quantity: float = 1
    tax_template_id: Optional[str] = None
    is_purchase: bool = False
    prices_include_tax: Optional[bool] = None


class CalculateInvoiceTaxRequest(BaseModel):
    line_items: List[Dict]
    is_purchase: bool = False


class CalculateWHTRequest(BaseModel):
    category: str
    amount: float = Field(..., gt=0)
    party_is_resident: bool = True


class TaxSettingsUpdate(BaseModel):
    tax_id: Optional[str] = None
    vat_registration_number: Optional[str] = None
    tax_jurisdiction: Optional[str] = None
    default_item_tax_template_id: Optional[str] = None
    prices_include_tax: Optional[bool] = None
    tax_rounding_method: Optional[str] = None
    tax_rounding_precision: Optional[int] = None
    enable_filing_reminders: Optional[bool] = None
    reminder_days_before: Optional[int] = None
    enable_etims: Optional[bool] = None
    etims_device_serial: Optional[str] = None


# ==================== Tax Type Endpoints ====================

@router.get("/types")
async def list_tax_types(
    include_inactive: bool = False,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all tax types"""
    query = db.query(TaxType).filter(TaxType.tenant_id == tenant_id)
    
    if not include_inactive:
        query = query.filter(TaxType.is_active == True)
    
    types = query.all()
    
    return {
        "tax_types": [
            {
                "id": str(t.id),
                "code": t.code,
                "name": t.name,
                "description": t.description,
                "tax_category": t.tax_category,
                "is_compound": t.is_compound,
                "is_recoverable": t.is_recoverable,
                "output_account_id": t.output_account_id,
                "input_account_id": t.input_account_id,
                "filing_frequency": t.filing_frequency,
                "is_active": t.is_active,
            }
            for t in types
        ],
        "total": len(types)
    }


@router.post("/types")
async def create_tax_type(
    data: TaxTypeCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new tax type"""
    # Check for duplicate
    existing = db.query(TaxType).filter(
        TaxType.tenant_id == tenant_id,
        TaxType.code == data.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Tax type '{data.code}' already exists")
    
    tax_type = TaxType(
        tenant_id=tenant_id,
        **data.model_dump()
    )
    
    db.add(tax_type)
    db.commit()
    db.refresh(tax_type)
    
    return {"message": "Tax type created", "tax_type_id": str(tax_type.id)}


@router.get("/types/{type_id}")
async def get_tax_type(
    type_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tax type details with rates"""
    tax_type = db.query(TaxType).filter(
        TaxType.id == type_id,
        TaxType.tenant_id == tenant_id
    ).first()
    
    if not tax_type:
        raise HTTPException(status_code=404, detail="Tax type not found")
    
    rates = db.query(TaxRate).filter(
        TaxRate.tax_type_id == type_id,
        TaxRate.tenant_id == tenant_id,
        TaxRate.is_active == True
    ).all()
    
    return {
        "id": str(tax_type.id),
        "code": tax_type.code,
        "name": tax_type.name,
        "description": tax_type.description,
        "tax_category": tax_type.tax_category,
        "is_compound": tax_type.is_compound,
        "is_recoverable": tax_type.is_recoverable,
        "output_account_id": tax_type.output_account_id,
        "input_account_id": tax_type.input_account_id,
        "filing_frequency": tax_type.filing_frequency,
        "filing_due_day": tax_type.filing_due_day,
        "is_active": tax_type.is_active,
        "rates": [
            {
                "id": str(r.id),
                "code": r.code,
                "name": r.name,
                "rate_percentage": float(r.rate_percentage),
                "is_default": r.is_default,
            }
            for r in rates
        ]
    }


# ==================== Tax Rate Endpoints ====================

@router.get("/rates")
async def list_tax_rates(
    tax_type_id: Optional[str] = None,
    include_inactive: bool = False,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tax rates"""
    query = db.query(TaxRate).filter(TaxRate.tenant_id == tenant_id)
    
    if tax_type_id:
        query = query.filter(TaxRate.tax_type_id == tax_type_id)
    
    if not include_inactive:
        query = query.filter(TaxRate.is_active == True)
    
    rates = query.all()
    
    return {
        "tax_rates": [
            {
                "id": str(r.id),
                "tax_type_id": str(r.tax_type_id),
                "code": r.code,
                "name": r.name,
                "rate_percentage": float(r.rate_percentage),
                "rate_type": r.rate_type,
                "fixed_amount": float(r.fixed_amount) if r.fixed_amount else None,
                "is_default": r.is_default,
                "is_active": r.is_active,
            }
            for r in rates
        ],
        "total": len(rates)
    }


@router.post("/rates")
async def create_tax_rate(
    data: TaxRateCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new tax rate"""
    # Verify tax type exists
    tax_type = db.query(TaxType).filter(
        TaxType.id == data.tax_type_id,
        TaxType.tenant_id == tenant_id
    ).first()
    
    if not tax_type:
        raise HTTPException(status_code=404, detail="Tax type not found")
    
    # If setting as default, unset others
    if data.is_default:
        db.query(TaxRate).filter(
            TaxRate.tenant_id == tenant_id,
            TaxRate.tax_type_id == data.tax_type_id,
            TaxRate.is_default == True
        ).update({"is_default": False})
    
    rate_data = data.model_dump()
    if not rate_data.get("effective_from"):
        rate_data["effective_from"] = datetime.utcnow()
    
    rate = TaxRate(
        tenant_id=tenant_id,
        **rate_data
    )
    
    db.add(rate)
    db.commit()
    db.refresh(rate)
    
    return {"message": "Tax rate created", "tax_rate_id": str(rate.id)}


# ==================== Tax Template Endpoints ====================

@router.get("/templates")
async def list_tax_templates(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List item tax templates"""
    templates = db.query(ItemTaxTemplate).filter(
        ItemTaxTemplate.tenant_id == tenant_id,
        ItemTaxTemplate.is_active == True
    ).all()
    
    return {
        "templates": [
            {
                "id": str(t.id),
                "code": t.code,
                "name": t.name,
                "description": t.description,
                "is_default": t.is_default,
                "tax_rates_count": len(t.tax_rates or []),
            }
            for t in templates
        ],
        "total": len(templates)
    }


@router.post("/templates")
async def create_tax_template(
    data: ItemTaxTemplateCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create an item tax template"""
    # If setting as default, unset others
    if data.is_default:
        db.query(ItemTaxTemplate).filter(
            ItemTaxTemplate.tenant_id == tenant_id,
            ItemTaxTemplate.is_default == True
        ).update({"is_default": False})
    
    template = ItemTaxTemplate(
        tenant_id=tenant_id,
        **data.model_dump()
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return {"message": "Tax template created", "template_id": str(template.id)}


# ==================== Tax Calculation Endpoints ====================

@router.post("/calculate/item")
async def calculate_item_tax(
    data: CalculateTaxRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate tax for a single item"""
    service = TaxService(db, tenant_id)
    
    result = service.calculate_item_taxes(
        item_code=data.item_code,
        amount=Decimal(str(data.amount)),
        quantity=Decimal(str(data.quantity)),
        item_tax_template_id=data.tax_template_id,
        is_purchase=data.is_purchase,
        prices_include_tax=data.prices_include_tax,
    )
    
    return {
        "item_code": result.item_code,
        "base_amount": float(result.base_amount),
        "taxes": result.taxes,
        "total_tax": float(result.total_tax),
        "gross_amount": float(result.gross_amount),
        "breakdown": result.breakdown,
    }


@router.post("/calculate/invoice")
async def calculate_invoice_tax(
    data: CalculateInvoiceTaxRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate tax for an entire invoice"""
    service = TaxService(db, tenant_id)
    
    result = service.calculate_invoice_taxes(
        line_items=data.line_items,
        is_purchase=data.is_purchase,
    )
    
    return {
        "base_total": float(result.base_total),
        "tax_total": float(result.tax_total),
        "grand_total": float(result.grand_total),
        "taxes_by_type": {k: float(v) for k, v in result.taxes_by_type.items()},
        "line_count": len(result.line_items),
    }


@router.post("/calculate/withholding")
async def calculate_withholding_tax(
    data: CalculateWHTRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate withholding tax for a payment"""
    service = TaxService(db, tenant_id)
    
    result = service.calculate_withholding_tax(
        category=data.category,
        amount=Decimal(str(data.amount)),
        party_is_resident=data.party_is_resident,
    )
    
    return result


# ==================== Tax Reporting Endpoints ====================

@router.get("/reports/summary/{tax_type_code}")
async def get_tax_summary(
    tax_type_code: str,
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tax summary for a period"""
    service = TaxService(db, tenant_id)
    
    try:
        summary = service.get_tax_summary_for_period(tax_type_code, period)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/reports/vat-return")
async def get_vat_return(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get VAT return data for filing"""
    service = TaxService(db, tenant_id)
    
    return service.get_vat_return_data(period)


@router.get("/transactions")
async def list_tax_transactions(
    period: Optional[str] = None,
    tax_type_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List tax transactions"""
    query = db.query(TaxTransaction).filter(TaxTransaction.tenant_id == tenant_id)
    
    if period:
        query = query.filter(TaxTransaction.period == period)
    if tax_type_id:
        query = query.filter(TaxTransaction.tax_type_id == tax_type_id)
    if transaction_type:
        query = query.filter(TaxTransaction.transaction_type == transaction_type)
    
    total = query.count()
    transactions = query.order_by(TaxTransaction.document_date.desc()).offset(offset).limit(limit).all()
    
    return {
        "transactions": [
            {
                "id": str(t.id),
                "tax_type_id": str(t.tax_type_id),
                "transaction_type": t.transaction_type,
                "document_type": t.document_type,
                "document_id": t.document_id,
                "document_date": t.document_date.isoformat() if t.document_date else None,
                "base_amount": float(t.base_amount),
                "tax_amount": float(t.tax_amount),
                "party_name": t.party_name,
                "party_tax_id": t.party_tax_id,
                "period": t.period,
                "is_filed": t.is_filed,
            }
            for t in transactions
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# ==================== Tax Settings Endpoints ====================

@router.get("/settings")
async def get_tax_settings(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tax settings"""
    service = TaxService(db, tenant_id)
    settings = service.settings
    
    return {
        "tax_id": settings.tax_id,
        "vat_registration_number": settings.vat_registration_number,
        "tax_jurisdiction": settings.tax_jurisdiction,
        "default_item_tax_template_id": str(settings.default_item_tax_template_id) if settings.default_item_tax_template_id else None,
        "prices_include_tax": settings.prices_include_tax,
        "tax_rounding_method": settings.tax_rounding_method,
        "tax_rounding_precision": settings.tax_rounding_precision,
        "enable_filing_reminders": settings.enable_filing_reminders,
        "reminder_days_before": settings.reminder_days_before,
        "enable_etims": settings.enable_etims,
        "etims_device_serial": settings.etims_device_serial,
    }


@router.put("/settings")
async def update_tax_settings(
    data: TaxSettingsUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update tax settings"""
    settings = db.query(TaxSettings).filter(TaxSettings.tenant_id == tenant_id).first()
    
    if not settings:
        settings = TaxSettings(tenant_id=tenant_id)
        db.add(settings)
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    
    settings.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Tax settings updated"}


# ==================== Seeding Default Tax Configuration ====================

@router.post("/setup/kenya-defaults")
async def setup_kenya_tax_defaults(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set up default Kenya tax configuration (VAT, WHT)"""
    
    # Check if already set up
    existing = db.query(TaxType).filter(
        TaxType.tenant_id == tenant_id,
        TaxType.code == "VAT"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Tax configuration already exists")
    
    # Create VAT tax type
    vat_type = TaxType(
        tenant_id=tenant_id,
        code="VAT",
        name="Value Added Tax",
        description="Kenya VAT at 16%",
        tax_category="sales_tax",
        is_recoverable=True,
        filing_frequency="monthly",
        filing_due_day=20,
    )
    db.add(vat_type)
    db.flush()
    
    # Create VAT rates
    vat_rates = [
        TaxRate(
            tenant_id=tenant_id,
            tax_type_id=vat_type.id,
            code="STD",
            name="Standard Rate (16%)",
            rate_percentage=Decimal("16.0"),
            is_default=True,
        ),
        TaxRate(
            tenant_id=tenant_id,
            tax_type_id=vat_type.id,
            code="ZERO",
            name="Zero Rated (0%)",
            rate_percentage=Decimal("0.0"),
        ),
        TaxRate(
            tenant_id=tenant_id,
            tax_type_id=vat_type.id,
            code="EXEMPT",
            name="VAT Exempt",
            rate_percentage=Decimal("0.0"),
        ),
    ]
    for rate in vat_rates:
        db.add(rate)
    
    # Create default template
    template = ItemTaxTemplate(
        tenant_id=tenant_id,
        code="STANDARD",
        name="Standard VAT 16%",
        description="Standard VAT rate for most goods and services",
        tax_rates=[{"tax_type_id": str(vat_type.id), "priority": 1}],
        is_default=True,
    )
    db.add(template)
    
    # Create WHT configurations
    wht_categories = [
        ("CONSULTANCY", "Consultancy/Professional Fees", Decimal("5.0")),
        ("MANAGEMENT", "Management Fees", Decimal("5.0")),
        ("RENT", "Rent - Immovable Property", Decimal("10.0")),
        ("DIVIDENDS", "Dividends", Decimal("5.0")),
        ("INTEREST", "Interest", Decimal("15.0")),
    ]
    
    for code, name, rate in wht_categories:
        wht = WithholdingTaxConfig(
            tenant_id=tenant_id,
            category=code,
            name=name,
            rate_percentage=rate,
            resident_rate=rate,
            non_resident_rate=rate + Decimal("5"),  # Non-residents typically higher
        )
        db.add(wht)
    
    db.commit()
    
    return {
        "message": "Kenya tax defaults configured",
        "vat_type_id": str(vat_type.id),
        "template_id": str(template.id),
    }
