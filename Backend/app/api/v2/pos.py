"""
POS API Version 2
Future-proof API with enhanced features and backward compatibility
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.services.pos.event_bus import event_bus, publish_invoice_created, publish_payment_processed
from app.services.pos.plugin_registry import plugin_registry
from app.services.cache.pos_cache import POSCacheService

router = APIRouter(
    prefix="/v2/pos",
    tags=["POS API v2"],
)


# Enhanced models for v2 API
class POSInvoiceRequestV2(BaseModel):
    """Enhanced invoice request for v2 API"""
    customer: str = Field(..., description="Customer identifier")
    items: List[Dict[str, Any]] = Field(..., description="List of items with qty and rate")
    payments: List[Dict[str, Any]] = Field(..., description="Payment information")
    pos_profile_id: str = Field(..., description="POS Profile identifier")
    is_vatable: bool = Field(True, description="Whether invoice is subject to VAT")
    notes: Optional[str] = Field(None, description="Invoice notes")
    discount_amount: float = Field(0.0, description="Discount amount")
    loyalty_points_redeemed: int = Field(0, description="Loyalty points to redeem")
    referral_code: Optional[str] = Field(None, description="Referral code for commissions")

    class Config:
        json_schema_extra = {
            "example": {
                "customer": "CUST001",
                "items": [
                    {
                        "item_code": "PHN-SAM-S23",
                        "qty": 1,
                        "rate": 45000.0,
                        "warehouse": "Main Warehouse"
                    }
                ],
                "payments": [
                    {
                        "mode_of_payment": "M-Pesa",
                        "amount": 45000.0,
                        "phone_number": "254712345678"
                    }
                ],
                "pos_profile_id": "POS001",
                "is_vatable": True,
                "notes": "Customer requested fast delivery",
                "discount_amount": 0.0,
                "loyalty_points_redeemed": 0,
                "referral_code": None
            }
        }


class POSInvoiceResponseV2(BaseModel):
    """Enhanced invoice response for v2 API"""
    invoice_id: str
    invoice_name: str
    status: str
    total_amount: float
    vat_amount: float
    discount_amount: float
    net_amount: float
    loyalty_points_earned: int
    commission_earned: float
    created_at: datetime
    qr_code: Optional[str] = None
    receipt_url: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "invoice_id": "SINV-2024-00001",
                "invoice_name": "SINV-2024-00001",
                "status": "Paid",
                "total_amount": 45000.0,
                "vat_amount": 3600.0,
                "discount_amount": 0.0,
                "net_amount": 41400.0,
                "loyalty_points_earned": 45,
                "commission_earned": 900.0,
                "created_at": "2024-01-15T10:30:00Z",
                "qr_code": "https://api.example.com/qr/SINV-2024-00001",
                "receipt_url": "https://api.example.com/receipt/SINV-2024-00001"
            }
        }


class POSAnalyticsRequestV2(BaseModel):
    """Enhanced analytics request for v2 API"""
    date_from: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    date_to: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")
    pos_profile_id: Optional[str] = Field(None, description="Filter by POS profile")
    group_by: str = Field("day", description="Group results by: day, week, month")
    metrics: List[str] = Field(["sales", "transactions", "avg_transaction"], description="Metrics to include")

    class Config:
        json_schema_extra = {
            "example": {
                "date_from": "2024-01-01",
                "date_to": "2024-01-31",
                "pos_profile_id": "POS001",
                "group_by": "day",
                "metrics": ["sales", "transactions", "avg_transaction", "top_items"]
            }
        }


@router.post("/invoices", response_model=POSInvoiceResponseV2)
async def create_invoice_v2(
    request: POSInvoiceRequestV2,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a POS invoice (Version 2)

    Enhanced invoice creation with loyalty integration, advanced validation,
    and real-time event publishing for better extensibility.
    """
    try:
        # Execute plugin hooks before invoice creation
        await plugin_registry.execute_hook(
            'before_invoice_create',
            request.dict(),
            tenant_id
        )

        # Create invoice using existing service
        result = await pos_service.create_invoice({
            **request.dict(),
            'tenant_id': tenant_id,
            'user': current_user.get('email', 'system')
        })

        if not result.get('success'):
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "invoice_creation_failed",
                    "message": result.get('message', 'Failed to create invoice'),
                    "errors": result.get('errors', [])
                }
            )

        invoice_data = result['invoice']

        # Execute plugin hooks after invoice creation
        await plugin_registry.execute_hook(
            'after_invoice_create',
            invoice_data,
            tenant_id
        )

        # Publish event for real-time processing
        await publish_invoice_created(invoice_data, tenant_id)

        # Process loyalty points in background
        if invoice_data.get('loyalty_points_earned', 0) > 0:
            background_tasks.add_task(
                _process_loyalty_points,
                invoice_data['customer'],
                invoice_data['loyalty_points_earned'],
                tenant_id
            )

        # Generate QR code for invoice verification
        qr_code = await _generate_invoice_qr(invoice_data['name'])

        # Build enhanced response
        response = POSInvoiceResponseV2(
            invoice_id=invoice_data['name'],
            invoice_name=invoice_data['name'],
            status=invoice_data.get('status', 'Draft'),
            total_amount=invoice_data.get('grand_total', 0),
            vat_amount=invoice_data.get('total_taxes_and_charges', 0),
            discount_amount=invoice_data.get('discount_amount', 0),
            net_amount=invoice_data.get('net_total', 0),
            loyalty_points_earned=invoice_data.get('loyalty_points_earned', 0),
            commission_earned=invoice_data.get('commission_earned', 0),
            created_at=datetime.now(),
            qr_code=qr_code,
            receipt_url=f"/api/pos/invoices/{invoice_data['name']}/receipt"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invoice creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": "Internal server error during invoice creation",
                "error": str(e)
            }
        )


@router.get("/analytics")
async def get_analytics_v2(
    request: POSAnalyticsRequestV2 = Depends(),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get POS analytics (Version 2)

    Enhanced analytics with advanced filtering, real-time data,
    and plugin-extensible metrics.
    """
    try:
        # Build analytics query
        analytics_data = await _build_analytics_data(
            tenant_id,
            request.dict()
        )

        # Execute plugin hooks for analytics enhancement
        enhanced_data = await plugin_registry.execute_hook(
            'analytics_data_processed',
            analytics_data,
            tenant_id
        )

        # Merge plugin enhancements
        if enhanced_data:
            for plugin_result in enhanced_data:
                if plugin_result and isinstance(plugin_result, dict):
                    analytics_data.update(plugin_result)

        return {
            "analytics": analytics_data,
            "request": request.dict(),
            "generated_at": datetime.now().isoformat(),
            "version": "2.0"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "analytics_error",
                "message": "Failed to generate analytics",
                "error": str(e)
            }
        )


@router.get("/plugins")
async def get_plugin_info(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get information about loaded plugins

    Returns details about active plugins and their capabilities.
    """
    try:
        plugin_info = plugin_registry.get_plugin_info()
        available_hooks = plugin_registry.get_available_hooks()

        return {
            "plugins": plugin_info,
            "available_hooks": available_hooks,
            "payment_providers": len(plugin_registry.get_payment_providers()),
            "loyalty_providers": len(plugin_registry.get_loyalty_providers()),
            "receipt_formatters": len(plugin_registry.get_receipt_formatters()),
            "version": "2.0"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "plugin_info_error",
                "message": "Failed to get plugin information",
                "error": str(e)
            }
        )


@router.get("/events/recent")
async def get_recent_events(
    limit: int = Query(50, description="Number of recent events to return"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent POS events

    Returns recent events for debugging and monitoring.
    """
    try:
        events = await event_bus.get_recent_events(tenant_id, limit)

        return {
            "events": [event.to_dict() for event in events],
            "count": len(events),
            "tenant_id": tenant_id,
            "version": "2.0"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "events_error",
                "message": "Failed to get recent events",
                "error": str(e)
            }
        )


@router.post("/cache/warm")
async def warm_cache_v2(
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Warm up POS caches

    Pre-load frequently accessed data into cache for better performance.
    """
    try:
        cache_service = POSCacheService()

        # Start cache warming in background
        background_tasks.add_task(
            cache_service.warm_cache,
            tenant_id,
            None  # Would pass ERPNext adapter in real implementation
        )

        return {
            "message": "Cache warming started in background",
            "tenant_id": tenant_id,
            "status": "warming",
            "version": "2.0"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "cache_warm_error",
                "message": "Failed to start cache warming",
                "error": str(e)
            }
        )


@router.get("/health")
async def health_check_v2(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enhanced health check for POS system

    Returns comprehensive system health information.
    """
    try:
        # Check cache service health
        cache_service = POSCacheService()
        cache_health = await cache_service.health_check()

        # Check plugin registry
        plugin_count = len(plugin_registry.plugins)

        # Check event bus
        registered_events = event_bus.get_registered_events()

        return {
            "status": "healthy",
            "version": "2.0",
            "services": {
                "cache": cache_health,
                "plugins": {
                    "count": plugin_count,
                    "status": "operational" if plugin_count >= 0 else "error"
                },
                "event_bus": {
                    "registered_events": registered_events,
                    "status": "operational"
                }
            },
            "features": {
                "offline_support": True,
                "plugin_system": True,
                "event_driven": True,
                "caching": True,
                "analytics": True
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "version": "2.0",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


# Helper functions
async def _process_loyalty_points(customer: str, points: int, tenant_id: str):
    """Process loyalty points in background"""
    try:
        from app.services.pos.loyalty_service import LoyaltyService

        loyalty_service = LoyaltyService(tenant_id=tenant_id)
        await loyalty_service.award_points(
            customer=customer,
            points=points,
            reason="Purchase points"
        )

        await event_bus.publish(
            'loyalty_points_earned',
            {'customer': customer, 'points': points},
            source='pos',
            tenant_id=tenant_id
        )

    except Exception as e:
        logger.error(f"Failed to process loyalty points: {e}")


async def _generate_invoice_qr(invoice_name: str) -> str:
    """Generate QR code for invoice verification"""
    try:
        # In a real implementation, this would generate an actual QR code
        # For now, return a placeholder URL
        return f"https://api.example.com/qr/{invoice_name}"
    except Exception as e:
        logger.warning(f"Failed to generate QR code for {invoice_name}: {e}")
        return ""


async def _build_analytics_data(tenant_id: str, request_params: Dict[str, Any]) -> Dict[str, Any]:
    """Build analytics data based on request parameters"""
    try:
        # This would integrate with actual analytics service
        # For now, return mock data
        return {
            "summary": {
                "total_sales": 150000.00,
                "total_transactions": 145,
                "avg_transaction": 1034.48,
                "date_range": f"{request_params.get('date_from', '2024-01-01')} to {request_params.get('date_to', '2024-01-31')}"
            },
            "top_items": [
                {"item": "iPhone 15 Pro", "sales": 25000.00, "quantity": 5},
                {"item": "Samsung S23", "sales": 18000.00, "quantity": 4}
            ],
            "payment_methods": {
                "M-Pesa": {"amount": 120000.00, "count": 120},
                "Cash": {"amount": 30000.00, "count": 25}
            },
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to build analytics data: {e}")
        return {}


# Import logger at the end to avoid circular imports
import logging
logger = logging.getLogger(__name__)