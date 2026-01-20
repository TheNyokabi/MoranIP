"""
PoS Session and Order Models
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# ==================== Session Models ====================

class PosSessionBase(BaseModel):
    """Base PoS Session model"""
    profile_id: str = Field(..., description="PoS Profile ID")
    opening_cash: Optional[float] = Field(None, ge=0)


class PosSessionCreate(PosSessionBase):
    """Create PoS Session request"""
    pass


class PosSession(PosSessionBase):
    """PoS Session response"""
    id: str
    user: str
    opening_time: datetime
    closing_time: Optional[datetime] = None
    status: Literal['Open', 'Closed'] = 'Open'
    closing_cash: Optional[float] = None
    total_sales: float = 0
    total_orders: int = 0
    
    class Config:
        from_attributes = True


class PosSessionClose(BaseModel):
    """Close PoS Session request"""
    closing_cash: Optional[float] = Field(None, ge=0)


# ==================== Order Models ====================

class OrderItem(BaseModel):
    """Order line item"""
    item_code: str = Field(..., min_length=1)
    item_name: Optional[str] = None
    qty: float = Field(..., gt=0)
    rate: Optional[float] = Field(None, ge=0)
    amount: Optional[float] = None


class PosOrderBase(BaseModel):
    """Base PoS Order model"""
    session_id: str = Field(..., description="PoS Session ID")
    customer: Optional[str] = None
    items: List[OrderItem] = Field(..., min_items=1)


class PosOrderCreate(PosOrderBase):
    """Create PoS Order request"""
    pass


class PosOrderUpdate(BaseModel):
    """Update PoS Order request"""
    items: List[OrderItem] = Field(..., min_items=1)


class PosOrder(PosOrderBase):
    """PoS Order response"""
    id: str
    subtotal: float = 0
    tax: float = 0
    discount: float = 0
    total: float = 0
    payment_method: Optional[str] = None
    status: Literal['Draft', 'Paid', 'Cancelled'] = 'Draft'
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentRequest(BaseModel):
    """Process payment request"""
    payment_method: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)


class Receipt(BaseModel):
    """Receipt response"""
    order_id: str
    receipt_number: str
    customer: Optional[str]
    items: List[OrderItem]
    subtotal: float
    tax: float
    discount: float
    total: float
    payment_method: str
    amount_paid: float
    change: float
    timestamp: datetime
    footer_text: str
