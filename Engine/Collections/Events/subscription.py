from uuid import UUID
from datetime import date
from typing import Optional

from Engine.Collections.Events.base import DomainEvent


class SubscriptionActivatedEvent(DomainEvent):
    subscription_id: UUID
    entity_id: UUID
    start_date: date


class SubscriptionCancelledEvent(DomainEvent):
    subscription_id: UUID
    entity_id: UUID
    end_date: Optional[date]
