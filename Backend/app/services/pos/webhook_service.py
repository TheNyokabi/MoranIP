"""
Webhook Service for PoS
Manages webhook registration, delivery, and retry logic
"""
import asyncio
import json
import secrets
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict
import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class WebhookConfig(BaseModel):
    """Webhook configuration"""
    url: str = Field(..., description="Webhook URL")
    secret: str = Field(..., description="Webhook secret for signature verification")
    events: List[str] = Field(..., description="Events to subscribe to")
    enabled: bool = Field(True, description="Whether webhook is enabled")
    retry_policy: Dict[str, Any] = Field(
        default_factory=lambda: {
            "max_retries": 3,
            "retry_delay": 60,  # seconds
            "backoff_factor": 2
        },
        description="Retry policy configuration"
    )
    timeout: int = Field(30, description="Request timeout in seconds")


@dataclass
class WebhookDelivery:
    """Represents a webhook delivery attempt"""
    id: str
    webhook_id: str
    event_name: str
    payload: Dict[str, Any]
    attempt_number: int
    status: str  # 'pending', 'success', 'failed', 'retrying'
    response_code: Optional[int]
    response_body: Optional[str]
    error_message: Optional[str]
    delivered_at: Optional[datetime]
    next_retry_at: Optional[datetime]
    created_at: datetime
    signature: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        if self.delivered_at:
            data['delivered_at'] = self.delivered_at.isoformat()
        if self.next_retry_at:
            data['next_retry_at'] = self.next_retry_at.isoformat()
        data['created_at'] = self.created_at.isoformat()
        return data


class WebhookService:
    """Service for managing webhooks and event delivery"""

    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.webhooks: Dict[str, WebhookConfig] = {}
        self.delivery_queue: asyncio.Queue = asyncio.Queue()
        self.is_processing = False
        self.client = httpx.AsyncClient(timeout=30.0)
        self._processing_task = None

    async def register_webhook(
        self,
        tenant_id: str,
        name: str,
        config: WebhookConfig
    ) -> str:
        """
        Register a new webhook

        Args:
            tenant_id: Tenant identifier
            name: Webhook name
            config: Webhook configuration

        Returns:
            Webhook ID
        """
        webhook_id = f"{tenant_id}:{name}"

        # Validate configuration
        await self._validate_webhook_config(config)

        self.webhooks[webhook_id] = config

        # Persist to Redis if available
        if self.redis:
            await self.redis.set(
                f"webhook:{webhook_id}",
                json.dumps({
                    'config': config.dict(),
                    'registered_at': datetime.now().isoformat()
                })
            )

        logger.info(f"Registered webhook '{webhook_id}' for events: {config.events}")
        return webhook_id

    async def unregister_webhook(self, webhook_id: str) -> bool:
        """
        Unregister a webhook

        Args:
            webhook_id: Webhook identifier

        Returns:
            Success status
        """
        if webhook_id not in self.webhooks:
            return False

        del self.webhooks[webhook_id]

        # Remove from Redis
        if self.redis:
            await self.redis.delete(f"webhook:{webhook_id}")

        logger.info(f"Unregistered webhook '{webhook_id}'")
        return True

    async def trigger_webhook(
        self,
        event_name: str,
        payload: Dict[str, Any],
        tenant_id: str
    ) -> List[str]:
        """
        Trigger webhooks for an event

        Args:
            event_name: Name of the event
            payload: Event payload
            tenant_id: Tenant identifier

        Returns:
            List of triggered webhook IDs
        """
        triggered_webhooks = []

        for webhook_id, config in self.webhooks.items():
            # Check if webhook is for this tenant and event
            if not webhook_id.startswith(f"{tenant_id}:"):
                continue

            if not config.enabled or event_name not in config.events:
                continue

            # Create delivery attempt
            delivery = WebhookDelivery(
                id=f"{webhook_id}:{secrets.token_hex(8)}",
                webhook_id=webhook_id,
                event_name=event_name,
                payload=payload,
                attempt_number=1,
                status='pending',
                created_at=datetime.now(),
                signature=self._generate_signature(payload, config.secret)
            )

            # Add to delivery queue
            await self.delivery_queue.put(delivery)
            triggered_webhooks.append(webhook_id)

        if triggered_webhooks:
            logger.info(f"Triggered {len(triggered_webhooks)} webhooks for event '{event_name}'")

        return triggered_webhooks

    async def _start_processing(self):
        """Start the webhook delivery processing loop"""
        self.is_processing = True
        logger.info("Webhook delivery processing started")

        while self.is_processing:
            try:
                # Get next delivery from queue
                delivery = await self.delivery_queue.get()

                # Process the delivery
                await self._process_delivery(delivery)

                # Mark task as done
                self.delivery_queue.task_done()

            except Exception as e:
                logger.error(f"Error processing webhook delivery: {e}")

    async def _process_delivery(self, delivery: WebhookDelivery):
        """Process a webhook delivery"""
        logger.debug(f"Processing webhook delivery {delivery.id}")

        config = self.webhooks.get(delivery.webhook_id)
        if not config:
            logger.warning(f"Webhook config not found for {delivery.webhook_id}")
            return

        try:
            # Prepare payload
            webhook_payload = {
                'event': delivery.event_name,
                'timestamp': delivery.created_at.isoformat(),
                'attempt': delivery.attempt_number,
                'signature': delivery.signature,
                'data': delivery.payload
            }

            # Send webhook
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'MoranERP-Webhook/1.0',
                'X-Webhook-ID': delivery.webhook_id,
                'X-Event': delivery.event_name,
                'X-Signature': delivery.signature
            }

            response = await self.client.post(
                config.url,
                json=webhook_payload,
                headers=headers,
                timeout=config.timeout
            )

            delivery.response_code = response.status_code
            delivery.response_body = response.text
            delivery.delivered_at = datetime.now()

            if response.status_code >= 200 and response.status_code < 300:
                delivery.status = 'success'
                logger.info(f"Webhook delivery {delivery.id} successful (status: {response.status_code})")
            else:
                # Handle failure with retry logic
                await self._handle_delivery_failure(delivery, config, f"HTTP {response.status_code}: {response.text}")

        except httpx.TimeoutException:
            await self._handle_delivery_failure(delivery, config, "Request timeout")
        except httpx.RequestError as e:
            await self._handle_delivery_failure(delivery, config, f"Request error: {str(e)}")
        except Exception as e:
            await self._handle_delivery_failure(delivery, config, f"Unexpected error: {str(e)}")

        # Persist delivery status
        await self._persist_delivery(delivery)

    async def _handle_delivery_failure(
        self,
        delivery: WebhookDelivery,
        config: WebhookConfig,
        error_message: str
    ):
        """Handle webhook delivery failure"""
        delivery.error_message = error_message

        if delivery.attempt_number < config.retry_policy['max_retries']:
            # Schedule retry
            retry_delay = (
                config.retry_policy['retry_delay'] *
                (config.retry_policy['backoff_factor'] ** (delivery.attempt_number - 1))
            )

            delivery.status = 'retrying'
            delivery.next_retry_at = datetime.now() + timedelta(seconds=retry_delay)
            delivery.attempt_number += 1

            # Re-queue delivery
            await asyncio.sleep(retry_delay)
            await self.delivery_queue.put(delivery)

            logger.warning(f"Webhook delivery {delivery.id} failed, retrying in {retry_delay}s (attempt {delivery.attempt_number})")
        else:
            delivery.status = 'failed'
            logger.error(f"Webhook delivery {delivery.id} failed permanently after {delivery.attempt_number} attempts")

    async def _persist_delivery(self, delivery: WebhookDelivery):
        """Persist delivery status to Redis"""
        if not self.redis:
            return

        try:
            key = f"webhook_delivery:{delivery.id}"
            await self.redis.setex(
                key,
                86400 * 7,  # Keep for 7 days
                json.dumps(delivery.to_dict())
            )
        except Exception as e:
            logger.warning(f"Failed to persist delivery {delivery.id}: {e}")

    def _generate_signature(self, payload: Dict[str, Any], secret: str) -> str:
        """Generate webhook signature for verification"""
        import hmac
        import hashlib

        payload_str = json.dumps(payload, sort_keys=True)
        signature = hmac.new(
            secret.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()

        return f"sha256={signature}"

    async def _validate_webhook_config(self, config: WebhookConfig):
        """Validate webhook configuration"""
        if not config.url.startswith(('http://', 'https://')):
            raise ValueError("Webhook URL must start with http:// or https://")

        if not config.secret or len(config.secret) < 16:
            raise ValueError("Webhook secret must be at least 16 characters")

        if not config.events:
            raise ValueError("Webhook must subscribe to at least one event")

        # Test URL accessibility
        try:
            await self.client.head(config.url, timeout=5)
        except Exception:
            logger.warning(f"Webhook URL {config.url} is not accessible during registration")

    def get_registered_webhooks(self, tenant_id: str) -> Dict[str, WebhookConfig]:
        """Get all registered webhooks for a tenant"""
        return {
            webhook_id: config
            for webhook_id, config in self.webhooks.items()
            if webhook_id.startswith(f"{tenant_id}:")
        }

    async def get_delivery_history(
        self,
        webhook_id: str,
        limit: int = 50
    ) -> List[WebhookDelivery]:
        """Get delivery history for a webhook"""
        deliveries = []

        if self.redis:
            try:
                # Get all delivery keys for this webhook
                pattern = f"webhook_delivery:{webhook_id}:*"
                keys = await self.redis.keys(pattern)

                for key in keys[:limit]:
                    data = await self.redis.get(key)
                    if data:
                        delivery_data = json.loads(data)
                        # Convert ISO strings back to datetime
                        if delivery_data.get('delivered_at'):
                            delivery_data['delivered_at'] = datetime.fromisoformat(delivery_data['delivered_at'])
                        if delivery_data.get('next_retry_at'):
                            delivery_data['next_retry_at'] = datetime.fromisoformat(delivery_data['next_retry_at'])
                        delivery_data['created_at'] = datetime.fromisoformat(delivery_data['created_at'])

                        deliveries.append(WebhookDelivery(**delivery_data))

                # Sort by creation time (newest first)
                deliveries.sort(key=lambda d: d.created_at, reverse=True)

            except Exception as e:
                logger.warning(f"Failed to get delivery history for {webhook_id}: {e}")

        return deliveries

    async def test_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """
        Test a webhook by sending a test event

        Args:
            webhook_id: Webhook to test

        Returns:
            Test result
        """
        config = self.webhooks.get(webhook_id)
        if not config:
            return {
                'success': False,
                'error': 'Webhook not found'
            }

        test_payload = {
            'event': 'webhook_test',
            'timestamp': datetime.now().isoformat(),
            'test_data': {'message': 'This is a test webhook'}
        }

        # Trigger test delivery
        triggered = await self.trigger_webhook('webhook_test', test_payload, webhook_id.split(':')[0])

        if triggered:
            return {
                'success': True,
                'message': 'Test webhook queued for delivery',
                'webhook_id': webhook_id
            }
        else:
            return {
                'success': False,
                'error': 'Failed to queue test webhook'
            }

    async def get_webhook_stats(self, tenant_id: str) -> Dict[str, Any]:
        """Get webhook statistics for a tenant"""
        webhooks = self.get_registered_webhooks(tenant_id)

        stats = {
            'total_webhooks': len(webhooks),
            'enabled_webhooks': sum(1 for w in webhooks.values() if w.enabled),
            'events_subscribed': set(),
            'deliveries': {
                'total': 0,
                'successful': 0,
                'failed': 0,
                'pending': 0
            }
        }

        # Collect subscribed events
        for config in webhooks.values():
            stats['events_subscribed'].update(config.events)

        stats['events_subscribed'] = list(stats['events_subscribed'])

        # Get delivery stats from Redis
        if self.redis:
            try:
                pattern = f"webhook_delivery:{tenant_id}:*:*"
                keys = await self.redis.keys(pattern)

                for key in keys[:1000]:  # Limit to avoid performance issues
                    data = await self.redis.get(key)
                    if data:
                        delivery_data = json.loads(data)
                        stats['deliveries']['total'] += 1

                        status = delivery_data.get('status')
                        if status == 'success':
                            stats['deliveries']['successful'] += 1
                        elif status == 'failed':
                            stats['deliveries']['failed'] += 1
                        elif status in ['pending', 'retrying']:
                            stats['deliveries']['pending'] += 1

            except Exception as e:
                logger.warning(f"Failed to get webhook stats: {e}")

        return stats

    async def start_processing(self):
        """Start the webhook delivery processing loop"""
        if self._processing_task is None:
            self._processing_task = asyncio.create_task(self._start_processing())
            logger.info("Webhook delivery processing started")

    async def shutdown(self):
        """Shutdown the webhook service"""
        logger.info("Shutting down webhook service...")
        self.is_processing = False

        if self._processing_task:
            # Wait for delivery queue to be empty
            await self.delivery_queue.join()

            # Cancel the processing task
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        # Close HTTP client
        await self.client.aclose()

        logger.info("Webhook service shut down")


# Global webhook service instance
webhook_service = WebhookService()


async def get_webhook_service() -> WebhookService:
    """Get the global webhook service instance"""
    if not webhook_service.is_processing:
        await webhook_service.start_processing()
    return webhook_service


# Common POS events for webhooks
POS_EVENTS = [
    'invoice_created',
    'invoice_updated',
    'payment_processed',
    'customer_created',
    'customer_updated',
    'item_created',
    'item_updated',
    'loyalty_points_earned',
    'loyalty_points_redeemed',
    'layaway_created',
    'layaway_payment_made',
    'layaway_completed',
    'pos_session_started',
    'pos_session_ended',
    'stock_adjustment'
]