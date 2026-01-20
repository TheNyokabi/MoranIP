# Provisioning Implementation Verification Checklist

## Pre-Deployment Checks

### Database Migration
- [ ] Run `alembic upgrade head` in Backend directory
- [ ] Verify migration `add_provisioning_fields` applied successfully
- [ ] Check that `tenant_onboarding` table has new columns:
  - [ ] `provisioning_type`
  - [ ] `provisioning_config`
  - [ ] `provisioning_steps`
  - [ ] `provisioning_metadata`
- [ ] Check that `tenants` table has new columns:
  - [ ] `provisioning_status`
  - [ ] `provisioned_at`
  - [ ] `provisioning_error`
- [ ] Verify indexes created:
  - [ ] `idx_tenant_onboarding_provisioning_status`
  - [ ] `idx_tenants_provisioning_status`

### Code Verification
- [ ] All imports resolve correctly
- [ ] No linter errors
- [ ] All services can be imported
- [ ] Router registered in `main.py`

## API Endpoint Testing

### 1. Engine Health Check
```bash
curl -X POST http://localhost:9000/auth/engine-health \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"tenant_ids": ["{tenant_id}"]}'
```
- [ ] Returns health status for tenant
- [ ] Caching works (second call faster)
- [ ] Handles offline engine gracefully

### 2. Start Provisioning
```bash
curl -X POST http://localhost:9000/api/provisioning/tenants/{tenant_id}/start \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"include_demo_data": false, "pos_store_enabled": true}'
```
- [ ] Returns provisioning status
- [ ] Status is "IN_PROGRESS" or "COMPLETED"
- [ ] Progress percentage is valid (0-100)
- [ ] Steps completed count is accurate

### 3. Get Provisioning Status
```bash
curl -X GET http://localhost:9000/api/provisioning/tenants/{tenant_id}/status \
  -H "Authorization: Bearer {token}"
```
- [ ] Returns current status
- [ ] Progress updates correctly
- [ ] Current step is accurate
- [ ] Errors array populated if failures occur

### 4. Get Provisioning Logs
```bash
curl -X GET http://localhost:9000/api/provisioning/tenants/{tenant_id}/logs \
  -H "Authorization: Bearer {token}"
```
- [ ] Returns array of log entries
- [ ] Each log has step, status, message
- [ ] Duration included for completed steps

### 5. Retry Provisioning
```bash
curl -X POST http://localhost:9000/api/provisioning/tenants/{tenant_id}/retry \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step": "step_3_chart_of_accounts"}'
```
- [ ] Retries specified step
- [ ] Updates status correctly
- [ ] Handles already-completed steps gracefully

## End-to-End Flow Testing

### Test Case 1: Happy Path
1. [ ] Create workspace via `/iam/tenants`
2. [ ] Verify provisioning starts automatically
3. [ ] Poll status endpoint every 2s
4. [ ] Verify all steps complete:
   - [ ] Step 0: Engine check
   - [ ] Step 2: Company created
   - [ ] Step 3: Chart of accounts imported
   - [ ] Step 4: Warehouses created
   - [ ] Step 5: Settings configured
   - [ ] Step 7: Customer created
   - [ ] Step 8: POS Profile created
   - [ ] Step 9: POS Session opened
5. [ ] Verify final status is "COMPLETED"
6. [ ] Verify tenant.provisioning_status is "PROVISIONED"

### Test Case 2: Engine Offline
1. [ ] Stop ERPNext/Odoo
2. [ ] Create workspace
3. [ ] Verify provisioning status is "NOT_PROVISIONED"
4. [ ] Verify error message indicates engine offline
5. [ ] Start ERPNext/Odoo
6. [ ] Manually trigger provisioning via API
7. [ ] Verify provisioning completes

### Test Case 3: Critical Step Failure
1. [ ] Create workspace
2. [ ] Simulate chart of accounts import failure
3. [ ] Verify provisioning status is "FAILED"
4. [ ] Verify error_step is "step_3_chart_of_accounts"
5. [ ] Retry provisioning
6. [ ] Verify provisioning completes

### Test Case 4: Idempotency
1. [ ] Create workspace
2. [ ] Wait for provisioning to complete
3. [ ] Trigger provisioning again
4. [ ] Verify no duplicate resources created
5. [ ] Verify status shows "exists" for completed steps

### Test Case 5: Partial Failure
1. [ ] Create workspace with demo data enabled
2. [ ] Simulate items creation failure
3. [ ] Verify provisioning status is "PARTIAL"
4. [ ] Verify critical steps completed
5. [ ] Verify errors array contains items step error

## Frontend Testing

### Workspace Creation Page
1. [ ] Navigate to `/admin/workspaces`
2. [ ] Fill in workspace creation form
3. [ ] Submit form
4. [ ] Verify success screen shows
5. [ ] Verify provisioning status component appears (if ERPNext)
6. [ ] Verify progress bar updates in real-time
7. [ ] Verify step indicators show current step
8. [ ] Verify completion message when done
9. [ ] Verify "Enter Workspace" button appears when complete

### Provisioning Status Component
1. [ ] Progress bar displays correctly
2. [ ] Step indicators show correct status
3. [ ] Error display shows when failures occur
4. [ ] Retry button works
5. [ ] Logs viewer expands/collapses
6. [ ] Auto-refresh works (updates every 2s)

## ERPNext Verification

After provisioning completes, verify in ERPNext:

1. [ ] Company exists with correct name
2. [ ] Chart of accounts imported (check Account count)
3. [ ] Warehouses exist:
   - [ ] Main Store
   - [ ] POS Store (if enabled)
4. [ ] Selling Settings configured:
   - [ ] POS enabled
   - [ ] Default customer set
5. [ ] Stock Settings configured:
   - [ ] Stock tracking enabled
   - [ ] Default warehouse set
6. [ ] Customer "Walk-In Customer" exists
7. [ ] POS Profile exists
8. [ ] POS Session can be opened

## Performance Checks

1. [ ] Provisioning completes in < 60 seconds
2. [ ] Engine health check cached (second call faster)
3. [ ] Status endpoint responds quickly (< 100ms)
4. [ ] Database queries optimized (check query plans)

## Error Handling Verification

1. [ ] Engine offline handled gracefully
2. [ ] Network timeout retries correctly
3. [ ] Invalid tenant ID returns 404
4. [ ] Unauthorized access returns 403
5. [ ] Concurrent provisioning prevented (409 Conflict)
6. [ ] Critical errors block provisioning
7. [ ] Non-critical errors allow continuation

## Logging Verification

1. [ ] Structured logs include correlation IDs
2. [ ] Step start/complete logged
3. [ ] Errors logged with full context
4. [ ] Performance metrics logged (duration)
5. [ ] Logs accessible via API endpoint

## Database State Verification

After provisioning, check database:

1. [ ] `TenantOnboarding` record created
2. [ ] `provisioning_type` set to "FULL_POS"
3. [ ] `provisioning_steps` contains all step statuses
4. [ ] `provisioning_metadata` contains resource references
5. [ ] `Tenant.provisioning_status` updated correctly
6. [ ] `Tenant.provisioned_at` set on completion

## Security Verification

1. [ ] Only tenant members can access provisioning endpoints
2. [ ] Super admin can access any tenant
3. [ ] Token validation works correctly
4. [ ] No sensitive data exposed in logs

## Documentation

1. [ ] API endpoints documented
2. [ ] Error responses documented
3. [ ] Provisioning steps documented
4. [ ] Configuration options documented

## Rollback Plan

If issues are found:

1. [ ] Stop automatic provisioning trigger in `iam.py`
2. [ ] Revert database migration: `alembic downgrade -1`
3. [ ] Remove provisioning router from `main.py`
4. [ ] Workspaces can still be created manually

## Success Metrics

- [ ] 100% of provisioning attempts complete successfully (or fail gracefully)
- [ ] Average provisioning time < 60 seconds
- [ ] Zero duplicate resources created on retry
- [ ] All critical steps have idempotency checks
- [ ] Frontend shows real-time updates
- [ ] Error messages are clear and actionable
