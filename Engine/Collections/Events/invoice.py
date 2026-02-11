from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Literal


class DomainEvent(BaseModel):
    event_id: UUID
    event_type: str
    occurred_at: datetime
    aggregate_id: UUID
    aggregate_type: Literal[
        "invoice",
        "subscription",
        "entity"
    ]
    version: int = 1
