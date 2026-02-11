from sqlalchemy.orm import Session
from .models import WorkspaceCollections


def collections_enabled(db: Session, workspace_id: str) -> bool:
    return (
        db.query(WorkspaceCollections)
        .filter_by(workspace_id=workspace_id, enabled=True)
        .first()
        is not None
    )
