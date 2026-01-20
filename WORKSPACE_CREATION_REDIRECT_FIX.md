# Workspace Creation Redirect and Settings Visibility Fix

## Issues Fixed

### 1. **Redirect to Global Dashboard Instead of Tenant Dashboard**
**Problem**: After successfully creating a workspace, clicking "Go to Dashboard" redirected to `/dashboard` (global dashboard) instead of `/w/{tenantSlug}` (tenant dashboard).

**Root Cause**: 
- The redirect logic in `workspaces/page.tsx` was hardcoded to `/dashboard`
- Tenant context was not being set before navigation
- Newly created tenant was not added to `availableTenants` list

**Solution**:
- Updated auto-redirect (line 93) to navigate to `/w/{tenantSlug}` instead of `/dashboard`
- Updated "Go to Dashboard" button (line 204) to navigate to tenant dashboard
- Set tenant context in `useAuthStore` before redirecting
- Add newly created tenant to `availableTenants` list

### 2. **Default Settings Not Visible (Warehouses, etc.)**
**Problem**: After creating a workspace, default settings like warehouses were not visible in the tenant dashboard.

**Root Cause**:
- API client (`api.ts`) only included `X-Tenant-ID` header for `/erpnext/` and `/erp/` endpoints
- Settings endpoints (`/api/settings/tenant`) require `X-Tenant-ID` header when using identity tokens
- Direct API client (`api/client.ts`) used by inventory functions didn't include `X-Tenant-ID` header

**Solution**:
- Extended `apiFetch` in `api.ts` to include `X-Tenant-ID` header for:
  - `/settings/`
  - `/inventory/`
  - `/pos/`
  - `/onboarding/`
  - `/provisioning/`
- Updated `getAuthHeaders` in `api/client.ts` to include `X-Tenant-ID` header for tenant-scoped endpoints
- Added logic to retrieve tenant ID from `useAuthStore.currentTenant` or URL path

## Changes Made

### 1. `Frontend/src/app/(global)/admin/workspaces/page.tsx`
- **Line 84-95**: Set tenant context and add to `availableTenants` before auto-redirect
- **Line 196-220**: Updated "Go to Dashboard" button to set tenant context and navigate to `/w/{tenantSlug}`

### 2. `Frontend/src/lib/api.ts`
- **Line 126-129**: Extended `X-Tenant-ID` header inclusion to cover settings, inventory, pos, onboarding, and provisioning endpoints

### 3. `Frontend/src/lib/api/client.ts`
- **Line 22-58**: Updated `getAuthHeaders` to include `X-Tenant-ID` header for tenant-scoped endpoints
- **Line 83-107**: Updated `secureFetch` to pass endpoint to `getAuthHeaders` for tenant context detection

## Testing Checklist

- [x] Workspace creation redirects to tenant dashboard (`/w/{tenantSlug}`)
- [x] "Go to Dashboard" button navigates to tenant dashboard
- [x] Tenant context is set before navigation
- [x] Newly created tenant appears in `availableTenants` list
- [x] Settings API calls include `X-Tenant-ID` header
- [x] Inventory API calls include `X-Tenant-ID` header
- [x] Default settings (warehouses, etc.) are visible after workspace creation

## Flow After Fix

1. User creates workspace → `createTenant` API call succeeds
2. Tenant context is set in `useAuthStore`:
   - `currentTenant` = newly created tenant
   - `availableTenants` = [...existing, new tenant]
3. Auto-redirect (after 3s) → `/w/{tenantSlug}`
4. Tenant dashboard loads:
   - Layout sets tenant context from URL
   - Settings API call includes `X-Tenant-ID` header
   - Inventory API calls include `X-Tenant-ID` header
   - Default settings (warehouses, etc.) are fetched and displayed

## Related Files

- `Frontend/src/app/(global)/admin/workspaces/page.tsx` - Workspace creation page
- `Frontend/src/app/w/[tenantSlug]/page.tsx` - Tenant dashboard
- `Frontend/src/lib/api.ts` - Main API client
- `Frontend/src/lib/api/client.ts` - Direct API client (used by inventory)
- `Frontend/src/store/auth-store.ts` - Auth state management
- `Backend/app/routers/settings.py` - Settings API endpoint
- `Backend/app/routers/inventory.py` - Inventory API endpoints
