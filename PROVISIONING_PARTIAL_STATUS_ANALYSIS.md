# Provisioning PARTIAL Status Analysis

## Current Issue

**Status**: PARTIAL  
**Steps Completed**: 0/10  
**Progress**: 0%  
**Current Step**: step_0_engine_check  
**Errors**: None shown

## Problem Analysis

When provisioning shows PARTIAL status with 0 steps completed, it typically indicates:

1. **Steps aren't being tracked properly** - The `provisioning_steps` dictionary in the database might be empty
2. **Early failure without proper status update** - Provisioning might have failed before steps were saved
3. **Database sync issue** - Steps were executed but not committed to database
4. **Status calculation issue** - Steps exist but aren't being counted correctly

## Root Cause Investigation

### Possible Causes

1. **Background Thread Issue**: Provisioning runs in a background thread, and if it fails early, steps might not be saved
2. **Transaction Rollback**: If an error occurs before `db.commit()`, steps won't be persisted
3. **Status Mapping**: The status endpoint might not be reading `provisioning_steps` correctly
4. **Empty Steps Dictionary**: `provisioning_steps` might be initialized as `{}` but never populated

## Diagnostic Steps

### 1. Check Provisioning Steps in Database

```bash
# Using the API (if logs endpoint works)
curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/logs" \
  -H "Authorization: Bearer <token>"
```

### 2. Check Backend Logs

```bash
docker-compose logs api --tail=500 | grep -E "<tenant_id>|provisioning|step_"
```

Look for:
- Step execution logs
- Error messages
- Database commit issues
- Thread termination

### 3. Check Tenant Status

```bash
curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/status" \
  -H "Authorization: Bearer <token>" | jq .
```

## Solutions

### Solution 1: Continue Provisioning (Recommended First Step)

This will:
- Find the first incomplete step
- Retry from that point
- Properly track step completion

```bash
TOKEN=$(curl -s -X POST "http://localhost:4000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@moran.com","password":"admin123"}' | jq -r '.access_token')

curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/continue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Solution 2: Retry All Steps

If continue doesn't work, retry all steps:

```bash
curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/retry" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### Solution 3: Check and Fix Database

If steps aren't being saved, check:

1. **Database connection**: Ensure database is accessible
2. **Transaction commits**: Verify `db.commit()` is being called
3. **Onboarding record**: Ensure onboarding record exists

### Solution 4: Manual Step Execution

If automatic retry fails, you may need to:

1. **Check ERPNext directly**:
   - Login to ERPNext
   - Verify what resources were actually created
   - Check if company, warehouses, etc. exist

2. **Fix missing resources**:
   - Create missing resources manually
   - Fix validation errors

3. **Retry provisioning**:
   - Use "Continue" or "Retry All"

## Expected Behavior After Fix

After using "Continue" or "Retry All", you should see:

1. **Status changes**: IN_PROGRESS → COMPLETED or PARTIAL (with actual steps)
2. **Steps tracked**: Steps show as completed/failed in logs
3. **Progress updates**: Progress percentage increases
4. **Errors visible**: If steps fail, errors are shown

## Prevention

To prevent this issue:

1. **Ensure engine is running** before provisioning
2. **Monitor logs** during provisioning
3. **Check status immediately** after workspace creation
4. **Use retry/continue** if status is PARTIAL with 0 steps

## Quick Fix Script

```bash
#!/bin/bash
# Quick fix for PARTIAL status with 0 steps

TENANT_ID="$1"
EMAIL="${2:-admin@moran.com}"
PASSWORD="${3:-admin123}"

# Login
TOKEN=$(curl -s -X POST "http://localhost:4000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.access_token')

# Continue provisioning
echo "Continuing provisioning for tenant $TENANT_ID..."
curl -X POST "http://localhost:4000/api/provisioning/tenants/$TENANT_ID/continue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

echo ""
echo "Check status:"
curl -X GET "http://localhost:4000/api/provisioning/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Next Steps

1. **Run diagnostic**: `./check_provisioning_status.sh admin@moran.com admin123 <tenant_id>`
2. **Try continue**: Use the continue endpoint to resume provisioning
3. **Monitor progress**: Use `./monitor_provisioning.sh` to watch progress
4. **Check logs**: Review backend logs for any errors
5. **Verify resources**: Check ERPNext to see what was actually created

## Related Files

- `check_provisioning_status.sh` - Status checker script
- `monitor_provisioning.sh` - Real-time monitoring script
- `PROVISIONING_RESOLUTION_GUIDE.md` - Comprehensive resolution guide
- `Backend/app/services/provisioning_service.py` - Provisioning service implementation
- `Backend/app/routers/provisioning.py` - Provisioning API endpoints
