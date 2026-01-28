"""
Customer Portal Service

Provides:
- Order history and tracking
- New order placement
- Invoice viewing and payment
- Quote requests
- Account statements
- Loyalty points integration
"""

import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any

from sqlalchemy import func, desc, and_, or_
from sqlalchemy.orm import Session

from ...models.portals import (
    PortalUser, PortalSession, PortalActivity,
    PortalQuoteRequest, PortalOrder, PortalNotification
)

logger = logging.getLogger(__name__)


class CustomerPortalService:
    """Service for customer self-service portal"""
    
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
        customer_id: str,
        full_name: Optional[str] = None,
        phone: Optional[str] = None,
        password: Optional[str] = None
    ) -> PortalUser:
        """Create a new customer portal user"""
        # Check if already exists
        existing = self.db.query(PortalUser).filter(
            PortalUser.tenant_id == self.tenant_id,
            PortalUser.email == email,
            PortalUser.portal_type == "customer"
        ).first()
        
        if existing:
            return existing
        
        # Hash password if provided
        password_hash = None
        if password:
            password_hash = self._hash_password(password)
        
        # Generate verification token
        verification_token = secrets.token_urlsafe(32)
        
        user = PortalUser(
            tenant_id=self.tenant_id,
            customer_id=customer_id,
            portal_type="customer",
            email=email,
            phone=phone,
            full_name=full_name,
            password_hash=password_hash,
            verification_token=verification_token,
            is_verified=False
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        logger.info(f"Created portal user for customer {customer_id}")
        return user
    
    def authenticate(
        self,
        email: str,
        password: str,
        ip_address: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Authenticate portal user"""
        user = self.db.query(PortalUser).filter(
            PortalUser.tenant_id == self.tenant_id,
            PortalUser.email == email,
            PortalUser.portal_type == "customer"
        ).first()
        
        if not user:
            return None
        
        # Check if locked
        if user.locked_until and user.locked_until > datetime.utcnow():
            return {"error": "Account locked", "locked_until": user.locked_until}
        
        # Verify password
        if not self._verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            
            # Lock after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(hours=1)
            
            self.db.commit()
            return None
        
        # Reset failed attempts
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = ip_address
        
        # Create session
        session = self._create_session(user, ip_address)
        
        # Log activity
        self._log_activity(user.id, "login", ip_address=ip_address)
        
        self.db.commit()
        
        return {
            "user_id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "customer_id": user.customer_id,
            "session_token": session.token_hash,
            "expires_at": session.expires_at
        }
    
    def _create_session(
        self,
        user: PortalUser,
        ip_address: Optional[str] = None
    ) -> PortalSession:
        """Create a new session"""
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
        # Don't commit here, let caller commit
        
        # Store actual token for return (not hash)
        session.token_hash = token
        return session
    
    def _hash_password(self, password: str) -> str:
        """Hash a password"""
        salt = secrets.token_bytes(32)
        hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        return salt.hex() + hash_bytes.hex()
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify a password against hash"""
        if not password_hash:
            return False
        
        salt = bytes.fromhex(password_hash[:64])
        stored_hash = password_hash[64:]
        hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
        
        return hash_bytes.hex() == stored_hash
    
    # ==================== Orders ====================
    
    async def get_order_history(
        self,
        portal_user_id: str,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get customer's order history from ERPNext"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not self.erpnext_adapter:
            return []
        
        filters = [
            ["customer", "=", user.customer_id],
            ["docstatus", "!=", 2]  # Not cancelled
        ]
        
        if status:
            filters.append(["status", "=", status])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Order",
                fields=[
                    "name", "transaction_date", "delivery_date",
                    "grand_total", "status", "per_delivered", "per_billed"
                ],
                filters=filters,
                order_by="creation desc",
                limit=limit,
                start=offset
            )
            
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error fetching order history: {e}")
            return []
    
    async def get_order_details(
        self,
        portal_user_id: str,
        order_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed order information"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not self.erpnext_adapter:
            return None
        
        try:
            # Get order
            order = self.erpnext_adapter.get_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Order",
                name=order_id
            )
            
            if not order.get("data"):
                return None
            
            order_data = order["data"]
            
            # Verify ownership
            if order_data.get("customer") != user.customer_id:
                return None
            
            # Log activity
            self._log_activity(
                portal_user_id,
                "view_order",
                reference_type="Sales Order",
                reference_id=order_id
            )
            self.db.commit()
            
            return order_data
        except Exception as e:
            logger.error(f"Error fetching order details: {e}")
            return None
    
    async def place_order(
        self,
        portal_user_id: str,
        items: List[Dict[str, Any]],
        shipping_address: Optional[Dict] = None,
        delivery_date: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Place a new order"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_place_orders:
            return None
        
        if not self.erpnext_adapter:
            return None
        
        try:
            # Create Sales Order in ERPNext
            order_data = {
                "doctype": "Sales Order",
                "customer": user.customer_id,
                "order_type": "Shopping Cart",
                "items": [
                    {
                        "item_code": item["item_code"],
                        "qty": item["qty"],
                        "rate": item.get("rate")
                    }
                    for item in items
                ],
                "notes": notes
            }
            
            if delivery_date:
                order_data["delivery_date"] = delivery_date
            
            result = self.erpnext_adapter.create_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Order",
                data=order_data
            )
            
            if result.get("data"):
                # Create portal order record
                portal_order = PortalOrder(
                    portal_user_id=portal_user_id,
                    tenant_id=self.tenant_id,
                    sales_order_id=result["data"].get("name"),
                    order_number=result["data"].get("name"),
                    items=items,
                    grand_total=result["data"].get("grand_total", 0),
                    shipping_address=shipping_address,
                    customer_notes=notes,
                    status="submitted",
                    submitted_at=datetime.utcnow()
                )
                self.db.add(portal_order)
                
                # Log activity
                self._log_activity(
                    portal_user_id,
                    "place_order",
                    reference_type="Sales Order",
                    reference_id=result["data"].get("name"),
                    description=f"Placed order {result['data'].get('name')}"
                )
                
                # Create notification
                self._create_notification(
                    portal_user_id,
                    "order_placed",
                    "Order Placed Successfully",
                    f"Your order {result['data'].get('name')} has been placed.",
                    reference_type="Sales Order",
                    reference_id=result["data"].get("name")
                )
                
                self.db.commit()
                
                return result["data"]
        
        except Exception as e:
            logger.error(f"Error placing order: {e}")
            return None
    
    # ==================== Invoices ====================
    
    async def get_invoices(
        self,
        portal_user_id: str,
        limit: int = 50,
        is_paid: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """Get customer's invoices"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_view_invoices:
            return []
        
        if not self.erpnext_adapter:
            return []
        
        filters = [
            ["customer", "=", user.customer_id],
            ["docstatus", "=", 1]  # Submitted only
        ]
        
        if is_paid is not None:
            if is_paid:
                filters.append(["outstanding_amount", "=", 0])
            else:
                filters.append(["outstanding_amount", ">", 0])
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice",
                fields=[
                    "name", "posting_date", "due_date",
                    "grand_total", "outstanding_amount", "status"
                ],
                filters=filters,
                order_by="creation desc",
                limit=limit
            )
            
            return result.get("data", [])
        except Exception as e:
            logger.error(f"Error fetching invoices: {e}")
            return []
    
    async def get_invoice_pdf(
        self,
        portal_user_id: str,
        invoice_id: str
    ) -> Optional[bytes]:
        """Get invoice PDF for download"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not self.erpnext_adapter:
            return None
        
        # Verify ownership and log activity
        # TODO: Implement PDF generation via ERPNext
        
        self._log_activity(
            portal_user_id,
            "download_invoice",
            reference_type="Sales Invoice",
            reference_id=invoice_id
        )
        self.db.commit()
        
        return None
    
    # ==================== Quotes ====================
    
    def request_quote(
        self,
        portal_user_id: str,
        items: List[Dict[str, Any]],
        title: Optional[str] = None,
        description: Optional[str] = None,
        required_by: Optional[datetime] = None,
        delivery_address: Optional[str] = None
    ) -> Optional[PortalQuoteRequest]:
        """Submit a quote request"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_request_quotes:
            return None
        
        # Generate request number
        count = self.db.query(func.count(PortalQuoteRequest.id)).filter(
            PortalQuoteRequest.tenant_id == self.tenant_id
        ).scalar()
        request_number = f"QR-{datetime.now().strftime('%Y%m')}-{count + 1:04d}"
        
        quote_request = PortalQuoteRequest(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            request_number=request_number,
            title=title,
            description=description,
            items=items,
            required_by=required_by,
            delivery_address=delivery_address,
            status="pending"
        )
        
        self.db.add(quote_request)
        
        # Log activity
        self._log_activity(
            portal_user_id,
            "request_quote",
            reference_type="Quote Request",
            reference_id=request_number,
            description=f"Requested quote for {len(items)} items"
        )
        
        self.db.commit()
        self.db.refresh(quote_request)
        
        return quote_request
    
    def get_quote_requests(
        self,
        portal_user_id: str,
        status: Optional[str] = None
    ) -> List[PortalQuoteRequest]:
        """Get user's quote requests"""
        query = self.db.query(PortalQuoteRequest).filter(
            PortalQuoteRequest.portal_user_id == portal_user_id
        )
        
        if status:
            query = query.filter(PortalQuoteRequest.status == status)
        
        return query.order_by(PortalQuoteRequest.created_at.desc()).all()
    
    # ==================== Account Statement ====================
    
    async def get_account_statement(
        self,
        portal_user_id: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get customer account statement"""
        user = self.db.query(PortalUser).filter(
            PortalUser.id == portal_user_id
        ).first()
        
        if not user or not user.can_view_statements:
            return {}
        
        # Set date range
        if not to_date:
            to_date = datetime.now().strftime("%Y-%m-%d")
        if not from_date:
            from_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        
        # Get outstanding balance
        outstanding = await self._get_outstanding_balance(user.customer_id)
        
        # Get transaction history
        transactions = await self._get_transactions(
            user.customer_id, from_date, to_date
        )
        
        self._log_activity(
            portal_user_id,
            "view_statement",
            description=f"Viewed statement from {from_date} to {to_date}"
        )
        self.db.commit()
        
        return {
            "customer_id": user.customer_id,
            "customer_name": user.full_name or user.company_name,
            "from_date": from_date,
            "to_date": to_date,
            "opening_balance": 0,  # TODO: Calculate
            "closing_balance": outstanding,
            "transactions": transactions
        }
    
    async def _get_outstanding_balance(self, customer_id: str) -> Decimal:
        """Get customer's outstanding balance"""
        if not self.erpnext_adapter:
            return Decimal(0)
        
        try:
            result = self.erpnext_adapter.list_resource(
                tenant_id=self.tenant_id,
                doctype="Sales Invoice",
                fields=["sum(outstanding_amount) as total"],
                filters=[
                    ["customer", "=", customer_id],
                    ["docstatus", "=", 1]
                ],
                limit=1
            )
            
            data = result.get("data", [])
            if data:
                return Decimal(str(data[0].get("total", 0) or 0))
        except Exception as e:
            logger.error(f"Error getting outstanding balance: {e}")
        
        return Decimal(0)
    
    async def _get_transactions(
        self,
        customer_id: str,
        from_date: str,
        to_date: str
    ) -> List[Dict]:
        """Get customer transactions for statement"""
        # TODO: Implement via ERPNext GL entries
        return []
    
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
        """Log portal activity"""
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
    
    def _create_notification(
        self,
        portal_user_id: str,
        notification_type: str,
        title: str,
        message: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        action_url: Optional[str] = None
    ):
        """Create a notification for portal user"""
        notification = PortalNotification(
            portal_user_id=portal_user_id,
            tenant_id=self.tenant_id,
            notification_type=notification_type,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
            action_url=action_url
        )
        self.db.add(notification)
    
    def get_notifications(
        self,
        portal_user_id: str,
        unread_only: bool = False,
        limit: int = 20
    ) -> List[PortalNotification]:
        """Get notifications for portal user"""
        query = self.db.query(PortalNotification).filter(
            PortalNotification.portal_user_id == portal_user_id
        )
        
        if unread_only:
            query = query.filter(PortalNotification.is_read == False)
        
        return query.order_by(
            PortalNotification.created_at.desc()
        ).limit(limit).all()
    
    def mark_notification_read(
        self,
        portal_user_id: str,
        notification_id: str
    ) -> bool:
        """Mark a notification as read"""
        notification = self.db.query(PortalNotification).filter(
            PortalNotification.id == notification_id,
            PortalNotification.portal_user_id == portal_user_id
        ).first()
        
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            self.db.commit()
            return True
        
        return False
