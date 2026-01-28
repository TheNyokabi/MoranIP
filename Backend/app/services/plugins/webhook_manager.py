"""
Webhook Management System

Provides:
- Webhook registration and management
- Event dispatching to registered webhooks
- Retry logic and failure handling
- Webhook signature verification
- Rate limiting
"""

import hashlib
import hmac
import logging
import json
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from uuid import uuid4

import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class WebhookEvent(str, Enum):
    """Available webhook events"""
    # Orders
    ORDER_CREATED = "order.created"
    ORDER_UPDATED = "order.updated"
    ORDER_SUBMITTED = "order.submitted"
    ORDER_CANCELLED = "order.cancelled"
    
    # Invoices
    INVOICE_CREATED = "invoice.created"
    INVOICE_SUBMITTED = "invoice.submitted"
    INVOICE_PAID = "invoice.paid"
    INVOICE_CANCELLED = "invoice.cancelled"
    
    # Payments
    PAYMENT_RECEIVED = "payment.received"
    PAYMENT_FAILED = "payment.failed"
    REFUND_PROCESSED = "refund.processed"
    
    # Inventory
    STOCK_UPDATED = "stock.updated"
    STOCK_LOW = "stock.low"
    STOCK_OUT = "stock.out"
    STOCK_RECEIVED = "stock.received"
    
    # Customers
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    
    # Users
    USER_CREATED = "user.created"
    USER_LOGIN = "user.login"
    
    # Products
    ITEM_CREATED = "item.created"
    ITEM_UPDATED = "item.updated"
    PRICE_CHANGED = "price.changed"
    
    # POS
    POS_SESSION_OPENED = "pos.session.opened"
    POS_SESSION_CLOSED = "pos.session.closed"
    POS_SALE_COMPLETED = "pos.sale.completed"
    
    # System
    SYSTEM_ALERT = "system.alert"
    REPORT_GENERATED = "report.generated"


class WebhookStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    SUSPENDED = "suspended"


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class WebhookConfig:
    """Webhook configuration"""
    id: str
    tenant_id: str
    name: str
    url: str
    secret: str
    events: List[WebhookEvent]
    
    # Status
    status: WebhookStatus = WebhookStatus.ACTIVE
    
    # Headers
    custom_headers: Dict[str, str] = field(default_factory=dict)
    
    # Retry settings
    max_retries: int = 3
    retry_interval_seconds: int = 60
    timeout_seconds: int = 30
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: str = ""
    last_triggered: Optional[datetime] = None
    consecutive_failures: int = 0
    
    # Rate limiting
    rate_limit_per_minute: int = 60


@dataclass
class WebhookDelivery:
    """Record of a webhook delivery attempt"""
    id: str
    webhook_id: str
    tenant_id: str
    event: WebhookEvent
    payload: Dict[str, Any]
    
    # Status
    status: DeliveryStatus = DeliveryStatus.PENDING
    
    # Response
    response_status_code: Optional[int] = None
    response_body: Optional[str] = None
    response_time_ms: Optional[int] = None
    
    # Retry info
    attempt_number: int = 1
    next_retry_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None


class WebhookPayload(BaseModel):
    """Standard webhook payload format"""
    id: str
    event: str
    created_at: str
    tenant_id: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class WebhookManager:
    """
    Manages webhooks and event dispatching.
    
    In production, this would store data in database
    and use a queue for reliable delivery.
    """
    
    def __init__(self):
        # In-memory storage (replace with DB in production)
        self._webhooks: Dict[str, WebhookConfig] = {}
        self._deliveries: Dict[str, WebhookDelivery] = {}
        self._tenant_webhooks: Dict[str, List[str]] = {}  # tenant_id -> webhook_ids
        
        # HTTP client
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
    
    # ==================== Webhook Management ====================
    
    def register_webhook(
        self,
        tenant_id: str,
        name: str,
        url: str,
        events: List[WebhookEvent],
        secret: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        created_by: str = ""
    ) -> WebhookConfig:
        """Register a new webhook"""
        webhook_id = str(uuid4())
        
        # Generate secret if not provided
        if secret is None:
            secret = hashlib.sha256(str(uuid4()).encode()).hexdigest()
        
        webhook = WebhookConfig(
            id=webhook_id,
            tenant_id=tenant_id,
            name=name,
            url=url,
            secret=secret,
            events=events,
            custom_headers=custom_headers or {},
            created_by=created_by
        )
        
        self._webhooks[webhook_id] = webhook
        
        if tenant_id not in self._tenant_webhooks:
            self._tenant_webhooks[tenant_id] = []
        self._tenant_webhooks[tenant_id].append(webhook_id)
        
        logger.info(f"Webhook registered: {name} for tenant {tenant_id}")
        return webhook
    
    def update_webhook(
        self,
        webhook_id: str,
        name: Optional[str] = None,
        url: Optional[str] = None,
        events: Optional[List[WebhookEvent]] = None,
        status: Optional[WebhookStatus] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> Optional[WebhookConfig]:
        """Update webhook configuration"""
        webhook = self._webhooks.get(webhook_id)
        if not webhook:
            return None
        
        if name is not None:
            webhook.name = name
        if url is not None:
            webhook.url = url
        if events is not None:
            webhook.events = events
        if status is not None:
            webhook.status = status
        if custom_headers is not None:
            webhook.custom_headers = custom_headers
        
        return webhook
    
    def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook"""
        webhook = self._webhooks.get(webhook_id)
        if not webhook:
            return False
        
        # Remove from tenant list
        if webhook.tenant_id in self._tenant_webhooks:
            self._tenant_webhooks[webhook.tenant_id] = [
                wid for wid in self._tenant_webhooks[webhook.tenant_id]
                if wid != webhook_id
            ]
        
        del self._webhooks[webhook_id]
        logger.info(f"Webhook deleted: {webhook_id}")
        return True
    
    def get_webhook(self, webhook_id: str) -> Optional[WebhookConfig]:
        """Get webhook by ID"""
        return self._webhooks.get(webhook_id)
    
    def get_tenant_webhooks(self, tenant_id: str) -> List[WebhookConfig]:
        """Get all webhooks for a tenant"""
        webhook_ids = self._tenant_webhooks.get(tenant_id, [])
        return [self._webhooks[wid] for wid in webhook_ids if wid in self._webhooks]
    
    def get_webhooks_for_event(
        self,
        tenant_id: str,
        event: WebhookEvent
    ) -> List[WebhookConfig]:
        """Get webhooks subscribed to an event"""
        webhooks = self.get_tenant_webhooks(tenant_id)
        return [
            w for w in webhooks
            if w.status == WebhookStatus.ACTIVE and event in w.events
        ]
    
    # ==================== Event Dispatching ====================
    
    async def dispatch_event(
        self,
        tenant_id: str,
        event: WebhookEvent,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[WebhookDelivery]:
        """Dispatch an event to all subscribed webhooks"""
        webhooks = self.get_webhooks_for_event(tenant_id, event)
        
        if not webhooks:
            return []
        
        deliveries = []
        for webhook in webhooks:
            delivery = await self._send_webhook(webhook, event, data, metadata)
            deliveries.append(delivery)
        
        return deliveries
    
    async def _send_webhook(
        self,
        webhook: WebhookConfig,
        event: WebhookEvent,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> WebhookDelivery:
        """Send a webhook request"""
        delivery_id = str(uuid4())
        
        # Create payload
        payload = WebhookPayload(
            id=delivery_id,
            event=event.value,
            created_at=datetime.utcnow().isoformat(),
            tenant_id=webhook.tenant_id,
            data=data,
            metadata=metadata
        )
        
        payload_json = payload.model_dump_json()
        
        # Create delivery record
        delivery = WebhookDelivery(
            id=delivery_id,
            webhook_id=webhook.id,
            tenant_id=webhook.tenant_id,
            event=event,
            payload=payload.model_dump()
        )
        
        # Generate signature
        signature = self._generate_signature(webhook.secret, payload_json)
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-ID": webhook.id,
            "X-Webhook-Event": event.value,
            "X-Webhook-Signature": signature,
            "X-Webhook-Timestamp": str(int(datetime.utcnow().timestamp())),
            **webhook.custom_headers
        }
        
        # Send request
        start_time = datetime.utcnow()
        
        try:
            response = await self.client.post(
                webhook.url,
                content=payload_json,
                headers=headers,
                timeout=webhook.timeout_seconds
            )
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            delivery.response_status_code = response.status_code
            delivery.response_body = response.text[:1000]  # Limit stored response
            delivery.response_time_ms = int(response_time)
            delivery.delivered_at = datetime.utcnow()
            
            if 200 <= response.status_code < 300:
                delivery.status = DeliveryStatus.DELIVERED
                webhook.consecutive_failures = 0
                logger.info(f"Webhook delivered: {webhook.name} -> {event.value}")
            else:
                delivery.status = DeliveryStatus.FAILED
                delivery.error_message = f"HTTP {response.status_code}"
                self._handle_failure(webhook, delivery)
        
        except httpx.TimeoutException:
            delivery.status = DeliveryStatus.FAILED
            delivery.error_message = "Request timeout"
            self._handle_failure(webhook, delivery)
            logger.error(f"Webhook timeout: {webhook.name}")
        
        except Exception as e:
            delivery.status = DeliveryStatus.FAILED
            delivery.error_message = str(e)
            self._handle_failure(webhook, delivery)
            logger.error(f"Webhook error: {webhook.name} - {e}")
        
        # Update webhook last triggered
        webhook.last_triggered = datetime.utcnow()
        
        # Store delivery
        self._deliveries[delivery_id] = delivery
        
        return delivery
    
    def _handle_failure(self, webhook: WebhookConfig, delivery: WebhookDelivery):
        """Handle webhook delivery failure"""
        webhook.consecutive_failures += 1
        
        # Check if should retry
        if delivery.attempt_number < webhook.max_retries:
            delivery.status = DeliveryStatus.RETRYING
            delivery.next_retry_at = datetime.utcnow() + timedelta(
                seconds=webhook.retry_interval_seconds * delivery.attempt_number
            )
        
        # Suspend webhook after too many failures
        if webhook.consecutive_failures >= 10:
            webhook.status = WebhookStatus.SUSPENDED
            logger.warning(f"Webhook suspended due to failures: {webhook.name}")
    
    async def retry_delivery(self, delivery_id: str) -> Optional[WebhookDelivery]:
        """Retry a failed delivery"""
        delivery = self._deliveries.get(delivery_id)
        if not delivery:
            return None
        
        if delivery.status not in [DeliveryStatus.FAILED, DeliveryStatus.RETRYING]:
            return delivery
        
        webhook = self._webhooks.get(delivery.webhook_id)
        if not webhook or webhook.status != WebhookStatus.ACTIVE:
            return None
        
        # Increment attempt
        delivery.attempt_number += 1
        
        # Re-send
        return await self._send_webhook(
            webhook,
            delivery.event,
            delivery.payload["data"],
            delivery.payload.get("metadata")
        )
    
    # ==================== Signature Verification ====================
    
    def _generate_signature(self, secret: str, payload: str) -> str:
        """Generate HMAC signature for payload"""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    def verify_signature(
        self,
        webhook_id: str,
        payload: str,
        signature: str
    ) -> bool:
        """Verify a webhook signature"""
        webhook = self._webhooks.get(webhook_id)
        if not webhook:
            return False
        
        expected = self._generate_signature(webhook.secret, payload)
        return hmac.compare_digest(expected, signature)
    
    # ==================== Delivery History ====================
    
    def get_delivery_history(
        self,
        webhook_id: str,
        limit: int = 50
    ) -> List[WebhookDelivery]:
        """Get delivery history for a webhook"""
        deliveries = [
            d for d in self._deliveries.values()
            if d.webhook_id == webhook_id
        ]
        deliveries.sort(key=lambda x: x.created_at, reverse=True)
        return deliveries[:limit]
    
    def get_pending_retries(self) -> List[WebhookDelivery]:
        """Get deliveries pending retry"""
        now = datetime.utcnow()
        return [
            d for d in self._deliveries.values()
            if d.status == DeliveryStatus.RETRYING
            and d.next_retry_at
            and d.next_retry_at <= now
        ]
    
    def get_delivery_stats(
        self,
        tenant_id: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get delivery statistics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        deliveries = [
            d for d in self._deliveries.values()
            if d.tenant_id == tenant_id and d.created_at >= cutoff
        ]
        
        total = len(deliveries)
        delivered = sum(1 for d in deliveries if d.status == DeliveryStatus.DELIVERED)
        failed = sum(1 for d in deliveries if d.status == DeliveryStatus.FAILED)
        
        avg_response_time = 0
        response_times = [d.response_time_ms for d in deliveries if d.response_time_ms]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
        
        return {
            "total_deliveries": total,
            "successful": delivered,
            "failed": failed,
            "success_rate": (delivered / total * 100) if total > 0 else 0,
            "avg_response_time_ms": round(avg_response_time, 2),
            "period_days": days
        }


# Global webhook manager instance
webhook_manager = WebhookManager()
