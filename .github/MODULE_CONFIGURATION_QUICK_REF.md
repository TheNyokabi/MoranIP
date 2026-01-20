# Quick Reference - Module Configuration

## What's New?

✅ **Configure Module Endpoint** - `PATCH /iam/tenants/{id}/erp/modules/{code}/configure`
✅ **ModuleConfig Component** - Dialog-based UI for module configuration
✅ **Settings Integration** - Configure button in settings/modules page
✅ **Store Action** - `configureModule()` in ERP store

---

## Quick Start

### 1. Enable a Module (via UI)
- Go to Settings → ERP Modules
- Toggle switch on module to enable
- Click **Configure** button (appears when enabled)
- Fill in configuration fields
- Click **Save Configuration**

### 2. Enable a Module (via API)
```bash
curl -X POST http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"module_code": "accounting"}'
```

### 3. Configure a Module (via API)
```bash
curl -X PATCH http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules/accounting/configure \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_currency": "KES",
    "fiscal_year_start": "01-01",
    "enable_cash_management": true
  }'
```

---

## Available Module Configurations

### Accounting
- `company_currency` - KES, USD, EUR, GBP, INR
- `fiscal_year_start` - MM-DD format (e.g., "01-01")
- `enable_cash_management` - true/false

### Inventory
- `default_warehouse` - Warehouse name
- `enable_batch_tracking` - true/false
- `enable_serial_numbers` - true/false

### POS
- `default_pos_profile` - POS profile name
- `receipt_printer_enabled` - true/false
- `default_customer_group` - Customer group name

### CRM
- `enable_pipeline` - true/false
- `default_lead_source` - Lead source

### HR
- `company_code` - Company identifier
- `default_department` - Department name
- `enable_attendance` - true/false

---

## Testing

### Full Test Workflow
```bash
bash /tmp/test_configure_module.sh
```

### Individual Tests

**Get modules:**
```bash
curl http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Enable module:**
```bash
curl -X POST http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"module_code": "inventory"}'
```

**Configure module:**
```bash
curl -X PATCH http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules/inventory/configure \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "default_warehouse": "Main",
    "enable_batch_tracking": false,
    "enable_serial_numbers": true
  }'
```

**Get single module config:**
```bash
curl http://localhost:9000/iam/tenants/{TENANT_ID}/erp/modules \
  -H "Authorization: Bearer $TOKEN" | jq '.modules[] | select(.code == "accounting")'
```

---

## Files Changed

| File | Change |
|------|--------|
| `Backend/app/routers/erp_modules.py` | Added configure endpoint |
| `Backend/app/models/erp_modules.py` | Added `configured_at` field |
| `Frontend/src/store/erp-store.ts` | Added `configureModule` action |
| `Frontend/src/components/onboarding/ModuleConfig.tsx` | New component (created) |
| `Frontend/src/app/t/[tenantSlug]/settings/modules/page.tsx` | Integrated ModuleConfig |

---

## Common Errors & Fixes

### "Module must be enabled before configuration"
```
Status: 400
Fix: Enable the module first via POST endpoint
```

### "Module not found for this tenant"
```
Status: 404
Fix: Check module code spelling, enable module first
```

### "ERP not configured for this tenant"
```
Status: 400
Fix: Run setup first: POST /iam/tenants/{id}/erp/setup
```

---

## Database Query

Check module configurations in PostgreSQL:
```sql
SELECT 
  m.module_code,
  m.module_name,
  m.is_enabled,
  m.configuration,
  m.configured_at
FROM tenant_erp_modules m
WHERE m.tenant_id = '{TENANT_UUID}'
ORDER BY m.module_code;
```

---

## Notes

- Configuration is **merged** with existing config (not replaced)
- `configured_at` timestamp is updated when configuration changes
- Configurations are stored as **JSONB** (flexible schema)
- Each module can have **different configuration fields**
- Module must be **enabled** before it can be configured
