# API Migration Guide

## Overview

All backend routers have been standardized to use the `/api/{module}` path pattern with tenant context provided via the `X-Tenant-ID` header. This guide helps migrate existing frontend code to use the new API clients.

## Path Structure Changes

### Old Pattern (Deprecated)
```
/api/tenants/{tenant_id}/erp/{module}/{resource}
```

### New Pattern (Current)
```
/api/{module}/{resource}
```

**Tenant context is automatically handled via `X-Tenant-ID` header** - no need to include tenant_id in the URL.

## Module API Clients

All new API clients are located in `Frontend/src/lib/api/` and can be imported from `Frontend/src/lib/api/index.ts`:

### Available Clients

1. **accountingApi** (`api/accounting.ts`)
   - GL Entries, Journal Entries, Payment Entries
   - Accounts, Chart of Accounts, Companies
   - Sales Invoices

2. **crmApi** (`api/crm.ts`)
   - Contacts, Leads, Customers, Opportunities
   - Customer Groups, Territories, Sales Persons

3. **hrApi** (`api/hr.ts`)
   - Employees, Departments, Designations
   - Attendance, Leave Applications, Salary Structures

4. **manufacturingApi** (`api/manufacturing.ts`)
   - Work Centers, BOMs, Work Orders, Production Plans

5. **projectsApi** (`api/projects.ts`)
   - Projects, Project Templates, Tasks, Timesheets

6. **salesApi** (`api/sales.ts`)
   - Quotations, Sales Orders, Delivery Notes, Sales Invoices (non-POS)

7. **supportApi** (`api/support.ts`)
   - Issues/Tickets

8. **assetsApi** (`api/assets.ts`)
   - Assets, Asset Maintenance

9. **qualityApi** (`api/quality.ts`)
   - Quality Inspections, Quality Tests

10. **inventoryApi** (`api/inventory.ts`) - Already exists
11. **purchasesApi** (`api/purchases.ts`) - Already exists
12. **posApi** (`api/pos.ts`) - Already exists

## Migration Examples

### Example 1: Accounting - List GL Entries

**Old Code:**
```typescript
import { moduleApis } from '@/lib/api-modules';

const result = await moduleApis.accounting.listGLEntries(tenantId);
```

**New Code:**
```typescript
import { accountingApi } from '@/lib/api';

const result = await accountingApi.listGLEntries();
// Returns: { data: GLEntry[] }
```

### Example 2: CRM - Create Contact

**Old Code:**
```typescript
import { moduleApis } from '@/lib/api-modules';

const result = await moduleApis.crm.createContact(tenantId, contactData);
```

**New Code:**
```typescript
import { crmApi } from '@/lib/api';

const result = await crmApi.createContact(contactData);
// Returns: { data: Contact }
```

### Example 3: HR - Get Employee

**Old Code:**
```typescript
import { moduleApis } from '@/lib/api-modules';

const result = await moduleApis.hr.getEmployee(tenantId, employeeName);
```

**New Code:**
```typescript
import { hrApi } from '@/lib/api';

const result = await hrApi.getEmployee(employeeName);
// Returns: { data: Employee }
```

## Response Format

All endpoints now return responses in a consistent format:

### Single Resource
```typescript
{
  data: {
    name: "...",
    // ... resource fields
  }
}
```

### List Resources
```typescript
{
  data: [
    { name: "...", ... },
    { name: "...", ... }
  ]
}
```

### Error Responses
```typescript
{
  error: {
    message: "Error message",
    type: "error_type",
    code: 400
  }
}
```

## Tenant Context

The `X-Tenant-ID` header is automatically added by `apiFetch` in `Frontend/src/lib/api.ts`. The tenant ID is retrieved from:
1. `useAuthStore.currentTenant.id` (if available)
2. URL path `/w/{workspace_slug}` (if in workspace route)
3. Endpoint path `/tenants/{tenant_id}/...` (legacy support)

**No manual tenant ID handling required** in most cases.

## TypeScript Types

All API clients include TypeScript interfaces for request/response types:

```typescript
import { accountingApi, type GLEntry, type JournalEntry } from '@/lib/api';

const entries: GLEntry[] = (await accountingApi.listGLEntries()).data;
```

## Backward Compatibility

The old `api-modules.ts` file still exists for backward compatibility but is **deprecated**. All new code should use the new API clients from `Frontend/src/lib/api/`.

## Testing

When migrating, test:
1. ✅ Response format matches `{ data: ... }`
2. ✅ Tenant context is correctly set via header
3. ✅ Error handling works correctly
4. ✅ TypeScript types are correct

## Questions?

If you encounter issues during migration:
1. Check that `X-Tenant-ID` header is being sent (check Network tab)
2. Verify the endpoint path matches `/api/{module}/...`
3. Ensure response is wrapped in `{ data: ... }` format
4. Check browser console for any errors
