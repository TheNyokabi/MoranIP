"""
Enterprise Features API Router

Endpoints for:
- White-label branding
- Franchise management
- Business Intelligence connectors
- Data exports
"""

import logging
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.enterprise import (
    BrandingService, FranchiseService, BIConnectorService
)
from ..models.enterprise import (
    TenantBranding, FranchiseGroup, FranchiseLocation,
    BIConnector, DataExport
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enterprise", tags=["Enterprise"])


# ==================== Pydantic Models ====================

class BrandingUpdateRequest(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    logo_url: Optional[str] = None
    logo_dark_url: Optional[str] = None
    favicon_url: Optional[str] = None
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    support_email: Optional[str] = None
    support_phone: Optional[str] = None
    website_url: Optional[str] = None
    email_footer_text: Optional[str] = None
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    font_family: Optional[str] = None
    border_radius: Optional[str] = None
    show_powered_by: Optional[bool] = None
    custom_css: Optional[str] = None


class SetCustomDomainRequest(BaseModel):
    domain: str
    ssl_certificate: Optional[str] = None
    ssl_private_key: Optional[str] = None


class CreateFranchiseGroupRequest(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    billing_type: str = "royalty"
    royalty_percentage: float = 0
    flat_fee_amount: float = 0
    settings: Optional[Dict] = None


class AddLocationRequest(BaseModel):
    tenant_id: str
    name: str
    code: str
    address: Optional[Dict] = None
    contact: Optional[Dict] = None
    operating_hours: Optional[Dict] = None


class CreateConnectorRequest(BaseModel):
    name: str
    connector_type: str
    connection_settings: Dict[str, Any]
    enabled_data_sources: List[str]
    sync_frequency: str = "hourly"


class CreateExportRequest(BaseModel):
    name: str
    data_source: str
    destination_type: str
    destination_config: Dict[str, Any]
    export_format: str = "json"
    filters: Optional[Dict] = None
    columns: Optional[List[str]] = None
    schedule: Optional[str] = None
    connector_id: Optional[str] = None


class ExtractDataRequest(BaseModel):
    data_source: str
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    filters: Optional[Dict] = None
    columns: Optional[List[str]] = None
    limit: int = 1000


# ==================== Branding Endpoints ====================

@router.get("/branding")
async def get_branding(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get tenant branding settings"""
    service = BrandingService(db, tenant_id)
    branding = service.get_branding()
    
    return {
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
        "accent_color": branding.accent_color,
        "background_color": branding.background_color,
        "text_color": branding.text_color,
        "logo_url": branding.logo_url,
        "logo_dark_url": branding.logo_dark_url,
        "favicon_url": branding.favicon_url,
        "company_name": branding.company_name,
        "tagline": branding.tagline,
        "support_email": branding.support_email,
        "support_phone": branding.support_phone,
        "website_url": branding.website_url,
        "font_family": branding.font_family,
        "border_radius": branding.border_radius,
        "show_powered_by": branding.show_powered_by,
        "custom_domain": branding.custom_domain,
        "custom_domain_verified": branding.custom_domain_verified
    }


@router.patch("/branding")
async def update_branding(
    request: BrandingUpdateRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Update tenant branding"""
    service = BrandingService(db, tenant_id)
    updates = request.model_dump(exclude_unset=True)
    branding = service.update_branding(updates)
    
    return {"message": "Branding updated successfully"}


@router.post("/branding/custom-domain")
async def set_custom_domain(
    request: SetCustomDomainRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Set custom domain for tenant"""
    service = BrandingService(db, tenant_id)
    success = service.set_custom_domain(
        domain=request.domain,
        ssl_certificate=request.ssl_certificate,
        ssl_private_key=request.ssl_private_key
    )
    
    return {
        "success": success,
        "domain": request.domain,
        "verified": False,
        "message": "Domain set. Please verify DNS configuration."
    }


@router.post("/branding/custom-domain/verify")
async def verify_custom_domain(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Verify custom domain DNS configuration"""
    service = BrandingService(db, tenant_id)
    verified = service.verify_custom_domain()
    
    return {
        "verified": verified,
        "message": "Domain verified successfully" if verified else "DNS verification failed"
    }


@router.get("/branding/css")
async def get_branding_css(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get generated CSS variables for branding"""
    from fastapi.responses import PlainTextResponse
    
    service = BrandingService(db, tenant_id)
    css = service.generate_css_variables()
    
    return PlainTextResponse(content=css, media_type="text/css")


@router.get("/branding/public")
async def get_public_branding(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get public branding info (safe for frontend)"""
    service = BrandingService(db, tenant_id)
    return service.get_public_branding()


# ==================== Franchise Endpoints ====================

@router.post("/franchise/groups")
async def create_franchise_group(
    request: CreateFranchiseGroupRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Create a franchise group"""
    from decimal import Decimal
    
    service = FranchiseService(db, tenant_id)
    group = service.create_franchise_group(
        name=request.name,
        code=request.code,
        description=request.description,
        billing_type=request.billing_type,
        royalty_percentage=Decimal(str(request.royalty_percentage)),
        flat_fee_amount=Decimal(str(request.flat_fee_amount)),
        settings=request.settings
    )
    
    return {
        "id": str(group.id),
        "name": group.name,
        "code": group.code,
        "message": "Franchise group created"
    }


@router.get("/franchise/groups")
async def list_franchise_groups(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List all franchise groups"""
    service = FranchiseService(db, tenant_id)
    groups = service.get_franchise_groups()
    
    return {
        "groups": [
            {
                "id": str(g.id),
                "name": g.name,
                "code": g.code,
                "description": g.description,
                "billing_type": g.billing_type,
                "is_active": g.is_active,
                "locations_count": len(g.locations) if g.locations else 0
            }
            for g in groups
        ]
    }


@router.get("/franchise/groups/{group_id}")
async def get_franchise_group(
    group_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get franchise group details"""
    service = FranchiseService(db, tenant_id)
    group = service.get_franchise_group(group_id)
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {
        "id": str(group.id),
        "name": group.name,
        "code": group.code,
        "description": group.description,
        "billing_type": group.billing_type,
        "royalty_percentage": float(group.royalty_percentage) if group.royalty_percentage else 0,
        "flat_fee_amount": float(group.flat_fee_amount) if group.flat_fee_amount else 0,
        "settings": group.settings,
        "is_active": group.is_active,
        "locations_count": len(group.locations) if group.locations else 0
    }


@router.post("/franchise/groups/{group_id}/locations")
async def add_franchise_location(
    group_id: str,
    request: AddLocationRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Add a location to franchise group"""
    service = FranchiseService(db, tenant_id)
    location = service.add_location(
        group_id=group_id,
        tenant_id=request.tenant_id,
        name=request.name,
        code=request.code,
        address=request.address,
        contact=request.contact,
        operating_hours=request.operating_hours
    )
    
    if not location:
        raise HTTPException(status_code=400, detail="Failed to add location")
    
    return {
        "id": str(location.id),
        "name": location.name,
        "code": location.code,
        "message": "Location added"
    }


@router.get("/franchise/locations")
async def list_franchise_locations(
    group_id: Optional[str] = None,
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List franchise locations"""
    service = FranchiseService(db, tenant_id)
    locations = service.get_locations(group_id=group_id, status=status)
    
    return {
        "locations": [
            {
                "id": str(loc.id),
                "group_id": str(loc.group_id),
                "name": loc.name,
                "code": loc.code,
                "city": loc.city,
                "country": loc.country,
                "phone": loc.phone,
                "email": loc.email,
                "manager_name": loc.manager_name,
                "status": loc.status,
                "performance_score": float(loc.performance_score) if loc.performance_score else 0
            }
            for loc in locations
        ]
    }


@router.get("/franchise/locations/{location_id}/performance")
async def get_location_performance(
    location_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get location performance metrics"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = FranchiseService(db, tenant_id, get_erpnext_adapter())
    performance = await service.get_location_performance(
        location_id, from_date, to_date
    )
    
    return performance


@router.get("/franchise/groups/{group_id}/performance")
async def get_group_performance(
    group_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get franchise group performance"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = FranchiseService(db, tenant_id, get_erpnext_adapter())
    performance = await service.get_group_performance(
        group_id, from_date, to_date
    )
    
    return performance


@router.get("/franchise/groups/{group_id}/royalties")
async def calculate_royalties(
    group_id: str,
    from_date: datetime,
    to_date: datetime,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Calculate royalties for franchise group"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = FranchiseService(db, tenant_id, get_erpnext_adapter())
    royalties = await service.calculate_royalties(
        group_id, from_date, to_date
    )
    
    return royalties


@router.get("/franchise/groups/{group_id}/compare")
async def compare_locations(
    group_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Compare location performance"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = FranchiseService(db, tenant_id, get_erpnext_adapter())
    comparison = await service.compare_locations(
        group_id, from_date, to_date
    )
    
    return {"comparison": comparison}


# ==================== BI Connector Endpoints ====================

@router.post("/bi/connectors")
async def create_bi_connector(
    request: CreateConnectorRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a BI connector"""
    service = BIConnectorService(db, tenant_id)
    connector = service.create_connector(
        name=request.name,
        connector_type=request.connector_type,
        connection_settings=request.connection_settings,
        enabled_data_sources=request.enabled_data_sources,
        sync_frequency=request.sync_frequency,
        created_by=current_user.get("user_id")
    )
    
    return {
        "id": str(connector.id),
        "name": connector.name,
        "message": "Connector created"
    }


@router.get("/bi/connectors")
async def list_bi_connectors(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List BI connectors"""
    service = BIConnectorService(db, tenant_id)
    connectors = service.get_connectors()
    
    return {
        "connectors": [
            {
                "id": str(c.id),
                "name": c.name,
                "connector_type": c.connector_type,
                "status": c.status,
                "sync_enabled": c.sync_enabled,
                "sync_frequency": c.sync_frequency,
                "last_sync_at": c.last_sync_at,
                "enabled_data_sources": c.enabled_data_sources
            }
            for c in connectors
        ]
    }


@router.delete("/bi/connectors/{connector_id}")
async def delete_bi_connector(
    connector_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Delete a BI connector"""
    service = BIConnectorService(db, tenant_id)
    success = service.delete_connector(connector_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    return {"message": "Connector deleted"}


@router.get("/bi/data-sources")
async def list_data_sources(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get available data sources"""
    service = BIConnectorService(db, tenant_id)
    return {"data_sources": service.get_available_data_sources()}


@router.post("/bi/extract")
async def extract_data(
    request: ExtractDataRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Extract data from a source"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = BIConnectorService(db, tenant_id, get_erpnext_adapter())
    data = await service.extract_data(
        data_source=request.data_source,
        from_date=request.from_date,
        to_date=request.to_date,
        filters=request.filters,
        columns=request.columns,
        limit=request.limit
    )
    
    return {
        "data_source": request.data_source,
        "records": len(data),
        "data": data
    }


# ==================== Data Export Endpoints ====================

@router.post("/bi/exports")
async def create_export(
    request: CreateExportRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Create a data export configuration"""
    service = BIConnectorService(db, tenant_id)
    export = service.create_export(
        name=request.name,
        data_source=request.data_source,
        destination_type=request.destination_type,
        destination_config=request.destination_config,
        export_format=request.export_format,
        filters=request.filters,
        columns=request.columns,
        schedule=request.schedule,
        connector_id=request.connector_id
    )
    
    return {
        "id": str(export.id),
        "name": export.name,
        "message": "Export created"
    }


@router.get("/bi/exports")
async def list_exports(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List data exports"""
    service = BIConnectorService(db, tenant_id)
    exports = service.get_exports()
    
    return {
        "exports": [
            {
                "id": str(e.id),
                "name": e.name,
                "data_source": e.data_source,
                "export_format": e.export_format,
                "destination_type": e.destination_type,
                "is_scheduled": e.is_scheduled,
                "schedule": e.schedule,
                "last_run_at": e.last_run_at,
                "last_run_status": e.last_run_status,
                "last_run_records": e.last_run_records
            }
            for e in exports
        ]
    }


@router.post("/bi/exports/{export_id}/run")
async def run_export(
    export_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually run an export"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = BIConnectorService(db, tenant_id, get_erpnext_adapter())
    run = await service.run_export(
        export_id=export_id,
        triggered_by="manual",
        triggered_by_user=current_user.get("user_id")
    )
    
    if not run:
        raise HTTPException(status_code=404, detail="Export not found")
    
    return {
        "run_id": str(run.id),
        "status": run.status,
        "records_exported": run.records_exported,
        "file_url": run.file_url,
        "error": run.error_message
    }


@router.get("/bi/exports/{export_id}/runs")
async def get_export_runs(
    export_id: str,
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get export run history"""
    service = BIConnectorService(db, tenant_id)
    runs = service.get_export_runs(export_id, limit)
    
    return {
        "runs": [
            {
                "id": str(r.id),
                "status": r.status,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
                "records_exported": r.records_exported,
                "file_url": r.file_url,
                "triggered_by": r.triggered_by,
                "error": r.error_message
            }
            for r in runs
        ]
    }
