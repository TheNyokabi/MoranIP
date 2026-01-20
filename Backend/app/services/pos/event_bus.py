"""
Event Bus for PoS
Manages event publishing, subscription, and asynchronous processing
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable, Awaitable
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

from app.services.pos.plugin_registry import PluginHook

logger = logging.getLogger(__name__)


class EventPriority(Enum):
    """Event priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class Event:
    """Represents an event in the system"""
    id: str
    name: str
    data: Dict[str, Any]
    timestamp: datetime
    source: str
    tenant_id: Optional[str] = None
    priority: EventPriority = EventPriority.NORMAL
    correlation_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.timestamp:
            self.timestamp = datetime.now()
        if not self.correlation_id:
            self.correlation_id = self.id

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary for serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        data['priority'] = self.priority.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Event':
        """Create event from dictionary"""
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        data['priority'] = EventPriority(data['priority'])
        return cls(**data)


@dataclass
class EventHandler:
    """Represents an event handler"""
    id: str
    name: str
    handler: Callable[[Event], Awaitable[None]]
    filter_criteria: Optional[Dict[str, Any]] = None
    priority: int = 1
    enabled: bool = True

    def matches_event(self, event: Event) -> bool:
        """Check if handler should process this event"""
        if not self.enabled:
            return False

        if not self.filter_criteria:
            return True

        # Check filter criteria
        for key, value in self.filter_criteria.items():
            if key == 'event_name' and event.name != value:
                return False
            elif key == 'tenant_id' and event.tenant_id != value:
                return False
            elif key == 'source' and event.source != value:
                return False
            elif key == 'priority' and event.priority.value < value:
                return False
            elif hasattr(event, key) and getattr(event, key) != value:
                return False

        return True


class EventBus:
    """Central event bus for the POS system"""

    def __init__(self, redis_client=None, enable_persistence: bool = True):
        self.handlers: Dict[str, List[EventHandler]] = {}
        self.hooks: Dict[str, PluginHook] = {}
        self.redis = redis_client
        self.enable_persistence = enable_persistence
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        self.is_processing = False
        self._processing_task = None

        # Initialize standard hooks
        self._init_standard_hooks()

    def _init_standard_hooks(self):
        """Initialize standard event hooks"""
        standard_hooks = [
            'before_invoice_create',
            'after_invoice_create',
            'before_payment_process',
            'after_payment_process',
            'before_receipt_generate',
            'after_receipt_generate',
            'customer_created',
            'customer_updated',
            'item_created',
            'item_updated',
            'pos_session_started',
            'pos_session_ended',
            'loyalty_points_earned',
            'loyalty_points_redeemed',
            'layaway_created',
            'layaway_payment_made',
            'layaway_completed'
        ]

        for hook_name in standard_hooks:
            self.hooks[hook_name] = PluginHook(hook_name)

    async def subscribe(
        self,
        event_name: str,
        handler: Callable[[Event], Awaitable[None]],
        name: Optional[str] = None,
        filter_criteria: Optional[Dict[str, Any]] = None,
        priority: int = 1
    ) -> str:
        """
        Subscribe to an event

        Args:
            event_name: Name of event to subscribe to
            handler: Async function to handle the event
            name: Optional name for the handler
            filter_criteria: Optional criteria to filter events
            priority: Handler priority (higher numbers = higher priority)

        Returns:
            Handler ID
        """
        handler_id = str(uuid.uuid4())
        handler_name = name or f"handler_{handler_id}"

        event_handler = EventHandler(
            id=handler_id,
            name=handler_name,
            handler=handler,
            filter_criteria=filter_criteria,
            priority=priority
        )

        if event_name not in self.handlers:
            self.handlers[event_name] = []

        self.handlers[event_name].append(event_handler)

        # Sort handlers by priority (highest first)
        self.handlers[event_name].sort(key=lambda h: h.priority, reverse=True)

        logger.info(f"Subscribed handler '{handler_name}' to event '{event_name}'")
        return handler_id

    async def unsubscribe(self, event_name: str, handler_id: str) -> bool:
        """
        Unsubscribe from an event

        Args:
            event_name: Name of event
            handler_id: Handler ID to remove

        Returns:
            Success status
        """
        if event_name not in self.handlers:
            return False

        original_length = len(self.handlers[event_name])
        self.handlers[event_name] = [
            h for h in self.handlers[event_name] if h.id != handler_id
        ]

        if len(self.handlers[event_name]) < original_length:
            logger.info(f"Unsubscribed handler {handler_id} from event '{event_name}'")
            return True

        return False

    async def publish(
        self,
        event_name: str,
        data: Dict[str, Any],
        source: str = "system",
        tenant_id: Optional[str] = None,
        priority: EventPriority = EventPriority.NORMAL,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Publish an event

        Args:
            event_name: Name of the event
            data: Event data payload
            source: Source of the event
            tenant_id: Optional tenant identifier
            priority: Event priority
            correlation_id: Optional correlation ID
            metadata: Optional metadata

        Returns:
            Event ID
        """
        event = Event(
            id="",
            name=event_name,
            data=data,
            source=source,
            tenant_id=tenant_id,
            priority=priority,
            correlation_id=correlation_id,
            metadata=metadata
        )

        # Add to processing queue
        await self.processing_queue.put(event)

        # Persist event if enabled
        if self.enable_persistence and self.redis:
            await self._persist_event(event)

        logger.debug(f"Published event '{event_name}' with ID {event.id}")
        return event.id

    async def _start_processing(self):
        """Start the event processing loop"""
        self.is_processing = True
        logger.info("Event bus processing started")

        while self.is_processing:
            try:
                # Get next event from queue
                event = await self.processing_queue.get()

                # Process the event
                await self._process_event(event)

                # Mark task as done
                self.processing_queue.task_done()

            except Exception as e:
                logger.error(f"Error processing event: {e}")

    async def _process_event(self, event: Event):
        """Process a single event"""
        logger.debug(f"Processing event '{event.name}' ({event.id})")

        if event.name not in self.handlers:
            logger.debug(f"No handlers registered for event '{event.name}'")
            return

        # Get matching handlers
        matching_handlers = [
            handler for handler in self.handlers[event.name]
            if handler.matches_event(event)
        ]

        if not matching_handlers:
            logger.debug(f"No matching handlers for event '{event.name}'")
            return

        # Execute handlers concurrently
        tasks = []
        for handler in matching_handlers:
            task = asyncio.create_task(self._execute_handler(handler, event))
            tasks.append(task)

        # Wait for all handlers to complete
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.debug(f"Event '{event.name}' processed by {len(matching_handlers)} handlers")

    async def _execute_handler(self, handler: EventHandler, event: Event):
        """Execute a single event handler"""
        try:
            logger.debug(f"Executing handler '{handler.name}' for event '{event.name}'")
            await handler.handler(event)
        except Exception as e:
            logger.error(f"Handler '{handler.name}' failed for event '{event.name}': {e}")

    async def _persist_event(self, event: Event):
        """Persist event to Redis for durability"""
        if not self.redis:
            return

        try:
            key = f"events:{event.tenant_id or 'global'}:{event.id}"
            await self.redis.setex(key, 86400, json.dumps(event.to_dict()))  # 24 hour TTL

            # Also add to event stream for the tenant
            stream_key = f"event_stream:{event.tenant_id or 'global'}"
            await self.redis.xadd(stream_key, {
                'event_id': event.id,
                'event_name': event.name,
                'timestamp': event.timestamp.isoformat(),
                'data': json.dumps(event.data)
            }, maxlen=1000)  # Keep last 1000 events

        except Exception as e:
            logger.warning(f"Failed to persist event {event.id}: {e}")

    def get_registered_events(self) -> Dict[str, int]:
        """Get list of registered events with handler counts"""
        return {
            event_name: len(handlers)
            for event_name, handlers in self.handlers.items()
        }

    async def get_recent_events(
        self,
        tenant_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Event]:
        """Get recent events from the stream"""
        if not self.redis:
            return []

        try:
            stream_key = f"event_stream:{tenant_id or 'global'}"
            messages = await self.redis.xrevrange(stream_key, count=limit)

            events = []
            for message_id, data in messages:
                try:
                    event_data = {
                        'id': data['event_id'],
                        'name': data['event_name'],
                        'data': json.loads(data['data']),
                        'timestamp': datetime.fromisoformat(data['timestamp']),
                        'source': 'replayed',
                        'tenant_id': tenant_id
                    }
                    event = Event(**event_data)
                    events.append(event)
                except Exception as e:
                    logger.warning(f"Failed to parse event from stream: {e}")

            return events

        except Exception as e:
            logger.error(f"Failed to get recent events: {e}")
            return []

    async def replay_events(
        self,
        tenant_id: Optional[str] = None,
        from_timestamp: Optional[datetime] = None,
        event_names: Optional[List[str]] = None
    ) -> int:
        """
        Replay events from the stream

        Args:
            tenant_id: Optional tenant to replay for
            from_timestamp: Optional start timestamp
            event_names: Optional list of event names to replay

        Returns:
            Number of events replayed
        """
        events = await self.get_recent_events(tenant_id, 1000)
        replayed_count = 0

        for event in events:
            if from_timestamp and event.timestamp < from_timestamp:
                continue

            if event_names and event.name not in event_names:
                continue

            # Re-publish the event
            await self.processing_queue.put(event)
            replayed_count += 1

        logger.info(f"Replayed {replayed_count} events")
        return replayed_count

    async def start_processing(self):
        """Start the event processing loop"""
        if self._processing_task is None:
            self._processing_task = asyncio.create_task(self._start_processing())
            logger.info("Event bus processing started")

    async def shutdown(self):
        """Shutdown the event bus"""
        logger.info("Shutting down event bus...")
        self.is_processing = False

        if self._processing_task:
            # Wait for processing queue to be empty
            await self.processing_queue.join()

            # Cancel the processing task
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        logger.info("Event bus shut down")


# Global event bus instance
event_bus = EventBus()


async def get_event_bus() -> EventBus:
    """Get the global event bus instance"""
    if not event_bus.is_processing:
        await event_bus.start_processing()
    return event_bus


# Convenience functions for common POS events
async def publish_invoice_created(invoice_data: Dict[str, Any], tenant_id: str):
    """Publish invoice created event"""
    await event_bus.publish(
        'invoice_created',
        invoice_data,
        source='pos',
        tenant_id=tenant_id,
        priority=EventPriority.HIGH
    )

async def publish_payment_processed(payment_data: Dict[str, Any], tenant_id: str):
    """Publish payment processed event"""
    await event_bus.publish(
        'payment_processed',
        payment_data,
        source='pos',
        tenant_id=tenant_id,
        priority=EventPriority.HIGH
    )

async def publish_customer_created(customer_data: Dict[str, Any], tenant_id: str):
    """Publish customer created event"""
    await event_bus.publish(
        'customer_created',
        customer_data,
        source='pos',
        tenant_id=tenant_id,
        priority=EventPriority.NORMAL
    )

async def publish_loyalty_points_earned(customer_id: str, points: int, tenant_id: str):
    """Publish loyalty points earned event"""
    await event_bus.publish(
        'loyalty_points_earned',
        {'customer_id': customer_id, 'points': points},
        source='loyalty',
        tenant_id=tenant_id,
        priority=EventPriority.NORMAL
    )