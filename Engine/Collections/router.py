from fastapi import APIRouter, Depends
from .health import router as health_router
from .setup import router as setup_router
from sqlalchemy.orm import Session

from app.database import get_db
from .schemas import CollectionsWorkspaceSetup
from .service import enable_collections
from .config_router import router as config_router
from schemas.invoice import (
    GenerateInvoiceIn,
    InvoiceOut
)
from service import generate_invoice
from models.invoice import Invoice
from deps import get_db


router = APIRouter(
    prefix="/api/v1/collections",
    tags=["Collections"]
)

router.include_router(health_router)
router.include_router(setup_router)
router.include_router(config_router)