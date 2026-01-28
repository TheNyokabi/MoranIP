"""
Plugins & Webhooks API Router

Endpoints for:
- Plugin marketplace
- Plugin installation/management
- Webhook management
- Webhook events
"""

import logging
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.plugins import (
    plugin_registry, PluginType, PluginStatus, HookType,
    webhook_manager, WebhookEvent, WebhookStatus
)
from ..models.plugins import (
    MarketplacePlugin, PluginInstallation, PluginReview,
    Webhook, WebhookDelivery as WebhookDeliveryModel
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins", tags=["Plugins & Webhooks"])


# ==================== Pydantic Models ====================

class PluginListItem(BaseModel):
    id: str
    code: str
    name: str
    version: str
    plugin_type: str
    short_description: Optional[str]
    icon_url: Optional[str]
    author_name: str
    is_free: bool
    price: float
    avg_rating: float
    total_installs: int
    is_verified: bool
    is_featured: bool

    class Config:
        from_attributes = True


class PluginDetail(PluginListItem):
    description: Optional[str]
    banner_url: Optional[str]
    screenshots: List[str]
    documentation_url: Optional[str]
    support_url: Optional[str]
    tags: List[str]
    min_platform_version: str
    required_permissions: List[str]
    dependencies: List[str]
    settings_schema: Optional[Dict]
    changelog: Optional[str]
    release_notes: Optional[str]


class InstallPluginRequest(BaseModel):
    plugin_id: str
    settings: Optional[Dict[str, Any]] = None
    license_key: Optional[str] = None


class UpdatePluginSettingsRequest(BaseModel):
    settings: Dict[str, Any]


class PluginInstallationResponse(BaseModel):
    id: str
    plugin_id: str
    installed_version: str
    status: str
    settings: Dict[str, Any]
    installed_at: datetime

    class Config:
        from_attributes = True


class CreateWebhookRequest(BaseModel):
    name: str
    url: str
    events: List[str]
    custom_headers: Optional[Dict[str, str]] = None
    timeout_seconds: int = Field(default=30, ge=5, le=120)
    max_retries: int = Field(default=3, ge=0, le=10)


class UpdateWebhookRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    status: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None


class WebhookResponse(BaseModel):
    id: str
    name: str
    url: str
    events: List[str]
    status: str
    last_triggered_at: Optional[datetime]
    consecutive_failures: int
    total_deliveries: int
    successful_deliveries: int
    created_at: datetime

    class Config:
        from_attributes = True


class WebhookDeliveryResponse(BaseModel):
    id: str
    event: str
    status: str
    response_status_code: Optional[int]
    response_time_ms: Optional[int]
    attempt_number: int
    error_message: Optional[str]
    created_at: datetime
    delivered_at: Optional[datetime]

    class Config:
        from_attributes = True


class TriggerWebhookRequest(BaseModel):
    event: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class PluginReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = None
    review: Optional[str] = None


# ==================== Marketplace Endpoints ====================

@router.get("/marketplace", response_model=List[PluginListItem])
async def list_marketplace_plugins(
    plugin_type: Optional[str] = None,
    search: Optional[str] = None,
    is_free: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    sort_by: str = Query("popular", enum=["popular", "newest", "rating", "name"]),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List available plugins in marketplace"""
    query = db.query(MarketplacePlugin).filter(
        MarketplacePlugin.status == "approved"
    )
    
    if plugin_type:
        query = query.filter(MarketplacePlugin.plugin_type == plugin_type)
    
    if is_free is not None:
        query = query.filter(MarketplacePlugin.is_free == is_free)
    
    if is_featured is not None:
        query = query.filter(MarketplacePlugin.is_featured == is_featured)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (MarketplacePlugin.name.ilike(search_term)) |
            (MarketplacePlugin.short_description.ilike(search_term)) |
            (MarketplacePlugin.tags.any(search))
        )
    
    # Sorting
    if sort_by == "popular":
        query = query.order_by(MarketplacePlugin.total_installs.desc())
    elif sort_by == "newest":
        query = query.order_by(MarketplacePlugin.published_at.desc())
    elif sort_by == "rating":
        query = query.order_by(MarketplacePlugin.avg_rating.desc())
    else:
        query = query.order_by(MarketplacePlugin.name)
    
    plugins = query.offset(offset).limit(limit).all()
    
    return [
        PluginListItem(
            id=str(p.id),
            code=p.code,
            name=p.name,
            version=p.version,
            plugin_type=p.plugin_type,
            short_description=p.short_description,
            icon_url=p.icon_url,
            author_name=p.author_name,
            is_free=p.is_free,
            price=float(p.price) if p.price else 0,
            avg_rating=float(p.avg_rating) if p.avg_rating else 0,
            total_installs=p.total_installs,
            is_verified=p.is_verified,
            is_featured=p.is_featured
        )
        for p in plugins
    ]


@router.get("/marketplace/{plugin_id}", response_model=PluginDetail)
async def get_plugin_details(
    plugin_id: str,
    db: Session = Depends(get_db)
):
    """Get plugin details"""
    plugin = db.query(MarketplacePlugin).filter(
        MarketplacePlugin.id == plugin_id
    ).first()
    
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    
    return PluginDetail(
        id=str(plugin.id),
        code=plugin.code,
        name=plugin.name,
        version=plugin.version,
        plugin_type=plugin.plugin_type,
        short_description=plugin.short_description,
        description=plugin.description,
        icon_url=plugin.icon_url,
        banner_url=plugin.banner_url,
        screenshots=plugin.screenshots or [],
        author_name=plugin.author_name,
        documentation_url=plugin.documentation_url,
        support_url=plugin.support_url,
        is_free=plugin.is_free,
        price=float(plugin.price) if plugin.price else 0,
        avg_rating=float(plugin.avg_rating) if plugin.avg_rating else 0,
        total_installs=plugin.total_installs,
        is_verified=plugin.is_verified,
        is_featured=plugin.is_featured,
        tags=plugin.tags or [],
        min_platform_version=plugin.min_platform_version,
        required_permissions=plugin.required_permissions or [],
        dependencies=plugin.dependencies or [],
        settings_schema=plugin.settings_schema,
        changelog=plugin.changelog,
        release_notes=plugin.release_notes
    )


@router.get("/marketplace/types")
async def get_plugin_types():
    """Get available plugin types"""
    return {
        "types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in PluginType
        ]
    }


# ==================== Plugin Installation Endpoints ====================

@router.get("/installed", response_model=List[PluginInstallationResponse])
async def list_installed_plugins(
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List installed plugins for tenant"""
    query = db.query(PluginInstallation).filter(
        PluginInstallation.tenant_id == tenant_id
    )
    
    if status:
        query = query.filter(PluginInstallation.status == status)
    
    installations = query.all()
    
    return [
        PluginInstallationResponse(
            id=str(i.id),
            plugin_id=str(i.plugin_id),
            installed_version=i.installed_version,
            status=i.status,
            settings=i.settings or {},
            installed_at=i.installed_at
        )
        for i in installations
    ]


@router.post("/install", response_model=PluginInstallationResponse)
async def install_plugin(
    request: InstallPluginRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Install a plugin"""
    # Check if plugin exists
    plugin = db.query(MarketplacePlugin).filter(
        MarketplacePlugin.id == request.plugin_id
    ).first()
    
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    
    # Check if already installed
    existing = db.query(PluginInstallation).filter(
        PluginInstallation.tenant_id == tenant_id,
        PluginInstallation.plugin_id == request.plugin_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Plugin already installed")
    
    # Create installation
    installation = PluginInstallation(
        tenant_id=tenant_id,
        plugin_id=request.plugin_id,
        installed_version=plugin.version,
        status="installed",
        settings=request.settings or {},
        license_key=request.license_key,
        installed_by=current_user.get("user_id"),
        is_trial=not plugin.is_free and not request.license_key
    )
    
    db.add(installation)
    
    # Update plugin stats
    plugin.total_installs += 1
    plugin.active_installs += 1
    
    db.commit()
    db.refresh(installation)
    
    return PluginInstallationResponse(
        id=str(installation.id),
        plugin_id=str(installation.plugin_id),
        installed_version=installation.installed_version,
        status=installation.status,
        settings=installation.settings or {},
        installed_at=installation.installed_at
    )


@router.post("/installed/{installation_id}/enable")
async def enable_plugin(
    installation_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Enable an installed plugin"""
    installation = db.query(PluginInstallation).filter(
        PluginInstallation.id == installation_id,
        PluginInstallation.tenant_id == tenant_id
    ).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    installation.status = "enabled"
    installation.last_enabled_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Plugin enabled", "status": "enabled"}


@router.post("/installed/{installation_id}/disable")
async def disable_plugin(
    installation_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Disable an installed plugin"""
    installation = db.query(PluginInstallation).filter(
        PluginInstallation.id == installation_id,
        PluginInstallation.tenant_id == tenant_id
    ).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    installation.status = "disabled"
    installation.last_disabled_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Plugin disabled", "status": "disabled"}


@router.patch("/installed/{installation_id}/settings")
async def update_plugin_settings(
    installation_id: str,
    request: UpdatePluginSettingsRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Update plugin settings"""
    installation = db.query(PluginInstallation).filter(
        PluginInstallation.id == installation_id,
        PluginInstallation.tenant_id == tenant_id
    ).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    installation.settings = request.settings
    db.commit()
    
    return {"message": "Settings updated", "settings": installation.settings}


@router.delete("/installed/{installation_id}")
async def uninstall_plugin(
    installation_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Uninstall a plugin"""
    installation = db.query(PluginInstallation).filter(
        PluginInstallation.id == installation_id,
        PluginInstallation.tenant_id == tenant_id
    ).first()
    
    if not installation:
        raise HTTPException(status_code=404, detail="Installation not found")
    
    # Update plugin stats
    plugin = db.query(MarketplacePlugin).filter(
        MarketplacePlugin.id == installation.plugin_id
    ).first()
    
    if plugin:
        plugin.active_installs = max(0, plugin.active_installs - 1)
    
    db.delete(installation)
    db.commit()
    
    return {"message": "Plugin uninstalled"}


# ==================== Webhook Endpoints ====================

@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """List webhooks for tenant"""
    query = db.query(Webhook).filter(Webhook.tenant_id == tenant_id)
    
    if status:
        query = query.filter(Webhook.status == status)
    
    webhooks = query.order_by(Webhook.created_at.desc()).all()
    
    return [
        WebhookResponse(
            id=str(w.id),
            name=w.name,
            url=w.url,
            events=w.events,
            status=w.status,
            last_triggered_at=w.last_triggered_at,
            consecutive_failures=w.consecutive_failures,
            total_deliveries=w.total_deliveries,
            successful_deliveries=w.successful_deliveries,
            created_at=w.created_at
        )
        for w in webhooks
    ]


@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    request: CreateWebhookRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new webhook"""
    import hashlib
    import secrets
    
    # Validate events
    valid_events = [e.value for e in WebhookEvent]
    for event in request.events:
        if event not in valid_events:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event: {event}. Valid events: {valid_events}"
            )
    
    # Generate secret
    secret = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
    
    webhook = Webhook(
        tenant_id=tenant_id,
        name=request.name,
        url=request.url,
        secret=secret,
        events=request.events,
        custom_headers=request.custom_headers or {},
        timeout_seconds=request.timeout_seconds,
        max_retries=request.max_retries,
        created_by=current_user.get("user_id")
    )
    
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        status=webhook.status,
        last_triggered_at=webhook.last_triggered_at,
        consecutive_failures=webhook.consecutive_failures,
        total_deliveries=webhook.total_deliveries,
        successful_deliveries=webhook.successful_deliveries,
        created_at=webhook.created_at
    )


@router.get("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get webhook details"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        status=webhook.status,
        last_triggered_at=webhook.last_triggered_at,
        consecutive_failures=webhook.consecutive_failures,
        total_deliveries=webhook.total_deliveries,
        successful_deliveries=webhook.successful_deliveries,
        created_at=webhook.created_at
    )


@router.patch("/webhooks/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    request: UpdateWebhookRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Update webhook configuration"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    if request.name is not None:
        webhook.name = request.name
    if request.url is not None:
        webhook.url = request.url
    if request.events is not None:
        webhook.events = request.events
    if request.status is not None:
        webhook.status = request.status
    if request.custom_headers is not None:
        webhook.custom_headers = request.custom_headers
    
    db.commit()
    db.refresh(webhook)
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        events=webhook.events,
        status=webhook.status,
        last_triggered_at=webhook.last_triggered_at,
        consecutive_failures=webhook.consecutive_failures,
        total_deliveries=webhook.total_deliveries,
        successful_deliveries=webhook.successful_deliveries,
        created_at=webhook.created_at
    )


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Delete a webhook"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    db.delete(webhook)
    db.commit()
    
    return {"message": "Webhook deleted"}


@router.get("/webhooks/{webhook_id}/secret")
async def get_webhook_secret(
    webhook_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get webhook secret (for configuration)"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {"secret": webhook.secret}


@router.post("/webhooks/{webhook_id}/regenerate-secret")
async def regenerate_webhook_secret(
    webhook_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Regenerate webhook secret"""
    import hashlib
    import secrets
    
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    webhook.secret = hashlib.sha256(secrets.token_bytes(32)).hexdigest()
    db.commit()
    
    return {"secret": webhook.secret, "message": "Secret regenerated"}


@router.get("/webhooks/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse])
async def get_webhook_deliveries(
    webhook_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get webhook delivery history"""
    query = db.query(WebhookDeliveryModel).filter(
        WebhookDeliveryModel.webhook_id == webhook_id,
        WebhookDeliveryModel.tenant_id == tenant_id
    )
    
    if status:
        query = query.filter(WebhookDeliveryModel.status == status)
    
    deliveries = query.order_by(
        WebhookDeliveryModel.created_at.desc()
    ).limit(limit).all()
    
    return [
        WebhookDeliveryResponse(
            id=str(d.id),
            event=d.event,
            status=d.status,
            response_status_code=d.response_status_code,
            response_time_ms=d.response_time_ms,
            attempt_number=d.attempt_number,
            error_message=d.error_message,
            created_at=d.created_at,
            delivered_at=d.delivered_at
        )
        for d in deliveries
    ]


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Send a test event to webhook"""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.tenant_id == tenant_id
    ).first()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    # Use webhook manager to send test event
    from ..services.plugins import webhook_manager as wm, WebhookEvent
    
    deliveries = await wm.dispatch_event(
        tenant_id=tenant_id,
        event=WebhookEvent.SYSTEM_ALERT,
        data={
            "type": "test",
            "message": "This is a test webhook delivery",
            "timestamp": datetime.utcnow().isoformat()
        },
        metadata={"test": True}
    )
    
    if deliveries:
        delivery = deliveries[0]
        return {
            "success": delivery.status.value == "delivered",
            "status": delivery.status.value,
            "response_code": delivery.response_status_code,
            "response_time_ms": delivery.response_time_ms,
            "error": delivery.error_message
        }
    
    return {"success": False, "error": "No delivery created"}


@router.get("/webhooks/events/available")
async def get_available_webhook_events():
    """Get list of available webhook events"""
    events_by_category = {
        "Orders": [e.value for e in WebhookEvent if e.value.startswith("order.")],
        "Invoices": [e.value for e in WebhookEvent if e.value.startswith("invoice.")],
        "Payments": [e.value for e in WebhookEvent if e.value.startswith("payment.") or e.value.startswith("refund.")],
        "Inventory": [e.value for e in WebhookEvent if e.value.startswith("stock.")],
        "Customers": [e.value for e in WebhookEvent if e.value.startswith("customer.")],
        "Products": [e.value for e in WebhookEvent if e.value.startswith("item.") or e.value.startswith("price.")],
        "POS": [e.value for e in WebhookEvent if e.value.startswith("pos.")],
        "Users": [e.value for e in WebhookEvent if e.value.startswith("user.")],
        "System": [e.value for e in WebhookEvent if e.value.startswith("system.") or e.value.startswith("report.")]
    }
    
    return {
        "events_by_category": events_by_category,
        "all_events": [e.value for e in WebhookEvent]
    }
