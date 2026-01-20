# Tenant Onboarding System - Integration Guide

## Overview

The tenant onboarding system provides a **smart/dumb layer architecture** where:
- **Smart Layer (FastAPI)**: Orchestrates module dependencies, validates configurations, manages state
- **Dumb Layer (Odoo/ERPNext)**: Executes setup methods without requiring business logic

## Quick Start

### 1. Initiate Onboarding Flow

```bash
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "STARTUP",
    "company_name": "ACME Inc",
    "country": "KE",
    "currency": "KES"
  }'
```

**Response:**
```json
{
  "onboarding_id": "ONB-KE-25-X8M4Q",
  "status": "DRAFT",
  "template_name": "STARTUP",
  "modules": [
    {
      "module_id": "MOD-KE-25-001",
      "module_code": "accounting",
      "order": 1,
      "status": "PENDING"
    },
    {
      "module_id": "MOD-KE-25-002",
      "module_code": "inventory",
      "order": 2,
      "status": "PENDING"
    }
  ]
}
```

### 2. Begin Onboarding

```bash
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/begin \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "onboarding_id": "ONB-KE-25-X8M4Q",
  "status": "IN_PROGRESS",
  "current_step": 1,
  "total_steps": 4
}
```

### 3. Execute Steps

```bash
# Get current status
curl http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Execute next step
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/next-step \
  -H "Authorization: Bearer YOUR_TOKEN"

# Skip optional step
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/skip-step \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"step_number": 2}'
```

## System Templates

### STARTUP (3 modules)
Minimal setup for small businesses:
```
1. Accounting (Chart of Accounts, Company, Currency)
2. Inventory (Warehouse, Stock Items)
3. POS (Point of Sale - depends on Inventory + Accounting)
```

### SME (6 modules)
Mid-market setup:
```
STARTUP modules +
4. CRM (Customer relationships)
5. Purchasing (Vendor management)
6. Projects (Project tracking)
```

### ENTERPRISE (10 modules)
Full-featured setup:
```
SME modules +
7. Manufacturing (Production management)
8. HR (Payroll, Employees)
9. Fixed Assets (Asset tracking)
10. Website (eCommerce)
```

## Module Dependencies

The system automatically resolves dependencies using **topological sort**:

```
pos → [inventory, accounting]
manufacturing → [inventory, accounting]
crm → [contacts]
projects → [accounting]
hr → [accounting, payroll]
```

**Example**: If you select POS module, the system automatically schedules:
1. accounting (no deps)
2. inventory (no deps)
3. pos (after 1, 2)

## JSONB Configuration

### Module Configuration

Each onboarding stores configuration as JSONB:

```json
{
  "module_configurations": {
    "accounting": {
      "company_name": "ACME Inc",
      "country": "KE",
      "currency": "KES",
      "fiscal_year_start": "2025-01-01"
    },
    "inventory": {
      "warehouse_name": "Main Warehouse",
      "warehouse_code": "WH-01",
      "location": "Nairobi"
    },
    "pos": {
      "terminal_name": "POS-001",
      "invoice_series": "POS"
    }
  }
}
```

### Flexible Storage

Use the configuration editor to update any JSONB field before executing steps:

**Frontend Component:**
```typescript
<ConfigurationEditor
  config={onboarding.module_configurations}
  onChange={(newConfig) => {
    // Save to backend
    updateConfiguration(newConfig);
  }}
/>
```

**Backend Update:**
```bash
curl -X PATCH http://api.localhost/onboarding/tenants/YOUR_TENANT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "module_configurations": {
      "accounting": {
        "company_name": "Updated Name"
      }
    }
  }'
```

## State Machine

```
DRAFT
  ↓ (begin_onboarding)
IN_PROGRESS
  ↓ (all steps complete)
COMPLETED
  ↓ (if any step fails)
FAILED
```

**Step Statuses:**
- `PENDING`: Waiting to execute
- `IN_PROGRESS`: Currently executing
- `COMPLETED`: Executed successfully
- `FAILED`: Execution failed
- `SKIPPED`: User skipped (optional only)

## Contact Escalation Workflow

### 1. Create Contact

```bash
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "John Doe",
    "contact_type": "customer",
    "email": "john@example.com",
    "phone": "+254700000000"
  }'
```

### 2. Request Access

```bash
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/contacts/CONTACT_ID/request-access \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Accept & Create User Account

```bash
curl -X POST http://api.localhost/onboarding/tenants/YOUR_TENANT_ID/contacts/CONTACT_ID/accept-access \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePassword123",
    "full_name": "John Doe",
    "kyc_tier": "BASIC"
  }'
```

**Result:**
- Global User created (if not exists)
- Membership in tenant created
- UserRole assigned per contact type
- Email invitation sent

## API Endpoints

### Onboarding Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/onboarding/tenants/{tenantId}/start` | Initiate onboarding with template |
| POST | `/onboarding/tenants/{tenantId}/begin` | Start in-progress execution |
| POST | `/onboarding/tenants/{tenantId}/next-step` | Execute next pending step |
| GET | `/onboarding/tenants/{tenantId}/status` | Get current onboarding status |
| POST | `/onboarding/tenants/{tenantId}/skip-step` | Skip optional step |
| GET | `/onboarding/tenants/{tenantId}/templates` | List available templates |

### Contact Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/onboarding/tenants/{tenantId}/contacts` | Create contact |
| GET | `/onboarding/tenants/{tenantId}/contacts` | List contacts |
| POST | `/onboarding/tenants/{tenantId}/contacts/{contactId}/request-access` | Request user escalation |
| POST | `/onboarding/tenants/{tenantId}/contacts/{contactId}/accept-access` | Accept & create user |

## Database Schema

### contacts table
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  contact_code VARCHAR UNIQUE,
  contact_name VARCHAR NOT NULL,
  contact_type VARCHAR,  -- customer, supplier, partner
  email VARCHAR,
  phone VARCHAR,
  status VARCHAR,  -- ACTIVE, INACTIVE, PENDING_VERIFICATION
  escalation_requested BOOLEAN,
  escalation_user_id UUID REFERENCES users(id),
  kyc_tier VARCHAR,
  custom_metadata JSONB,  -- flexible custom fields
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### tenant_onboarding table
```sql
CREATE TABLE tenant_onboarding (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  status VARCHAR,  -- DRAFT, IN_PROGRESS, COMPLETED, FAILED
  template_name VARCHAR,
  module_configurations JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### onboarding_steps table
```sql
CREATE TABLE onboarding_steps (
  id UUID PRIMARY KEY,
  onboarding_id UUID REFERENCES tenant_onboarding(id),
  module_id UUID REFERENCES module_definitions(id),
  order INTEGER,
  status VARCHAR,  -- PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED
  execution_result JSONB,  -- {created_ids: {...}, errors: [...]}
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### module_definitions table
```sql
CREATE TABLE module_definitions (
  id UUID PRIMARY KEY,
  module_code VARCHAR UNIQUE,
  module_name VARCHAR,
  description VARCHAR,
  setup_method_name VARCHAR,
  is_mandatory BOOLEAN,
  custom_config JSONB
);
```

### module_dependencies table
```sql
CREATE TABLE module_dependencies (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES module_definitions(id),
  depends_on_module_id UUID REFERENCES module_definitions(id),
  dependency_type VARCHAR  -- hard, soft
);
```

## Smart Layer Implementation

### Orchestrator Responsibilities

1. **Dependency Resolution**
   - Topological sort of module graph
   - Detect circular dependencies
   - Schedule modules in correct order

2. **State Management**
   - Validate state transitions
   - Persist progress to database
   - Handle recovery from failures

3. **Configuration Validation**
   - Validate user inputs against schema
   - Merge defaults with overrides
   - Apply tenant-level constraints

4. **Error Handling**
   - Catch adapter exceptions
   - Retry failed steps (configurable)
   - Rollback on critical failures

### OnboardingOrchestrator Class

```python
class OnboardingOrchestrator:
    def initiate_onboarding(
        self, 
        tenant_id: str, 
        template_name: str, 
        config: dict
    ) -> TenantOnboarding:
        """Start new onboarding flow"""
        
    def execute_next_step(self, tenant_id: str) -> Optional[OnboardingStep]:
        """Execute next pending step"""
        
    def get_onboarding_status(self, tenant_id: str) -> dict:
        """Get detailed progress"""
        
    def _resolve_module_order(self, modules: List[str]) -> List[str]:
        """Topological sort of dependencies"""
        
    def _execute_step(self, step: OnboardingStep, adapter) -> dict:
        """Call appropriate adapter method"""
```

## Dumb Layer Implementation

### Adapter Pattern

Each ERP engine (Odoo/ERPNext) implements these methods:

```python
class OdooClientAdapter:
    def setup_step_company(self, config: dict) -> dict:
        """Create Company + Chart of Accounts"""
        return {
            "company_id": 1,
            "company_name": "...",
            "chart_of_accounts_code": "..."
        }
    
    def setup_step_warehouse(self, config: dict) -> dict:
        """Create Warehouse + Locations"""
        
    def setup_step_enable_module(self, config: dict) -> dict:
        """Enable module + Run setup wizards"""
        
    def setup_step_pos(self, config: dict) -> dict:
        """Configure POS-specific settings"""
```

## Frontend Integration

### OnboardingWizard Component

```typescript
<OnboardingWizard 
  tenantId={tenantId}
  onComplete={() => navigate('/dashboard')}
/>
```

**Features:**
- **Templates Tab**: Select STARTUP/SME/ENTERPRISE
- **Configuration Tab**: Edit JSONB module settings
- **Progress Tab**: Real-time step execution tracking
- **Auto-polling**: Refresh status every 2 seconds

### ContactManagement Component

```typescript
<ContactManagement tenantId={tenantId} />
```

**Features:**
- Create contacts (customer/supplier/partner)
- Filter by type
- Request escalation to user account
- Manage KYC tiers

## Monitoring & Logging

### Log Module Setup

```python
logger.info(
    f"Starting {module_code} setup",
    extra={
        "tenant_id": tenant_id,
        "onboarding_id": onboarding_id,
        "module_code": module_code,
        "step_number": step.order
    }
)
```

### Database Audit Trail

All steps are logged to `onboarding_steps.execution_result`:

```json
{
  "created_ids": {
    "company_id": 1,
    "warehouse_id": 10,
    "account_code": "1000"
  },
  "errors": [],
  "duration_seconds": 2.345,
  "timestamp": "2025-01-15T10:30:45Z"
}
```

## Next Steps

1. **Test the Flow**
   ```bash
   # Start with STARTUP template
   # Execute accounting → inventory → pos
   # Verify each step creates correct records
   ```

2. **Add Real ERP Calls**
   - Replace stubs in `odoo_client.py` with actual XML-RPC calls
   - Replace stubs in `erpnext_client.py` with actual REST calls
   - Add error handling and retry logic

3. **Implement Permission Scoping**
   - Filter `/erp/*` endpoints by user_type
   - Restrict CUSTOMER users from sensitive operations
   - Apply capability-based access control

4. **Enhanced Contact Workflow**
   - Email verification for escalation requests
   - Admin approval workflows
   - Bulk contact imports from CSV

5. **Monitoring Dashboard**
   - Real-time onboarding status for all tenants
   - Error rate tracking
   - Module setup duration metrics

## Troubleshooting

### Circular Dependency Error

**Symptom**: `CircularDependencyError: modules: [pos, inventory]`

**Cause**: Module A depends on B which depends on A

**Fix**: Update MODULE_DEPENDENCIES in `onboarding_service.py`:
```python
# Remove circular reference
MODULE_DEPENDENCIES = {
    "pos": ["inventory", "accounting"],  # ✓ Correct
    "inventory": ["accounting"],  # ✗ Don't add "pos"
}
```

### Step Execution Failure

**Symptom**: OnboardingStep status = FAILED

**Debug**: Check `execution_result` JSONB:
```bash
SELECT 
  step_id,
  status,
  execution_result->>'errors' as error_message,
  completed_at
FROM onboarding_steps
WHERE status = 'FAILED'
ORDER BY completed_at DESC;
```

### Adapter Connection Error

**Symptom**: `OdooClientAdapter: Failed to connect`

**Check**:
1. Odoo service is running: `docker-compose ps`
2. Tenant credentials in database
3. Network connectivity: `docker exec moran-api curl http://odoo:8069`

## Support

For issues or questions:
1. Check logs: `docker-compose logs moran-api`
2. Review API docs: `http://api.localhost/docs`
3. Test endpoints: Use provided curl examples
4. Database queries: Check onboarding tables directly
