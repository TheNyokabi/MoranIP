from sqlalchemy.orm import Session
from .models import WorkspaceCollections


def enable_collections(db: Session, payload):
    record = WorkspaceCollections(
        workspace_id=payload.workspace_id,
        country=payload.country,
        currency=payload.currency,
        fiscal_year_start_month=payload.fiscal_year_start_month,
        allow_partial_payments=payload.allow_partial_payments,
        enabled=True
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def collections_enabled(db: Session, workspace_id: str) -> bool:
    return (
        db.query(WorkspaceCollections)
        .filter_by(workspace_id=workspace_id, enabled=True)
        .first()
        is not None
    )
    
