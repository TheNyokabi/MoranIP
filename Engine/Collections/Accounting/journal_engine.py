from datetime import datetime
from sqlalchemy.orm import Session

from Engine.Collections.Accounting.models import JournalEntry
from Engine.Collections.Accounting.rules import RULES_REGISTRY


class JournalEngine:
    def __init__(self, db: Session):
        self.db = db

    def process_event(self, event):
        rule = RULES_REGISTRY.get(event.event_type)
        if not rule:
            return

        lines = rule(event)

        entry = JournalEntry(
            workspace_id=event.workspace_id,
            event_type=event.event_type,
            reference_id=getattr(event, "invoice_id", None),
            posting_date=datetime.utcnow(),
            lines=lines,
        )

        self.db.add(entry)
        self.db.commit()
