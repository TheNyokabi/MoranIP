# Tenant Context Management - Implementation Summary

## Overview
This document describes how tenant context is managed when users navigate between the global dashboard and workspace-specific pages.

## Key Concepts

### 1. **Identity Token vs Tenant-Scoped Token**
- **Identity Token**: Issued on login, contains user identity only (no tenant context)
- **Tenant-Scoped Token**: Issued when selecting a workspace, contains user identity + tenant context

### 2. **Tenant Context Storage**
- Frontend: Stored in `useAuthStore.currentTenant` (Zustand store)
- Backend: Extracted from JWT payload `tenant_id` OR `X-Tenant-ID` header

## Implementation Details

### Frontend: Global Dashboard (`/dashboard`)
**File**: `Frontend/src/app/(global)/dashboard/page.tsx`

**Behavior**:
- When the global dashboard mounts, it **clears** the `currentTenant` from the auth store
- This ensures no tenant context is active when viewing the global dashboard
- Users can see all their workspaces without being bound to a specific tenant

**Code**:
```typescript
useEffect(() => {
    const { currentTenant } = useAuthStore.getState();
    // Only clear if there's a current tenant (avoid unnecessary state updates)
    if (currentTenant) {
        useAuthStore.setState({ currentTenant: null });
    }
}, []);
```

### Frontend: Workspace Entry (`/w/{workspace_slug}`)
**File**: `Frontend/src/app/w/[tenantSlug]/layout.tsx`

**Behavior**:
- When entering a workspace, it **sets** the `currentTenant` in the auth store
- Finds the tenant by slug from `availableTenants`
- Only updates if the tenant is different from the current one (optimization)

**Code**:
```typescript
useEffect(() => {
    const { availableTenants, currentTenant } = useAuthStore.getState();
    const tenant = findTenantBySlug(params.tenantSlug, availableTenants);
    
    // Only update if tenant is found and different from current
    if (tenant && (!currentTenant || currentTenant.id !== tenant.id)) {
        useAuthStore.setState({ currentTenant: tenant });
    }
}, [params.tenantSlug]);
```

### Frontend: Navigation to Workspace
**File**: `Frontend/src/components/dashboard/action-dashboard.tsx`

**Behavior**:
- When clicking a workspace card, it **sets** the `currentTenant` **before** navigation
- This ensures the tenant context is available immediately when the workspace page loads
- Prevents race conditions where API calls might be made before the layout effect runs

**Code**:
```typescript
const handleNavigate = (tenant: ExtendedTenant) => {
    // Set current tenant before navigation to ensure context is available immediately
    useAuthStore.setState({
        currentTenant: {
            id: tenant.id,
            name: tenant.name,
            code: tenant.code || tenant.id,
            engine: tenant.engine || 'erpnext',
        }
    });

    const slug = getTenantSlug(tenant);
    router.push(tenant.role === 'CASHIER' ? `/w/${slug}/pos` : `/w/${slug}`);
};
```

### Frontend: API Client
**File**: `Frontend/src/lib/api.ts`

**Behavior**:
- Automatically retrieves `tenantId` from `useAuthStore.currentTenant`
- Falls back to extracting tenant from URL path if not in store
- Adds `X-Tenant-ID` header for ERPNext/ERP endpoints

**Code**:
```typescript
// Get tenant ID from auth store (currentTenant) or from URL if in workspace context
tenantId = authState.currentTenant?.id || null;

// If no tenant in store, try to get from URL (for /w/{workspace_slug} routes)
if (!tenantId && isBrowser) {
    const pathMatch = window.location.pathname.match(/^\/w\/([^\/]+)/);
    if (pathMatch) {
        const tenant = availableTenants?.find(t => t.code === pathMatch[1] || t.id === pathMatch[1]);
        if (tenant) {
            tenantId = tenant.id;
        }
    }
}

// Add tenant ID header for ERPNext and other tenant-scoped endpoints
if (tenantId && (endpoint.includes('/erpnext/') || endpoint.includes('/erp/'))) {
    (headers as Record<string, string>)['X-Tenant-ID'] = tenantId;
}
```

### Backend: ERPNext Permission Check
**File**: `Backend/app/routers/erpnext.py`

**Behavior**:
- Accepts `tenant_id` from JWT payload OR `X-Tenant-ID` header
- When `tenant_id` comes from header (identity token), **verifies tenant membership** in database
- SUPER_ADMIN users bypass membership check
- Then checks RBAC capabilities for the specific DocType and action

**Code**:
```python
tenant_id = payload.get("tenant_id")
tenant_id_from_header = False

# If tenant_id not in payload, try to get from headers (for identity tokens)
if not tenant_id and request:
    tenant_id = request.headers.get("X-Tenant-ID")
    tenant_id_from_header = bool(tenant_id)

# If tenant_id came from header (identity token), verify membership
if tenant_id_from_header and db and user_id:
    if not is_super_admin:
        # Check membership in database
        membership = db.execute(stmt).scalar_one_or_none()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this tenant")
```

## Flow Diagram

```
┌─────────────────┐
│  User Logs In   │
│ (Identity Token)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Global Dashboard│
│ currentTenant:  │
│     null        │
└────────┬────────┘
         │
         │ User clicks workspace
         ▼
┌─────────────────┐
│  handleNavigate │
│ Sets currentTenant│
│  BEFORE nav     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Workspace Layout│
│ Verifies & sets │
│ currentTenant   │
└────────┬────────┘
         │
         │ API calls include
         │ X-Tenant-ID header
         ▼
┌─────────────────┐
│  Backend API    │
│ Verifies membership│
│ Checks capabilities│
└─────────────────┘
```

## Testing Checklist

- [x] Global dashboard clears tenant context on mount
- [x] Workspace layout sets tenant context on mount
- [x] Navigation sets tenant context before routing
- [x] API client includes `X-Tenant-ID` header for ERPNext endpoints
- [x] Backend verifies tenant membership when using `X-Tenant-ID` header
- [x] SUPER_ADMIN users bypass membership check
- [x] Error handling for invalid tenant IDs

## Edge Cases Handled

1. **Direct URL Access**: If user navigates directly to `/w/{slug}`, the layout effect will set the tenant context
2. **Race Conditions**: `handleNavigate` sets tenant context before navigation to prevent API calls from failing
3. **Missing Tenant**: If tenant is not found by slug, the context remains unchanged (no error thrown)
4. **Identity Token**: Backend correctly handles identity tokens by verifying membership when `X-Tenant-ID` header is provided
5. **SUPER_ADMIN**: System-wide admins bypass membership checks but still need valid tenant ID

## Known Limitations

1. **No Real-Time Sync**: If tenant is deleted/disabled while user is viewing it, the frontend won't know until next refresh
2. **Multiple Tabs**: Each tab maintains its own tenant context (by design, using Zustand persist)
3. **Token Expiry**: If token expires, user will need to re-authenticate (standard behavior)

## Future Improvements

1. **WebSocket Updates**: Real-time tenant status updates
2. **Token Refresh**: Automatic token refresh before expiry
3. **Context Validation**: Periodic validation of tenant context against backend
4. **Audit Logging**: Log tenant context switches for security auditing
