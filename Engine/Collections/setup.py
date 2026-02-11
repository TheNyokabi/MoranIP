from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from .schemas import CollectionsWorkspaceSetup
from .service import enable_collections
from .models import WorkspaceCollections

router = APIRouter(prefix="/setup",)

@router.post("")
def setup_collections(
    payload: CollectionsWorkspaceSetup,
    db: Session = Depends(get_db)
):
    record = enable_collections(db, payload)
    return {
        "message": "Collections enabled for workspace",
        "workspace_id": record.workspace_id
    }