# Frontend-Backend-ERPNext Integration Audit

**Date**: 2026-01-12  
**Scope**: End-to-end integration audit of Frontend → Backend → ERPNext data flow  
**Purpose**: Identify gaps, mismatches, and issues preventing end-to-end functionality

---

## Executive Summary

This audit identifies **critical routing mismatches** between the frontend API client and backend routers that prevent end-to-end functionality. The primary issue is that backend routers expect tenant_id in the URL path (`/api/tenants/{tenant_id}/erp/inventory`), while the frontend API client calls simplified paths (`/inventory/items`) and relies on `X-Tenant-ID` headers.

**Key Findings**:
1. **CRITICAL**: Path structure mismatch between frontend and backend
2. **HIGH**: Response format inconsistencies
3. **MEDIUM**: Missing endpoint mappings
4. **MEDIUM**: Authentication/tenant context handling discrepancies

---

## 1. Critical Path Structure Mismatch

### 1.1 Inventory Router

**Backend Route Structure**:
- Router prefix: `/tenants/{tenant_id}/erp/inventory`
- Mounted at: `/api`
- **Full path**: `/api/tenants/{tenant_id}/erp/inventory/items`

**Frontend API Client**:
- Calls: `/inventory/items`
- Relies on: `X-Tenant-ID` header (via `api/client.ts`)

**Gap**: 
- Backend router **requires** `{tenant_id}` in the URL path (FastAPI path parameter)
- Frontend API client **does not include** tenant_id in the path
- Frontend uses `X-Tenant-ID` header, but FastAPI path parameters must be in the URL

**Impact**: ❌ **ALL inventory API calls will fail with 404 or routing errors**

**Files Affected**:
- `Backend/app/routers/inventory.py` - Router prefix includes `{tenant_id}`
- `Frontend/src/lib/api/inventory.ts` - All endpoints call `/inventory/*` paths
- `Frontend/src/lib/api/client.ts` - Adds `X-Tenant-ID` header but path doesn't match

### 1.2 POS Router

**Backend Route Structure**:
- Router prefix: `/pos` (no tenant_id in path)
- Mounted at: Root (no `/api` prefix)
- **Full path**: `/pos/items`

**Frontend API Client**:
- Calls: `/pos/items` (matches!)

**Gap**: ⚠️ **POS router doesn't require tenant_id in path, but uses `require_tenant_access` dependency**
- This works because `require_tenant_access` gets tenant_id from `X-Tenant-ID` header
- However, this is inconsistent with inventory router pattern

**Impact**: ✅ **POS endpoints work** (but inconsistent with inventory pattern)

### 1.3 Other Routers with Path Tenant ID

The following routers use the same pattern as inventory (require tenant_id in path):

- `accounting.py`: `/tenants/{tenant_id}/erp/accounting`
- `crm.py`: `/tenants/{tenant_id}/erp/crm`
- `hr.py`: `/tenants/{tenant_id}/erp/hr`
- `manufacturing.py`: `/tenants/{tenant_id}/erp/manufacturing`
- `projects.py`: `/tenants/{tenant_id}/erp/projects`

**Gap**: These routers likely have the same path mismatch issue if frontend clients exist for them.

---

## 2. Response Format Inconsistencies

### 2.1 Inventory Endpoints

**Backend Response Formats**:
- `list_items`: `{"items": [...]}` ✅
- `create_item`: Raw ERPNext response (varies)
- `get_item`: Raw ERPNext response (varies)
- `update_item`: Raw ERPNext response (varies)
- `delete_item`: `{"message": "..."}`

**Frontend Expected Formats** (from `api/inventory.ts`):
- `getItems`: Expects `{items: Item[]}` ✅
- `getItem`: Expects `{data: Item}` ❌ Backend returns raw response
- `createItem`: Expects `{data: Item}` ❌ Backend returns raw response
- `updateItem`: Expects `{data: Item}` ❌ Backend returns raw response
- `deleteItem`: Expects `void` ✅ (but backend returns `{"message": "..."}`)

**Gap**: Frontend expects wrapped responses (`{data: ...}`) for single-item operations, but backend returns raw ERPNext responses.

**Impact**: ⚠️ **Type mismatches and potential runtime errors**

### 2.2 POS Endpoints

**Backend Response Formats**:
- `list_items`: `{"items": [...]}` ✅
- `list_customers`: `{"data": [...]}` ⚠️ (should be `{"customers": [...]}`?)
- `list_invoices`: `{"data": [...]}` ⚠️ (should be `{"invoices": [...]}`?)

**Frontend Expected Formats** (from `api/pos.ts`):
- Uses `/pos/*` endpoints which seem to work
- But response format expectations need verification

---

## 3. Missing Endpoint Mappings

### 3.1 Inventory Endpoints

**Backend Has** (17 endpoints):
- ✅ `GET /items` - list_items
- ✅ `POST /items` - create_item
- ✅ `GET /items/{item_code}` - get_item
- ✅ `PUT /items/{item_code}` - update_item
- ✅ `DELETE /items/{item_code}` - delete_item
- ✅ `GET /warehouses` - list_warehouses
- ✅ `POST /warehouses` - create_warehouse
- ✅ `GET /warehouses/{warehouse_name}` - get_warehouse
- ✅ `PUT /warehouses/{warehouse_name}` - update_warehouse
- ✅ `DELETE /warehouses/{warehouse_name}` - delete_warehouse
- ✅ `POST /stock-entries` - create_stock_entry
- ✅ `GET /stock-entries` - list_stock_entries
- ✅ `GET /stock-entries/{entry_name}` - get_stock_entry
- ✅ `PUT /stock-entries/{entry_name}` - update_stock_entry
- ✅ `DELETE /stock-entries/{entry_name}` - delete_stock_entry
- ❓ `POST /stock-reconciliations` - create_stock_reconciliation (backend might not have this)
- ❓ `GET /stock-balance` - get_stock_balance (backend might not have this)

**Frontend Has** (13 functions):
- ✅ `getItems` → `GET /inventory/items`
- ✅ `getItem` → `GET /inventory/items/{code}`
- ✅ `createItem` → `POST /inventory/items`
- ✅ `updateItem` → `PUT /inventory/items/{code}`
- ✅ `deleteItem` → `DELETE /inventory/items/{code}`
- ✅ `getWarehouses` → `GET /inventory/warehouses`
- ✅ `getWarehouse` → `GET /inventory/warehouses/{name}`
- ✅ `createWarehouse` → `POST /inventory/warehouses`
- ✅ `updateWarehouse` → `PUT /inventory/warehouses/{name}`
- ✅ `createStockEntry` → `POST /inventory/stock-entries`
- ✅ `getStockEntries` → `GET /inventory/stock-entries`
- ✅ `createStockReconciliation` → `POST /inventory/stock-reconciliations`
- ✅ `getStockBalance` → `GET /inventory/stock-balance`

**Gap**: Frontend expects `/inventory/stock-reconciliations` and `/inventory/stock-balance` endpoints, but these might not exist in the backend inventory router. Need to verify.

**Missing**: Frontend doesn't have functions for:
- `getStockEntry` (GET single stock entry)
- `updateStockEntry` (PUT stock entry)
- `deleteStockEntry` (DELETE stock entry)
- `deleteWarehouse` (DELETE warehouse)

---

## 4. Authentication & Tenant Context Flow

### 4.1 Tenant Context Handling

**Backend Pattern** (`require_tenant_access`):
1. Tries to get tenant_id from JWT token (`payload.tenant_id`)
2. Falls back to `X-Tenant-ID` header
3. Resolves tenant code/slug to UUID if needed
4. Verifies user membership in tenant
5. Returns tenant UUID

**Frontend Pattern** (`api/client.ts`):
1. Gets tenant_id from auth store (`currentTenant?.id`)
2. Falls back to URL path parsing (`/w/{tenantSlug}`)
3. Resolves tenant slug to tenant object
4. Adds `X-Tenant-ID` header

**Gap**: 
- Frontend adds `X-Tenant-ID` header ✅
- But path structure mismatch means FastAPI can't route the request ❌

### 4.2 Path Parameter vs Header Dependency

**Issue**: Backend routers with `{tenant_id}` in path prefix require the tenant_id to be in the URL, but:
- `require_tenant_access` dependency gets tenant_id from header/token
- FastAPI path parameters must be in the URL path
- These are conflicting requirements

**Example**:
```python
# Backend router
router = APIRouter(prefix="/tenants/{tenant_id}/erp/inventory")

@router.get("/items")
async def list_items(
    tenant_id: str = Depends(require_tenant_access),  # Gets from header
    ...
):
```

If the URL is `/api/tenants/{tenant_id}/erp/inventory/items`, FastAPI will extract `{tenant_id}` from the path and try to inject it into the dependency. But `require_tenant_access` doesn't have a path parameter - it reads from headers.

**Resolution Options**:
1. **Change backend routers** to NOT include `{tenant_id}` in path prefix (like POS router)
2. **Change frontend API client** to include tenant_id in all paths
3. **Add middleware/proxy** to rewrite paths from `/inventory/*` to `/tenants/{tenant_id}/erp/inventory/*`

---

## 5. Direct ERPNext API Usage

### 5.1 Frontend Using ERPNext API Directly

**Location**: `Frontend/src/app/w/[tenantSlug]/inventory/page.tsx`

**Usage**:
```typescript
erpNextApi.listResource<InventoryItem>(token, "Item", {...})
erpNextApi.listResource<POSWarehouse>(token, "Warehouse", {...})
erpNextApi.listResource<StockEntry>(token, "Stock Entry", {...})
```

**Gap**: This bypasses the inventory router entirely and calls ERPNext directly via `/erpnext/resource/*` endpoints.

**Impact**: 
- ✅ **Works** (bypasses path mismatch issue)
- ⚠️ **Inconsistent** with other pages that use `api/inventory.ts`
- ⚠️ **Bypasses** backend validation/transformation layer

---

## 6. Recommendations

### Priority 1: Fix Path Structure Mismatch

**Option A: Remove tenant_id from backend router paths** (Recommended)
- Change inventory router prefix from `/tenants/{tenant_id}/erp/inventory` to `/api/inventory`
- Keep `require_tenant_access` dependency (gets tenant_id from header)
- This matches the POS router pattern
- **Pros**: Minimal frontend changes, consistent pattern
- **Cons**: Requires backend changes to multiple routers

**Option B: Add tenant_id to frontend API paths**
- Change frontend API client to include tenant_id in paths
- Example: `/inventory/items` → `/api/tenants/${tenantId}/erp/inventory/items`
- **Pros**: Matches current backend structure
- **Cons**: Requires significant frontend changes, tenant_id must be available in all API calls

**Option C: Add path rewriting middleware**
- Add middleware/proxy layer to rewrite `/inventory/*` → `/tenants/{tenant_id}/erp/inventory/*`
- Extract tenant_id from header and inject into path
- **Pros**: Minimal changes to existing code
- **Cons**: Adds complexity, potential for routing issues

### Priority 2: Standardize Response Formats

- Wrap all single-item responses in `{data: ...}` format
- Ensure list responses use consistent keys (`{items: [...]}`, `{warehouses: [...]}`, etc.)
- Document response format contracts

### Priority 3: Complete Endpoint Mappings

- Add missing frontend functions for stock entry operations
- Verify and implement `/stock-reconciliations` and `/stock-balance` endpoints
- Add warehouse DELETE endpoint to frontend

### Priority 4: Consolidate API Usage Patterns

- Decide on using inventory router vs direct ERPNext API
- If using inventory router, update all pages to use `api/inventory.ts`
- If using direct ERPNext API, document the pattern and create helpers

---

## 7. Testing Checklist

After implementing fixes, verify:

- [ ] Inventory API calls work end-to-end (frontend → backend → ERPNext)
- [ ] POS API calls work end-to-end
- [ ] Tenant context is correctly passed via headers
- [ ] Response formats match frontend expectations
- [ ] Error handling works correctly
- [ ] Authentication/authorization works correctly
- [ ] All CRUD operations work (create, read, update, delete)

---

## 8. Files Requiring Changes

### Backend (if Option A recommended):
- `Backend/app/routers/inventory.py` - Remove `{tenant_id}` from prefix
- `Backend/app/routers/accounting.py` - Remove `{tenant_id}` from prefix
- `Backend/app/routers/crm.py` - Remove `{tenant_id}` from prefix
- `Backend/app/routers/hr.py` - Remove `{tenant_id}` from prefix
- `Backend/app/routers/manufacturing.py` - Remove `{tenant_id}` from prefix
- `Backend/app/routers/projects.py` - Remove `{tenant_id}` from prefix
- `Backend/app/main.py` - Update router mounting (add `/api` prefix if needed)

### Frontend (if Option B recommended):
- `Frontend/src/lib/api/inventory.ts` - Update all paths to include tenant_id
- `Frontend/src/lib/api/client.ts` - Add tenant_id to path construction
- `Frontend/src/lib/api/pos.ts` - Verify paths match backend
- All pages using inventory API - Verify tenant_id is available

---

## 9. Conclusion

The primary blocker for end-to-end functionality is the **path structure mismatch** between frontend and backend. The backend routers require tenant_id in the URL path, but the frontend API client calls simplified paths and relies on headers.

**Recommended approach**: Remove `{tenant_id}` from backend router paths (Option A), as this:
1. Matches the working POS router pattern
2. Requires minimal frontend changes
3. Keeps tenant context handling via headers (already implemented)
4. Is more RESTful (tenant context via headers, not path)

This change should be prioritized as it blocks all inventory-related functionality.
