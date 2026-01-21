from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from .config import settings
from .middleware.pos_cache_middleware import POSCacheMiddleware, CacheInvalidationMiddleware
from .services.cache.pos_cache import POSCacheService

# Import all models to ensure SQLAlchemy relationships are properly initialized
from .models.iam import Tenant, TenantSettings, TenantSecuritySettings, TenantNotificationSettings  # noqa: F401
from .models.rbac import Role, Permission, UserRole  # noqa: F401
from .models.pos_warehouse_access import WarehouseAccessRole, WarehouseAccessUser  # noqa: F401
from .models.onboarding import TenantOnboarding, Contact  # noqa: F401

from .routers import odoo, erp, auth, iam, erpnext, pos, erp_modules, inventory, purchases, onboarding, settings as settings_router, provisioning, pos_quick_actions, pos_receipts, i18n
from .api.v2 import pos as pos_v2
from .routers import pos_profiles, pos_sessions, pos_orders, pos_quick_actions, pos_payments, pos_receipts, pos_loyalty, pos_layaway, pos_sync, pos_analytics, pos_warehouse_access  # PoS routers
from .routers import roles, permissions, user_roles, audit, imports, rbac  # RBAC routers
from .routers import accounting, crm, hr, manufacturing, projects, paint  # Module routers
from .routers import tenant_setup  # Tenant setup router
from .routers import reports, commissions, dashboard, files, notifications  # Phase 5 routers
from .dependencies.auth import oauth2_scheme

app = FastAPI(title="MoranERP API Gateway")

# CORS configuration for frontend
# Initialize cache service
from redis.asyncio import Redis
redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
cache_service = POSCacheService(redis_client=redis_client)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4000",
        "http://localhost:3000",
        "http://app.localhost",
        "http://127.0.0.1:4000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")

# Add POS cache middleware after auth router
app.add_middleware(POSCacheMiddleware, cache_service=cache_service)
app.add_middleware(CacheInvalidationMiddleware, cache_service=cache_service)
app.include_router(iam.router)
app.include_router(onboarding.router, prefix="/api")
app.include_router(provisioning.router, prefix="/api")
app.include_router(erp_modules.router)
app.include_router(odoo.router)
app.include_router(erpnext.router)
app.include_router(erp.router)
app.include_router(pos.router, prefix="/api/pos")
app.include_router(inventory.router, prefix="/api")
app.include_router(purchases.router)
app.include_router(accounting.router, prefix="/api")
app.include_router(crm.router, prefix="/api")
app.include_router(hr.router, prefix="/api")
app.include_router(paint.router, prefix="/api")
app.include_router(manufacturing.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
from app.routers import sales, support, assets, quality
app.include_router(sales.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(quality.router, prefix="/api")
app.include_router(pos_profiles.router, prefix="/api")
app.include_router(pos_sessions.router, prefix="/api")
app.include_router(pos_orders.router, prefix="/api")
app.include_router(pos_payments.router, prefix="/api")
app.include_router(pos_receipts.router, prefix="/api")
app.include_router(pos_quick_actions.router, prefix="/api")
app.include_router(pos_loyalty.router, prefix="/api")
app.include_router(pos_layaway.router, prefix="/api")
app.include_router(pos_sync.router, prefix="/api")
app.include_router(pos_analytics.router, prefix="/api")
app.include_router(pos_warehouse_access.router, prefix="/api")
app.include_router(pos_v2.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

# RBAC routers
app.include_router(rbac.router)  # New RBAC management router
app.include_router(roles.router, prefix="/api/v1")
app.include_router(permissions.router, prefix="/api/v1")
app.include_router(user_roles.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(imports.router, prefix="/api/v1")
app.include_router(tenant_setup.router, prefix="/api/tenants/{tenant_id}")

# Phase 5: Reports, Commissions, Dashboard, Files, Notifications
app.include_router(reports.router, prefix="/api/tenants/{tenant_id}")
app.include_router(commissions.router, prefix="/api/tenants/{tenant_id}")
app.include_router(dashboard.router, prefix="/api/tenants/{tenant_id}")
app.include_router(files.router, prefix="/api/tenants/{tenant_id}")
app.include_router(notifications.router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    print(f"Starting up in {settings.API_ENV} mode")

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"message": "Welcome to MoranERP API Gateway"}
