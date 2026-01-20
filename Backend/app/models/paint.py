"""
Paint Management Models
Supports custom paint sales with color codes and tint formulas
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class ColorCode(Base):
    """
    Color Code Management
    Supports RAL, Pantone, NCS, and custom color systems
    """
    __tablename__ = "color_codes"

    id = Column(String(50), primary_key=True)  # e.g., "RAL-5015", "PANTONE-285C"
    name = Column(String(255), nullable=True)  # Human readable name
    color_system = Column(String(50), nullable=False)  # RAL, PANTONE, NCS, CUSTOM
    hex_code = Column(String(7), nullable=True)  # #RRGGBB format
    rgb_values = Column(JSON, nullable=True)  # {"r": 255, "g": 0, "b": 0}
    status = Column(String(20), default="ACTIVE")  # ACTIVE, DEPRECATED
    tenant_id = Column(String(36), nullable=False)  # FK constraint added later
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    formulas = relationship("TintFormula", back_populates="color_code", cascade="all, delete-orphan")
    # tenant = relationship("Tenant")  # FK constraint removed

    def __repr__(self):
        return f"<ColorCode(id='{self.id}', system='{self.color_system}', status='{self.status}')>"


class TintFormula(Base):
    """
    Tint Formula Definition
    Defines the exact quantities of base paint and tints needed for a color
    """
    __tablename__ = "tint_formulas"

    id = Column(String(36), primary_key=True)  # UUID
    color_code_id = Column(String(50), ForeignKey("color_codes.id"), nullable=False)
    name = Column(String(255), nullable=True)  # Formula name/version
    base_paint_item = Column(String(255), nullable=False)  # ERPNext Item Code
    output_volume_ml = Column(Float, nullable=False)  # Volume this formula produces (ml)
    version = Column(Integer, default=1)  # Formula version for tracking changes
    is_active = Column(Boolean, default=True)
    tenant_id = Column(String(36), nullable=False)  # FK constraint added later
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    color_code = relationship("ColorCode", back_populates="formulas")
    components = relationship("TintFormulaComponent", back_populates="formula", cascade="all, delete-orphan")
    # tenant = relationship("Tenant")  # FK constraint removed

    def __repr__(self):
        return f"<TintFormula(color='{self.color_code_id}', base='{self.base_paint_item}', volume={self.output_volume_ml}ml)>"


class TintFormulaComponent(Base):
    """
    Individual components in a tint formula
    Each component specifies a tint item and its quantity
    """
    __tablename__ = "tint_formula_components"

    id = Column(String(36), primary_key=True)  # UUID
    formula_id = Column(String(36), ForeignKey("tint_formulas.id"), nullable=False)
    tint_item_code = Column(String(255), nullable=False)  # ERPNext Item Code
    quantity_per_unit = Column(Float, nullable=False)  # Quantity per output volume unit (ml or grams)
    unit_of_measure = Column(String(10), default="ml")  # ml, g, kg, etc.
    notes = Column(Text, nullable=True)

    # Relationships
    formula = relationship("TintFormula", back_populates="components")

    def __repr__(self):
        return f"<TintFormulaComponent(item='{self.tint_item_code}', qty={self.quantity_per_unit}{self.unit_of_measure})>"


class PaintSaleTransaction(Base):
    """
    Audit trail for paint sales
    Tracks what was deducted for traceability
    """
    __tablename__ = "paint_sale_transactions"

    id = Column(String(36), primary_key=True)  # UUID
    pos_invoice_name = Column(String(255), nullable=False)  # ERPNext POS Invoice name
    color_code_id = Column(String(50), ForeignKey("color_codes.id"), nullable=False)
    formula_id = Column(String(36), ForeignKey("tint_formulas.id"), nullable=False)
    quantity_sold_liters = Column(Float, nullable=False)
    base_paint_deducted = Column(JSON, nullable=False)  # {"item_code": "BASE-A", "quantity": 5.0, "uom": "Liter"}
    tints_deducted = Column(JSON, nullable=False)  # [{"item_code": "BLUE-TINT", "quantity": 60, "uom": "ml"}, ...]
    total_cost = Column(Float, nullable=False)
    operator_id = Column(String(36), nullable=True)  # User who performed the sale
    pos_profile = Column(String(255), nullable=True)
    tenant_id = Column(String(36), nullable=False)  # FK constraint added later
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    color_code = relationship("ColorCode")
    formula = relationship("TintFormula")
    # tenant = relationship("Tenant")  # FK constraint removed

    def __repr__(self):
        return f"<PaintSaleTransaction(invoice='{self.pos_invoice_name}', color='{self.color_code_id}', qty={self.quantity_sold_liters}L)>"


# Pydantic models for API
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ColorCodeCreate(BaseModel):
    id: str = Field(..., description="Color code ID (e.g., RAL-5015)")
    name: Optional[str] = Field(None, description="Human readable name")
    color_system: str = Field(..., description="RAL, PANTONE, NCS, CUSTOM")
    hex_code: Optional[str] = Field(None, description="#RRGGBB format")
    rgb_values: Optional[Dict[str, int]] = Field(None, description="RGB values")


class ColorCodeUpdate(BaseModel):
    name: Optional[str] = None
    hex_code: Optional[str] = None
    rgb_values: Optional[Dict[str, int]] = None
    status: Optional[str] = None


class TintFormulaComponentCreate(BaseModel):
    tint_item_code: str = Field(..., description="ERPNext Item Code")
    quantity_per_unit: float = Field(..., description="Quantity per output volume unit")
    unit_of_measure: str = Field("ml", description="Unit of measure (ml, g, kg)")


class TintFormulaCreate(BaseModel):
    color_code_id: str = Field(..., description="Color code this formula belongs to")
    name: Optional[str] = Field(None, description="Formula name/version")
    base_paint_item: str = Field(..., description="Base paint ERPNext Item Code")
    output_volume_ml: float = Field(..., description="Volume this formula produces in ml")
    components: List[TintFormulaComponentCreate] = Field(..., description="List of tint components")


class TintFormulaUpdate(BaseModel):
    name: Optional[str] = None
    base_paint_item: Optional[str] = None
    output_volume_ml: Optional[float] = None
    components: Optional[List[TintFormulaComponentCreate]] = None
    is_active: Optional[bool] = None


class PaintSaleRequest(BaseModel):
    color_code: str = Field(..., description="Color code (e.g., RAL-5015)")
    quantity_liters: float = Field(..., description="Quantity in liters")
    customer: Optional[str] = Field("Walk-in Customer", description="Customer name")
    customer_type: str = Field("Individual", description="Direct, Fundi, Sales Team, or Wholesaler")
    notes: Optional[str] = None


class PaintFormulaCalculation(BaseModel):
    color_code: str
    color_name: Optional[str]
    quantity_requested_liters: float
    base_paint: Dict[str, Any]  # {"item_code": "BASE-A", "quantity": 5.0, "uom": "Liter"}
    tints: List[Dict[str, Any]]  # [{"item_code": "BLUE-TINT", "quantity": 60, "uom": "ml"}, ...]
    total_estimated_cost: float
    formula_version: int