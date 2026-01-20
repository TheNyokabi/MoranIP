"""
Point of Sale Profile Models
Configurable profiles for different store locations
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


class PaymentMethod(BaseModel):
    """Payment method configuration"""
    type: Literal['Cash', 'M-Pesa', 'Card', 'Bank', 'Credit']
    enabled: bool = True
    account: Optional[str] = None


class SessionSettings(BaseModel):
    """PoS session configuration"""
    allow_concurrent: bool = False
    allow_handover: bool = True
    auto_close_hours: int = 24
    require_opening_cash: bool = True


class InventorySettings(BaseModel):
    """Inventory behavior configuration"""
    stock_deduction: Literal['immediate', 'pending', 'manual'] = 'immediate'
    allow_backorders: bool = False
    low_stock_warning: bool = True
    reserve_stock: bool = False


class ReceiptSettings(BaseModel):
    """Receipt configuration"""
    company_logo: Optional[str] = None
    footer_text: str = "Thank you for your business!"
    auto_print: bool = False
    email_receipt: bool = False


class PosProfileBase(BaseModel):
    """Base PoS Profile model"""
    name: str = Field(..., min_length=1, max_length=200)
    warehouse: str = Field(..., min_length=1)
    payment_methods: List[PaymentMethod] = Field(default_factory=lambda: [
        PaymentMethod(type='Cash', enabled=True)
    ])
    session_settings: SessionSettings = Field(default_factory=SessionSettings)
    inventory_settings: InventorySettings = Field(default_factory=InventorySettings)
    receipt_settings: ReceiptSettings = Field(default_factory=ReceiptSettings)


class PosProfileCreate(PosProfileBase):
    """Create PoS Profile request"""
    pass


class PosProfileUpdate(BaseModel):
    """Update PoS Profile request"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    warehouse: Optional[str] = None
    payment_methods: Optional[List[PaymentMethod]] = None
    session_settings: Optional[SessionSettings] = None
    inventory_settings: Optional[InventorySettings] = None
    receipt_settings: Optional[ReceiptSettings] = None


class PosProfile(PosProfileBase):
    """PoS Profile response"""
    id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
