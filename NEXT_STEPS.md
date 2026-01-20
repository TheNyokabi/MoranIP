# Next Steps - Workspace Entry & Tenant Context

## Critical Missing Piece: Tenant Context Establishment

When a user clicks a workspace from the dashboard, they currently have an **identity token** (no tenant context). The workspace pages need a **tenant-scoped token** to function.

## Required Implementation Steps

### 1. **Backend: Token Exchange Endpoint** (Priority: HIGH)
Create an endpoint to exchange identity token for tenant-scoped token:

**Endpoint:** `POST /auth/enter-workspace`
```python
@router.post("/enter-workspace")
def enter_workspace(
    req: EnterWorkspaceRequest,  # { tenant_id: str }
    current_user: dict = Depends(get_current_user),  # Uses identity token
    db: Session = Depends(get_db)
):
    """
    Exchange identity token for tenant-scoped token.
    Verifies user membership and returns tenant-scoped JWT.
    """
    # 1. Verify user has identity token (scope="identity")
    # 2. Verify user is member of requested tenant
    # 3. Create tenant-scoped token
    # 4. Return new token
```

### 2. **Frontend: Workspace Entry Flow** (Priority: HIGH)
Update workspace entry to exchange tokens:

**Location:** `Frontend/src/app/w/[tenantSlug]/layout.tsx` or middleware

```typescript
// When user navigates to /w/{slug}:
// 1. Check if current token is identity token
// 2. If yes, call /auth/enter-workspace with tenant_id
// 3. Store new tenant-scoped token
// 4. Update auth store
// 5. Continue to workspace page
```

### 3. **Frontend: Auth Store Update** (Priority: HIGH)
Add method to exchange tokens:

```typescript
enterWorkspace: async (tenantId: string) => {
    // Exchange identity token for tenant-scoped token
    const response = await authApi.enterWorkspace(tenantId)
    // Update token in store
    // Set currentTenant
}
```

### 4. **Backend: Identity Token Validation** (Priority: MEDIUM)
Update `get_current_user` dependency to:
- Accept identity tokens (scope="identity")
- Allow access to global endpoints (dashboard, workspace list)
- Require tenant-scoped tokens for workspace-specific endpoints

### 5. **Join Workspace Feature** (Priority: MEDIUM)
Implement the "Join Workspace" functionality:
- Join via invite link
- Join via workspace code
- Handle pending approval states

### 6. **Engine Health Checks** (Priority: LOW)
Replace placeholder engine status with actual health checks:
- Call engine health endpoints
- Cache results (30-60s refresh)
- Update workspace cards with real status

### 7. **Pending Invitations** (Priority: LOW)
Add endpoint to fetch pending invitations:
- `GET /auth/me/invitations`
- Show in dashboard empty state
- Allow accepting/rejecting invitations

## Implementation Order

1. ✅ **DONE:** Simplified login flow
2. ✅ **DONE:** Dashboard with primary actions
3. ✅ **DONE:** Workspace status indicators (placeholder)
4. ✅ **DONE:** Route changes (/t/ → /w/)
5. ✅ **DONE:** Enhanced empty states
6. 🔴 **TODO:** Token exchange endpoint (CRITICAL)
7. 🔴 **TODO:** Workspace entry flow (CRITICAL)
8. 🟡 **TODO:** Join workspace feature
9. 🟡 **TODO:** Real engine health checks
10. 🟡 **TODO:** Pending invitations

## Testing Checklist

- [ ] Login redirects to /dashboard
- [ ] Dashboard shows all user workspaces
- [ ] Clicking workspace exchanges token
- [ ] Workspace pages load with tenant context
- [ ] API calls from workspace use tenant-scoped token
- [ ] Switching workspaces updates token
- [ ] Logout clears all tokens

## Notes

- Identity tokens should have longer expiry (7 days) for dashboard access
- Tenant-scoped tokens should have shorter expiry (1 hour) for security
- Consider refresh token mechanism for long sessions
- Workspace entry should be seamless - user shouldn't notice token exchange
