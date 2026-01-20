# Onboarding System - Developer Quick Reference

## Key Concepts

### Smart/Dumb Architecture
- **Smart**: FastAPI orchestrator (business logic, dependencies, state)
- **Dumb**: ERP adapters (execute methods, no logic)

### JSONB Configuration
- Flexible module setup stored as JSON
- Users can edit before execution
- Defaults merged with overrides

### Tenant-Scoped Global Users
- One User record per person globally
- Membership per tenant
- Roles and permissions per tenant
- Contact escalation path: Contact → User → Membership → Roles
- **God User Exception**: `admin@moran.com` (SUPER_ADMIN) can access ALL tenants

## Quick API Usage

### Start Onboarding
```bash
curl -X POST http://localhost:9000/onboarding/tenants/{tenantId}/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_code": "STARTUP",
    "custom_config": {
      "global": {
        "include_demo_data": false
      }
    }
  }'
```

### Get Status
```bash
curl http://localhost:9000/onboarding/tenants/{tenantId}/status \
  -H "Authorization: Bearer $TOKEN"
```

### Execute Next Step
```bash
curl -X POST http://localhost:9000/onboarding/tenants/{tenantId}/next-step \
  -H "Authorization: Bearer $TOKEN"
```

## File Locations

```
Backend/
├── app/
│   ├── models/onboarding.py          ← Domain models
│   ├── services/onboarding_service.py ← Orchestrator
│   └── routers/onboarding.py          ← API endpoints
├── alembic/env.py                    ← Migration config
└── app/main.py                       ← Router registration

Frontend/
├── src/components/onboarding/
│   ├── OnboardingWizard.tsx          ← Main UI
│   └── ContactManagement.tsx         ← Contact UI
```

## Key Classes

### OnboardingOrchestrator
**File**: `Backend/app/services/onboarding_service.py`

```python
# Methods you'll use
orchestrator.initiate_onboarding(tenant_id, template_name, config)
orchestrator.execute_next_step(tenant_id)
orchestrator.get_onboarding_status(tenant_id)
orchestrator.skip_step(tenant_id, step_number)
```

### Models
- `TenantOnboarding`: Main onboarding record (status: DRAFT|IN_PROGRESS|COMPLETED|FAILED)
- `OnboardingStep`: Individual step with execution result
- `ModuleDefinition`: Module metadata with setup method
- `Contact`: Customer/Supplier/Partner for escalation

## Database Schema Quick View

```
contacts
├── id (PK)
├── contact_code (UNQ)
├── contact_type: customer|supplier|partner
├── escalation_user_id (FK Users)
└── custom_metadata (JSONB)

tenant_onboarding
├── id (PK)
├── tenant_id (FK)
├── status: DRAFT|IN_PROGRESS|COMPLETED|FAILED
├── template_name
├── module_configurations (JSONB)

onboarding_steps
├── id (PK)
├── onboarding_id (FK)
├── module_id (FK)
├── status: PENDING|IN_PROGRESS|COMPLETED|FAILED|SKIPPED
├── execution_result (JSONB) ← Contains created IDs/errors
```

## Testing the System

### God User Test Flow (admin@moran.com)

God users can test onboarding across ANY tenant without access restrictions:

```bash
# 1. Get token as god user
TOKEN=$(curl -X POST http://localhost:9000/auth/login \
  -d '{"email":"admin@moran.com","password":"password123"}' \
  | jq -r '.access_token')

# 2. Select Paint Shop tenant (god user can access any tenant)
TENANT_RESPONSE=$(curl -X POST http://localhost:9000/auth/select-tenant \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenant_id":"paint-shop-tenant-id"}')
TENANT_TOKEN=$(echo $TENANT_RESPONSE | jq -r '.access_token')

# 3. Start onboarding (works for ANY tenant_id)
curl -X POST http://localhost:9000/onboarding/tenants/paint-shop-tenant-id/start \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -d '{
    "template_code": "STARTUP",
    "custom_config": {}
  }'

# 4. Execute steps
curl -X POST http://localhost:9000/onboarding/tenants/paint-shop-tenant-id/next-step \
  -H "Authorization: Bearer $TENANT_TOKEN"

# 5. Check status
curl http://localhost:9000/onboarding/tenants/paint-shop-tenant-id/status \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

### Regular User Test Flow

```bash
# 1. Get token as regular user
TOKEN=$(curl -X POST http://localhost:9000/auth/login \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Select their assigned tenant
TENANT_RESPONSE=$(curl -X POST http://localhost:9000/auth/select-tenant \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tenant_id":"their-tenant-id"}')
TENANT_TOKEN=$(echo $TENANT_RESPONSE | jq -r '.access_token')

# 3. Can ONLY access their assigned tenant
curl -X POST http://localhost:9000/onboarding/tenants/their-tenant-id/start \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -d '{"template_code":"STARTUP"}'

# 4. Trying to access another tenant will fail with 403
curl -X POST http://localhost:9000/onboarding/tenants/other-tenant-id/start \
  -H "Authorization: Bearer $TENANT_TOKEN"
# → Response: {"detail": "You do not have access to this tenant"}
```

## Common Patterns

### Check Module Dependencies
```python
from app.services.onboarding_service import MODULE_DEPENDENCIES

deps = MODULE_DEPENDENCIES  # Dict[str, List[str]]
print(deps["pos"])  # ["inventory", "accounting"]
```

### Get Module Order
```python
from app.services.onboarding_service import OnboardingOrchestrator

modules = ["pos", "inventory", "accounting"]
ordered = orchestrator._resolve_module_order(modules)
# Returns: ["accounting", "inventory", "pos"]
```

### Check Onboarding Progress
```python
status = orchestrator.get_onboarding_status(tenant_id)
print(f"Status: {status['status']}")              # DRAFT|IN_PROGRESS|...
print(f"Progress: {status['progress_percentage']}")  # 0-100
print(f"Errors: {status['errors']}")               # List of error messages
```

## Authorization & Access Control

### God User (admin@moran.com)

**JWT Claims:**
```json
{
  "sub": "admin@moran.com",
  "user_id": "...",
  "tenant_id": "...",
  "is_super_admin": true,
  "roles": ["SUPER_ADMIN", "OWNER"]
}
```

**Capabilities:**
- ✅ Access onboarding for ANY tenant
- ✅ Create contacts in any tenant
- ✅ Manage escalations across tenants
- ✅ Execute steps without tenant restrictions
- ✅ Monitor progress across all tenants

### Regular User

**JWT Claims:**
```json
{
  "sub": "user@example.com",
  "user_id": "...",
  "tenant_id": "their-tenant-id",
  "is_super_admin": false,
  "roles": ["USER", "ADMIN"]
}
```

**Capabilities:**
- ✅ Access onboarding for their assigned tenant ONLY
- ✅ Create/manage contacts in their tenant
- ❌ Cannot access other tenants' onboarding
- ❌ Cannot escalate contacts across tenants

### Access Control Implementation

**File**: `Backend/app/dependencies/auth.py`

```python
def verify_tenant_access(
    requested_tenant_id: str,
    payload: dict = Depends(get_current_token_payload)
) -> bool:
    """
    Verify tenant access.
    - SUPER_ADMIN → Allow any tenant
    - Regular user → Allow only assigned tenant
    """
    is_super_admin = payload.get("is_super_admin", False)
    if is_super_admin:
        return True  # God user bypass
    
    if payload.get("tenant_id") != requested_tenant_id:
        raise HTTPException(status_code=403, detail="No access to tenant")
    return True
```

## Debugging Tips

### API Not Responding
```bash
docker-compose ps  # Check if container is running
docker-compose logs api --tail=50  # Check logs
curl http://localhost:9000/health  # Health check
```

### Check JWT Claims
```bash
# Extract and decode JWT token
TOKEN="your-token-here"
echo $TOKEN | cut -d '.' -f 2 | base64 -D | jq '.'
```

### Verify God User Status
```bash
docker exec moran-api python << 'EOF'
from app.database import SessionLocal
from app.models.iam import User, UserRole

db = SessionLocal()
admin = db.query(User).filter(User.email == 'admin@moran.com').first()
if admin:
    is_super = db.query(UserRole).filter(
        UserRole.user_id == admin.id,
        UserRole.tenant_id == None,
        UserRole.is_active == True
    ).first()
    print(f"✓ Is SUPER_ADMIN: {is_super is not None}")
else:
    print("✗ admin@moran.com not found - run: docker exec moran-api python -m app.scripts.seed_iam")
EOF
```

### Migration Issues
```bash
# Check migration status
docker exec moran-postgres psql -U postgres -d moran_db \
  -c "SELECT version, description FROM alembic_version;"

# Re-run migration
docker exec moran-api alembic upgrade head
```

### Database Query
```bash
docker exec moran-postgres psql -U postgres -d moran_db \
  -c "SELECT id, status, template_name FROM tenant_onboarding LIMIT 5;"
```

### Step Execution Result
```bash
docker exec moran-postgres psql -U postgres -d moran_db \
  -c "SELECT step_id, status, execution_result FROM onboarding_steps WHERE status = 'FAILED';"
```

## Common Errors

### "Could not validate credentials"
- Missing Authorization header
- Invalid/expired token
- Fix: Include valid Bearer token in header

### "You do not have access to this tenant"
- Regular user trying to access another tenant's onboarding
- God user should work for any tenant
- Fix: Use god user token or user's assigned tenant

### "Circular dependency detected"
- Module A depends on B which depends on A
- Fix: Check MODULE_DEPENDENCIES for cycles

### "Step execution failed"
- Check `onboarding_steps.execution_result` JSONB for error details
- May be ERP connection issue
- May be invalid configuration

### "Contact escalation pending"
- Contact already has escalation request
- Fix: Admin must accept or reject first

## Adding New Module

```python
# 1. Add to MODULE_DEPENDENCIES in onboarding_service.py
MODULE_DEPENDENCIES["my_module"] = ["dependency1", "dependency2"]

# 2. Create ModuleDefinition in database
module = ModuleDefinition(
    module_code="my_module",
    module_name="My Module",
    setup_method_name="setup_step_my_module",
    is_mandatory=True,
    custom_config={"key": "value"}
)
db.add(module)
db.commit()

# 3. Add adapter method
class OdooClientAdapter:
    def setup_step_my_module(self, config: dict) -> dict:
        # XML-RPC calls here
        return {"status": "success", "module_id": 123}

# 4. Add to template (if needed)
SYSTEM_TEMPLATES["STARTUP"].append({
    "module_code": "my_module",
    "order": 4
})
```

## Environment Variables

```bash
# No special env vars needed for onboarding system
# Uses existing database and ERP credentials

# Verify database connection
docker exec moran-api python -c \
  "from app.database import engine; engine.connect(); print('✓ DB OK')"
```

## Performance Notes

- Topological sort: O(V + E) where V=modules, E=dependencies
- Step execution: Sequential (could be parallelized)
- Status polling: ~50ms (optimized for 2s intervals)
- Configuration merge: ~5ms (simple dict update)

## Contact Escalation Flow

```
1. Create Contact
   └─ contact_code generated (CNT-KE-25-XXXXX)
   └─ status = "ACTIVE"

2. Request Access
   └─ escalation_requested = true
   └─ Admin receives notification

3. Accept Access
   └─ Create global User (if not exists)
   └─ Create Membership in tenant
   └─ Assign Role based on contact_type
   └─ Send email with login credentials
   └─ escalation_user_id = user.id
```

## Testing Templates

```python
templates = {
    "STARTUP": 3,        # 3 modules (accounting, inventory, pos)
    "SME": 6,            # 6 modules (STARTUP + crm, purchasing, projects)
    "ENTERPRISE": 10     # 10 modules (SME + manufacturing, hr, assets, website)
}

# Start with STARTUP for quick testing
```

## Useful Queries

```sql
-- List all onboardings
SELECT id, tenant_id, status, template_name, created_at
FROM tenant_onboarding
ORDER BY created_at DESC;

-- List pending steps
SELECT id, onboarding_id, module_id, status
FROM onboarding_steps
WHERE status = 'PENDING'
ORDER BY order;

-- Check execution results
SELECT step_id, status, execution_result
FROM onboarding_steps
WHERE status IN ('FAILED', 'COMPLETED');

-- List contacts by type
SELECT id, contact_code, contact_name, contact_type, escalation_requested
FROM contacts
WHERE contact_type = 'customer'
ORDER BY created_at DESC;

-- Verify god user has SUPER_ADMIN role
SELECT ur.* FROM user_roles ur
JOIN users u ON ur.user_id = u.id
WHERE u.email = 'admin@moran.com' AND ur.tenant_id IS NULL AND ur.is_active = true;
```

## Next Development Tasks

- [ ] Replace adapter stubs with real ERP calls
- [ ] Add error recovery/retry logic
- [ ] Implement rollback functionality
- [ ] Wire permission filtering to auth_service
- [ ] Add email notifications for escalation
- [ ] Create monitoring dashboard
- [ ] Write comprehensive tests
- [ ] Extend god user audit logging

## Support Resources

- Full API docs: `http://localhost:9000/docs`
- Integration guide: `.azure/ONBOARDING_INTEGRATION.md`
- Implementation summary: `ONBOARDING_IMPLEMENTATION_SUMMARY.md`
- God User Setup: `GODUSER_SETUP_COMPLETE.md`
- God User Onboarding Integration: `GODUSER_ONBOARDING_INTEGRATION.md`
- This file: `.github/ONBOARDING_QUICK_REFERENCE.md`
