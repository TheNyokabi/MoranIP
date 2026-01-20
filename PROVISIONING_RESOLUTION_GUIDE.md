# Provisioning Resolution Guide

## Understanding Provisioning Status

### Status Types

1. **NOT_STARTED**: Provisioning hasn't been initiated
2. **IN_PROGRESS**: Provisioning is currently running
3. **COMPLETED**: All steps completed successfully
4. **PARTIAL**: Some steps completed, some failed/skipped
5. **FAILED**: Provisioning encountered critical errors

### Why PARTIAL Status?

PARTIAL status occurs when:
- Some steps complete successfully
- Some steps fail but are non-critical
- Some steps are skipped (e.g., demo data)
- Workspace is partially functional

**Common causes:**
- Non-critical steps failed (e.g., demo data import)
- Optional features couldn't be set up
- Warnings that don't block core functionality

## Provisioning Steps

The provisioning process consists of 11 steps:

1. **step_0_engine_check**: Verify ERPNext/Odoo engine is available
2. **step_1_platform_setup**: Set up platform-level configurations
3. **step_2_company**: Create company in ERPNext
4. **step_3_chart_of_accounts**: Import chart of accounts
5. **step_4_warehouses**: Create warehouses (Main Store, POS Store)
6. **step_5_settings**: Configure selling and stock settings
7. **step_6_items**: Create demo items (if enabled)
8. **step_7_customer**: Create default customer
9. **step_8_pos_profile**: Create POS profile with payment methods
10. **step_9_pos_session**: Create initial POS session
11. **step_10_post_sale_updates**: Final validation and updates

## Diagnostic Tools

### 1. Check Status

```bash
# Using the diagnostic script
./check_provisioning_status.sh admin@moran.com admin123 <tenant_id>

# Or manually
curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/status" \
  -H "Authorization: Bearer <token>"
```

### 2. Check Step Logs

```bash
curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/logs" \
  -H "Authorization: Bearer <token>"
```

### 3. Monitor in Real-Time

```bash
./monitor_provisioning.sh
```

## Resolution Options

### Option 1: Continue Provisioning (Recommended)

**When to use:**
- Status is PARTIAL or FAILED
- Some steps completed successfully
- You want to resume from the failed step

**Command:**
```bash
curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/continue" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**What it does:**
- Finds the first failed/pending step
- Retries that step and subsequent steps
- Keeps completed steps (idempotent)
- Preserves progress

### Option 2: Retry All Steps

**When to use:**
- Status is FAILED or PARTIAL
- Workspace is in inconsistent state
- You want a fresh start

**Command:**
```bash
curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/retry" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

**What it does:**
- Clears all step statuses
- Retries from the beginning
- All steps are re-executed (idempotent, so won't create duplicates)

### Option 3: Start Provisioning

**When to use:**
- Status is NOT_STARTED
- Provisioning didn't start automatically

**Command:**
```bash
curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/start" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "include_demo_data": false,
    "pos_store_enabled": true,
    "country_template": null
  }'
```

## Common Issues and Solutions

### Issue 1: "Abbreviation already used"

**Symptom:**
- Error: "Abbreviation already used for another company"
- Step: step_2_company

**Solution:**
- **Automatic**: The system now handles this automatically with retry logic
- **Manual**: If automatic retry fails, check ERPNext for existing companies
- **Action**: Use "Continue" to retry with a new abbreviation

### Issue 2: "Mode of Payment account not found"

**Symptom:**
- Error: "Please set default Cash or Bank account in Mode of Payments"
- Step: step_8_pos_profile

**Solution:**
1. Check if company was created successfully
2. Verify chart of accounts was imported
3. Use "Continue" to retry (system will create accounts if missing)

### Issue 3: "Warehouse not found"

**Symptom:**
- Error: "Could not find Warehouse: Main Store"
- Step: step_8_pos_profile

**Solution:**
1. Verify step_4_warehouses completed
2. Check ERPNext for warehouse existence
3. Use "Continue" to retry warehouse creation

### Issue 4: "POS Profile validation error"

**Symptom:**
- Error: "write_off_account, write_off_cost_center" mandatory
- Step: step_8_pos_profile

**Solution:**
1. System should create these automatically
2. Use "Continue" to retry
3. If persists, check ERPNext for account/cost center existence

### Issue 5: "Engine unavailable"

**Symptom:**
- Error: "Engine health check failed"
- Step: step_0_engine_check

**Solution:**
1. Verify ERPNext/Odoo is running
2. Check network connectivity
3. Verify credentials in settings
4. Restart provisioning once engine is available

### Issue 6: "0 steps completed" but status is PARTIAL

**Symptom:**
- Status: PARTIAL
- Steps Completed: 0/10
- No errors shown

**Possible causes:**
- Steps aren't being tracked properly
- Database sync issue
- Provisioning failed early but wasn't marked as FAILED

**Solution:**
1. Check backend logs for actual errors
2. Use "Retry All" to start fresh
3. If persists, check database for onboarding.provisioning_steps

## Step-by-Step Troubleshooting

### Step 1: Check Current Status

```bash
./check_provisioning_status.sh admin@moran.com admin123 <tenant_id>
```

### Step 2: Review Errors

Look for:
- Specific step that failed
- Error message details
- Whether it's a critical or non-critical error

### Step 3: Check Backend Logs

```bash
docker-compose logs api --tail=100 | grep -i "provisioning\|error\|failed"
```

### Step 4: Choose Resolution

- **If errors are recoverable**: Use "Continue"
- **If workspace is inconsistent**: Use "Retry All"
- **If engine is down**: Fix engine, then "Continue"

### Step 5: Monitor Progress

```bash
./monitor_provisioning.sh
```

## Manual Resolution (Advanced)

If automatic retry doesn't work, you may need to:

1. **Check ERPNext directly:**
   - Login to ERPNext
   - Verify company exists
   - Check warehouses, accounts, POS profiles

2. **Fix issues in ERPNext:**
   - Create missing resources manually
   - Fix validation errors
   - Ensure all required fields are set

3. **Retry provisioning:**
   - Use "Continue" to resume
   - Or "Retry All" for fresh start

## Prevention

To avoid provisioning issues:

1. **Ensure engine is running** before creating workspace
2. **Use unique workspace names** to avoid abbreviation conflicts
3. **Check engine health** before provisioning
4. **Monitor logs** during provisioning
5. **Use retry/continue** for transient errors

## Getting Help

If issues persist:

1. Collect diagnostic information:
   ```bash
   ./check_provisioning_status.sh > provisioning_diagnostic.txt
   docker-compose logs api --tail=200 >> provisioning_diagnostic.txt
   ```

2. Check specific step logs:
   ```bash
   curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/logs" \
     -H "Authorization: Bearer <token>" | jq .
   ```

3. Review backend logs for detailed error messages

4. Check ERPNext directly for resource existence

## Quick Reference

| Status | Action | Command |
|--------|--------|---------|
| NOT_STARTED | Start | `POST /provisioning/tenants/{id}/start` |
| IN_PROGRESS | Wait | Monitor status |
| PARTIAL | Continue | `POST /provisioning/tenants/{id}/continue` |
| FAILED | Continue/Retry | `POST /provisioning/tenants/{id}/continue` or `/retry` |
| COMPLETED | None | Workspace is ready |

## Example Workflow

```bash
# 1. Check status
./check_provisioning_status.sh admin@moran.com admin123 <tenant_id>

# 2. If PARTIAL or FAILED, continue
TOKEN=$(curl -s -X POST "http://localhost:4000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@moran.com","password":"admin123"}' | jq -r '.access_token')

curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/continue" \
  -H "Authorization: Bearer $TOKEN"

# 3. Monitor progress
./monitor_provisioning.sh
```
