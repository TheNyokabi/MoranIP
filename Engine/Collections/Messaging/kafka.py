import json
import logging
from typing import Any
from kafka import KafkaProducer
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class EventProducer:
    def __init__(self, broker_url: str):
        self.producer = KafkaProducer(
            bootstrap_servers=broker_url,
            value_serializer=self._serialize,
            key_serializer=lambda k: k.encode("utf-8"),
            acks="all",
            retries=5,
            linger_ms=5,
        )

    @staticmethod
    def _serialize(value: Any) -> bytes:
        if isinstance(value, BaseModel):
            return value.model_dump_json().encode("utf-8")
        return json.dumps(value).encode("utf-8")

    def publish(
        self,
        topic: str,
        key: str,
        event: BaseModel,
    ) -> None:
        logger.info(
            "Publishing event",
            extra={
                "topic": topic,
                "key": key,
                "event_type": event.event_type,
            },
        )

        self.producer.send(
            topic=topic,
            key=key,
            value=event,
        )

    def flush(self) -> None:
        self.producer.flush()
