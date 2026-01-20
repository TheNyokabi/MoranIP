# MoranERP Copilot Instructions

## Architecture Overview

MoranERP is a **multi-tenant ERP platform** with an engine-agnostic design:

```
Frontend (Next.js:4000) → API Gateway (FastAPI:9000) → Engines (Odoo:9069 / ERPNext:9010)
                                ↓
                         PostgreSQL:5432 + Kafka:9092
```

**Key architectural decisions:**
- **Multi-tenant by design**: Users belong to multiple tenants via `Membership`. All engine calls require tenant context.
- **Engine abstraction**: The `/erp/*` routes are engine-agnostic. The `Tenant.engine` field (`odoo`|`erpnext`) determines which adapter handles requests. See [Backend/app/routers/erp.py](Backend/app/routers/erp.py) for the pattern.
- **Tenant-scoped JWTs**: Access tokens contain `tenant_id`, `user_code`, and `kyc_tier`. Global login returns tenant list; user must select one to get a scoped token.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `Backend/` | FastAPI gateway - IAM, auth, engine routing |
| `Backend/app/services/` | Engine adapters (`odoo_client.py`, `erpnext_client.py`) |
| `Backend/app/dependencies/` | FastAPI deps for auth (`auth.py`) and tenant extraction (`tenant.py`) |
| `Engine/` | Odoo config + custom addons in `addons/` |
| `Engine/ERPNext/` | ERPNext simulator for development |
| `Frontend/` | Next.js 14 + Shadcn/ui + Zustand stores |
| `Frontend/src/app/t/[tenantSlug]/` | Tenant-scoped routes |
| `QATests/` | Robot Framework integration tests |

## Development Commands

```bash
# Start full stack
docker-compose up -d --build

# Run QA tests
docker-compose --profile test up qa

# Backend migrations
docker exec -it moran-api alembic upgrade head
docker exec -it moran-api alembic revision --autogenerate -m "description"

# Seed IAM data (creates admin@moran.com / password123)
docker exec -it moran-api python -m app.scripts.seed_iam

# Frontend dev (if running locally)
cd Frontend && npm run dev
```

## Code Patterns

### Adding New Engine Adapters
1. Create adapter in `Backend/app/services/` following `OdooClientAdapter` pattern
2. Add engine type to `Tenant.engine` choices in [Backend/app/models/iam.py](Backend/app/models/iam.py)
3. Add switch case in domain routers (e.g., `erp.py`)

### Entity Codes
All entities use human-readable codes: `PREFIX-COUNTRY-YEAR-SUFFIX` (e.g., `USR-KE-25-X8M4Q`). Generate via `generate_entity_code()` from [Backend/app/utils/codes.py](Backend/app/utils/codes.py).

### Authentication Flow
1. `POST /auth/login` → returns user info + available tenants
2. `POST /auth/select-tenant` or `/auth/v1/login-with-tenant` → returns JWT with tenant scope
3. Protected routes use `Depends(require_tenant_access)` from [Backend/app/dependencies/auth.py](Backend/app/dependencies/auth.py)

### Frontend State
- Auth: `useAuthStore` from [Frontend/src/store/auth-store.ts](Frontend/src/store/auth-store.ts)
- Tenant context: `useTenantStore` from [Frontend/src/store/tenant-store.ts](Frontend/src/store/tenant-store.ts)
- Tenant routes live under `/t/[tenantSlug]/`

### Testing
- **Backend unit**: pytest with async client in [Backend/tests/conftest.py](Backend/tests/conftest.py)
- **Integration**: Robot Framework in `QATests/tests/` - tests run against containerized API
- Test credentials: `admin@moran.com` / `password123`

## Service Ports & URLs

| Service | Direct Port | Traefik URL |
|---------|-------------|-------------|
| Frontend | 4000 | app.localhost |
| API Gateway | 9000 | api.localhost |
| Odoo | 9069 | odoo.localhost |
| ERPNext | 9010 | - |
| Kafka UI | 9080 | - |
| Grafana | 9001 | - |

## Secrets Management

Secrets stored in `secrets/*.txt` and mounted via Docker secrets. In code, read via `settings._read_secret()` pattern in [Backend/app/config.py](Backend/app/config.py).

## Implementation Status

### ✅ Completed
| Component | Status | Notes |
|-----------|--------|-------|
| Multi-tenant IAM | ✅ | Users, Tenants, Memberships, StaffProfiles |
| Auth flow | ✅ | Global login → tenant selection → scoped JWT |
| Odoo adapter | ✅ | XML-RPC client with tenant credentials |
| ERPNext adapter | ✅ | REST proxy with full CRUD + RPC methods |
| Engine abstraction | ✅ | `/erp/partners` normalizes across engines |
| Database migrations | ✅ | Alembic with 3 versions applied |
| QA test suite | ✅ | Robot Framework: health, IAM, Odoo, ERPNext |
| Monitoring stack | ✅ | Prometheus, Grafana, cAdvisor |
| Frontend architecture | ✅ | Next.js 14 App Router with global/tenant layouts |
| Login page | ✅ | Form with tenant selection flow |
| Tenant dashboard | ✅ | Stats cards, activity feed, quick stats |
| Social feed | ✅ | Feed component with posts, likes, comments |
| Auth store | ✅ | Zustand with persist, real API integration |
| Tenant store | ✅ | Tenant context with slug helpers |
| API client | ✅ | Type-safe fetch wrapper in `lib/api.ts` |
| Dark mode | ✅ | Theme toggle with localStorage persistence |
| Settings page | ✅ | User profile, security, logout |

### 🚧 In Progress / Stubbed
| Component | Location | Issue |
|-----------|----------|-------|
| RBAC roles in JWT | [auth_service.py#L56-63](Backend/app/services/auth_service.py) | `TODO: join roles` - Capability model exists but not wired to tokens |
| Kafka events | Infrastructure ready | No producers/consumers implemented |

### 📋 Not Started
- KYC tier enforcement (field exists, no guards)
- Capability-based access control
- Real tenant credential vault (hardcoded in adapters)
- Tenant sub-pages (members, finance, reports)
