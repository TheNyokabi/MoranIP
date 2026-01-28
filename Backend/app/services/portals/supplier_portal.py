"""
Supplier Portal Service

Provides:
- Purchase order management
- Order confirmation/rejection
- Delivery updates
- Invoice submission
- Product catalog management
- Payment tracking
"""

import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any

from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from ...models.portals import (
    PortalUser, PortalSession, PortalActivity,
    SupplierCatalog, SupplierOrderConfirmation, SupplierInvoice,
    PortalNotification
)

logger = logging.getLogger(__name__)


class SupplierPortalService:
    """Service for supplier self-service portal"""
    
    def __init__(
        self,
        db: Session,
        tenant_id: str,
        erpnext_adapter=None
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.erpnext_adapter = erpnext_adapter
    
    # ==================== Authentication ====================
    
    def create_portal_user(
        self,
        email: str,
        supplier_id: str,
        full_name: Optional[str] = None,
        company_name: Optional[str] = None,
        phone: Optional[str] = None,
        password: Optional[str] = None
    ) -> PortalUser:
        """Create a new supplier portal user"""
        existing = self.db.query(PortalUser).filter(
            PortalUser.tenant_id == self.tenant_id,
            PortalUser.email == email,
            PortalUser.portal_type == "supplier"
        ).first()
        
        if existing:
            return existing
        
        password_hash = None
        if password:
            password_hash = self._hash_password(password)
        
        verification_token = secrets.token_urlsafe(32)
        
        user = PortalUser(
            tenant_id=self.tenant_id,
            supplier_id=supplier_id,
            portal_type="supplier",
            email=email,
            phone=phone,
            full_name=full_name,
            company_name=company_name,
            password_hash=password_hash,
            verification_token=verification_token,
            is_verified=False
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        logger.info(f"Created portal user for supplier {supplier_id}")
        return user
    
    def authenticate(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Authenticate supplier portal user"""
        user = self.db.query(PortalUser).filter(
            PortalUser.tenant_id == self.tenant_id,
            PortalUser.email == email,
            PortalUser.portal_type == "supplier"
        ).first()
        
        if not user:
            return None
        
        if user.locked_until and user.locked_until > datetime.utcnow():
            return {"error": "Account locked", "locked_until": user.locked_until}
        
        if not self._verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(hours=1)
            self.db.commit()
            return None
        
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = ip_address
        
        session = self._create_session(user, ip_address)
        self._log_activity(user.id, "login", ip_address=ip_address)
        self.db.commit()
        
        return {
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "company_name": user.company_name,
            "supplier_id": user.supplier_id,
            "session_token": session.token_hash,
            "expires_at": session.expires_at
        }
    
    def _create_session(self, user: PortalUser, ip_address: Optional[str]) -> PortalSession:
        token = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        session = PortalSession(
            portal_user_id=user.id,
            tenant_id=self.tenant_id,
            token_hash=token_hash,
            ip_address=ip_address,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )
        self.db.add(session)
        session.token_hash = token
        return session
    
    def _hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(32)
        hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return salt.hex() + hash_bytes.hex()
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        if not password_hash:
            return False
        salt = bytes.fromhex(password_hash[:64])
        stored_hash = password_hash[64:]
        hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return hash_bytes.hex() == stored_hash
    
    # ==================== Purchase Orders ====================
    
    async def get_purchase_orders(
        self,
        portal_user_id: str,
        limit: int = 50,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get purchase orders for supplier"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_view_purchase_orders:
            return []
        
        if not self.erpnext_adapter:
            return []
        
        filters = [
            ["supplier", "=", user.supplier_id],
            ["docstatus", "=", 1]  # Submitted only
        ]
        
        if status:
            filters.append(["status", "=", status])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Purchase Order",
                fields=[
                    "name", "transaction_date", "schedule_date",
                    "grand_total", "status", "per_received", "per_billed"
                ],
                filters=filters,
                order_by="creation desc",
                limit=limit
            )
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error fetching purchase orders: {e}")
            return []
    
    async def get_purchase_order_details(
        self,
        portal_user_id: str,
        order_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get purchase order details"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not self.erpnext_adapter:
            return None
        
        try:
            order = self.erpnext_adapter.get_resource(
                tenant_id=self.tenant_id,
                doctype="Purchase Order",
                name=order_id
            )
            
            if not order.get("data"):
                return None
            
            if order["data"].get("supplier") != user.supplier_id:
                return None
            
            self._log_activity(
                portal_user_id,
                "view_purchase_order",
                reference_type="Purchase Order",
                reference_id=order_id
            )
            self.db.commit()
            
            return order["data"]
        except Exception as e:
            logger.error(f"Error fetching PO details: {e}")
            return None
    
    def confirm_purchase_order(
        self,
        portal_user_id: str,
        order_id: str,
        expected_delivery_date: datetime,
        item_confirmations: List[Dict[str, Any]],
        delivery_notes: Optional[str] = None
    ) -> Optional[SupplierOrderConfirmation]:
        """Confirm a purchase order"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_confirm_orders:
            return None
        
        # Check for existing confirmation
        existing = self.db.query(SupplierOrderConfirmation).filter(
            SupplierOrderConfirmation.purchase_order_id == order_id,
            SupplierOrderConfirmation.portal_user_id == portal_user_id
        ).first()
        
        if existing:
            # Update existing
            existing.expected_delivery_date = expected_delivery_date
            existing.item_confirmations = item_confirmations
            existing.delivery_notes = delivery_notes
            existing.status = "confirmed"
            existing.confirmed_at = datetime.utcnow()
            self.db.commit()
            return existing
        
        confirmation = SupplierOrderConfirmation(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            purchase_order_id=order_id,
            status="confirmed",
            confirmed_at=datetime.utcnow(),
            expected_delivery_date=expected_delivery_date,
            item_confirmations=item_confirmations,
            delivery_notes=delivery_notes
        )
        
        self.db.add(confirmation)
        
        self._log_activity(
            portal_user_id,
            "confirm_order",
            reference_type="Purchase Order",
            reference_id=order_id,
            description=f"Confirmed PO with delivery on {expected_delivery_date.date()}"
        )
        
        self.db.commit()
        self.db.refresh(confirmation)
        
        return confirmation
    
    def reject_purchase_order(
        self,
        portal_user_id: str,
        order_id: str,
        rejection_reason: str
    ) -> Optional[SupplierOrderConfirmation]:
        """Reject a purchase order"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_confirm_orders:
            return None
        
        confirmation = SupplierOrderConfirmation(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            purchase_order_id=order_id,
            status="rejected",
            rejection_reason=rejection_reason
        )
        
        self.db.add(confirmation)
        
        self._log_activity(
            portal_user_id,
            "reject_order",
            reference_type="Purchase Order",
            reference_id=order_id,
            description=f"Rejected PO: {rejection_reason}"
        )
        
        self.db.commit()
        self.db.refresh(confirmation)
        
        return confirmation
    
    # ==================== Invoices ====================
    
    def submit_invoice(
        self,
        portal_user_id: str,
        purchase_order_id: str,
        invoice_number: str,
        invoice_date: datetime,
        items: List[Dict[str, Any]],
        subtotal: Decimal,
        tax_amount: Decimal,
        grand_total: Decimal,
        attachment_url: Optional[str] = None,
        currency: str = "KES"
    ) -> Optional[SupplierInvoice]:
        """Submit an invoice"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_submit_invoices:
            return None
        
        # Check for duplicate
        existing = self.db.query(SupplierInvoice).filter(
            SupplierInvoice.portal_user_id == portal_user_id,
            SupplierInvoice.supplier_invoice_number == invoice_number
        ).first()
        
        if existing:
            return None  # Duplicate invoice number
        
        invoice = SupplierInvoice(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            purchase_order_id=purchase_order_id,
            supplier_invoice_number=invoice_number,
            supplier_invoice_date=invoice_date,
            items=items,
            subtotal=subtotal,
            tax_amount=tax_amount,
            grand_total=grand_total,
            currency=currency,
            invoice_attachment_url=attachment_url,
            status="submitted"
        )
        
        self.db.add(invoice)
        
        self._log_activity(
            portal_user_id,
            "submit_invoice",
            reference_type="Supplier Invoice",
            reference_id=invoice_number,
            description=f"Submitted invoice for {grand_total} {currency}"
        )
        
        self.db.commit()
        self.db.refresh(invoice)
        
        return invoice
    
    def get_invoices(
        self,
        portal_user_id: str,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[SupplierInvoice]:
        """Get supplier's submitted invoices"""
        query = self.db.query(SupplierInvoice).filter(
            SupplierInvoice.portal_user_id == portal_user_id
        )
        
        if status:
            query = query.filter(SupplierInvoice.status == status)
        
        return query.order_by(
            SupplierInvoice.created_at.desc()
        ).limit(limit).all()
    
    async def get_payment_status(
        self,
        portal_user_id: str
    ) -> Dict[str, Any]:
        """Get payment status summary"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user:
            return {}
        
        # Get invoice summaries
        invoices = self.db.query(SupplierInvoice).filter(
            SupplierInvoice.portal_user_id == portal_user_id
        ).all()
        
        total_submitted = sum(i.grand_total for i in invoices if i.status == "submitted")
        total_approved = sum(i.grand_total for i in invoices if i.status == "approved")
        total_paid = sum(i.grand_total for i in invoices if i.status == "paid")
        total_pending = total_approved  # Approved but not paid
        
        return {
            "total_submitted": float(total_submitted),
            "total_approved": float(total_approved),
            "total_paid": float(total_paid),
            "total_pending": float(total_pending),
            "invoices_pending_review": sum(1 for i in invoices if i.status == "submitted"),
            "invoices_approved": sum(1 for i in invoices if i.status == "approved"),
            "invoices_paid": sum(1 for i in invoices if i.status == "paid")
        }
    
    # ==================== Product Catalog ====================
    
    def add_catalog_item(
        self,
        portal_user_id: str,
        supplier_item_code: str,
        supplier_item_name: str,
        unit_price: Decimal,
        description: Optional[str] = None,
        category: Optional[str] = None,
        min_order_qty: int = 1,
        lead_time_days: int = 0,
        image_url: Optional[str] = None,
        specifications: Optional[Dict] = None,
        currency: str = "KES"
    ) -> Optional[SupplierCatalog]:
        """Add item to supplier catalog"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_manage_catalog:
            return None
        
        # Check for duplicate
        existing = self.db.query(SupplierCatalog).filter(
            SupplierCatalog.portal_user_id == portal_user_id,
            SupplierCatalog.supplier_item_code == supplier_item_code
        ).first()
        
        if existing:
            # Update existing
            existing.supplier_item_name = supplier_item_name
            existing.unit_price = unit_price
            existing.description = description
            existing.category = category
            existing.min_order_qty = min_order_qty
            existing.lead_time_days = lead_time_days
            existing.image_url = image_url
            existing.specifications = specifications or {}
            existing.currency = currency
            self.db.commit()
            return existing
        
        item = SupplierCatalog(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            supplier_item_code=supplier_item_code,
            supplier_item_name=supplier_item_name,
            unit_price=unit_price,
            description=description,
            category=category,
            min_order_qty=min_order_qty,
            lead_time_days=lead_time_days,
            image_url=image_url,
            specifications=specifications or {},
            currency=currency
        )
        
        self.db.add(item)
        
        self._log_activity(
            portal_user_id,
            "add_catalog_item",
            reference_type="Catalog Item",
            reference_id=supplier_item_code
        )
        
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def get_catalog(
        self,
        portal_user_id: str,
        category: Optional[str] = None,
        is_available: Optional[bool] = None
    ) -> List[SupplierCatalog]:
        """Get supplier's catalog"""
        query = self.db.query(SupplierCatalog).filter(
            SupplierCatalog.portal_user_id == portal_user_id
        )
        
        if category:
            query = query.filter(SupplierCatalog.category == category)
        
        if is_available is not None:
            query = query.filter(SupplierCatalog.is_available == is_available)
        
        return query.order_by(SupplierCatalog.supplier_item_name).all()
    
    def update_catalog_availability(
        self,
        portal_user_id: str,
        item_id: str,
        is_available: bool,
        stock_qty: Optional[int] = None
    ) -> bool:
        """Update item availability"""
        item = self.db.query(SupplierCatalog).filter(
            SupplierCatalog.id == item_id,
            SupplierCatalog.portal_user_id == portal_user_id
        ).first()
        
        if not item:
            return False
        
        item.is_available = is_available
        if stock_qty is not None:
            item.stock_qty = stock_qty
        
        self.db.commit()
        return True
    
    def delete_catalog_item(
        self,
        portal_user_id: str,
        item_id: str
    ) -> bool:
        """Delete catalog item"""
        item = self.db.query(SupplierCatalog).filter(
            SupplierCatalog.id == item_id,
            SupplierCatalog.portal_user_id == portal_user_id
        ).first()
        
        if not item:
            return False
        
        self.db.delete(item)
        self.db.commit()
        return True
    
    # ==================== Helpers ====================
    
    def _log_activity(
        self,
        portal_user_id: str,
        activity_type: str,
        description: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        activity = PortalActivity(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            activity_type=activity_type,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            ip_address=ip_address,
            metadata=metadata or {}
        )
        self.db.add(activity)
    
    def get_notifications(
        self,
        portal_user_id: str,
        unread_only: bool = False,
        limit: int = 20
    ) -> List[PortalNotification]:
        query = self.db.query(PortalNotification).filter(
            PortalNotification.portal_user_id == portal_user_id
        )
        
        if unread_only:
            query = query.filter(PortalNotification.is_read == False)
        
        return query.order_by(
            PortalNotification.created_at.desc()
        ).limit(limit).all()
