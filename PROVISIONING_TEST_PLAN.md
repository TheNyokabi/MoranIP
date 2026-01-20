# Provisioning System Test Plan

## Overview
This document outlines the test plan for verifying the provisioning system improvements, particularly the async endpoint changes.

## Test Environment
- **Backend API**: `http://localhost:9000`
- **Frontend**: `http://localhost:4000`
- **ERPNext**: `http://localhost:9010`

## Prerequisites
1. All services running (`docker-compose up`)
2. Valid user account with authentication token
3. ERPNext engine online and accessible
4. Database accessible

## Test Cases

### TC1: Start Provisioning (Async)
**Objective**: Verify that `/start` endpoint returns immediately and provisioning runs in background

**Steps**:
1. Create a new workspace via `/api/iam/tenants`
2. Note the `tenant_id` from response
3. Call `POST /api/provisioning/tenants/{tenant_id}/start`
4. Verify response:
   - Status: `200 OK`
   - Response body contains:
     - `status: "IN_PROGRESS"`
     - `progress: 0`
     - `current_step: "step_0_engine_check"`
     - `steps_completed: 0`
     - `total_steps: 11`
5. Immediately call `GET /api/provisioning/tenants/{tenant_id}/status`
6. Verify status shows provisioning is in progress
7. Poll status endpoint every 2 seconds
8. Verify progress increases over time
9. Wait for completion (or failure)
10. Verify final status is `COMPLETED` or `FAILED`

**Expected Results**:
- ✅ Start endpoint returns immediately (< 1 second)
- ✅ Status endpoint shows progress updates
- ✅ Provisioning completes successfully
- ✅ No request timeouts

**Test Command**:
```bash
# 1. Create workspace (get tenant_id)
curl -X POST http://localhost:4000/api/iam/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Workspace",
    "admin_email": "admin@test.com",
    "admin_name": "Test Admin",
    "admin_password": "password123",
    "country_code": "KE",
    "engine": "erpnext"
  }'

# 2. Start provisioning
curl -X POST http://localhost:4000/api/provisioning/tenants/{tenant_id}/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'

# 3. Poll status
watch -n 2 'curl -s http://localhost:4000/api/provisioning/tenants/{tenant_id}/status \
  -H "Authorization: Bearer $TOKEN" | jq'
```

---

### TC2: Retry Provisioning (Async)
**Objective**: Verify that `/retry` endpoint returns immediately and retries failed steps

**Prerequisites**: A workspace with failed provisioning

**Steps**:
1. Create a workspace with provisioning that fails (or manually set status to FAILED)
2. Call `POST /api/provisioning/tenants/{tenant_id}/retry`
3. Verify response:
   - Status: `200 OK`
   - Response body contains:
     - `status: "IN_PROGRESS"`
     - Current progress from before retry
4. Poll status endpoint
5. Verify failed steps are retried
6. Verify completed steps remain completed
7. Wait for completion

**Expected Results**:
- ✅ Retry endpoint returns immediately
- ✅ Failed steps are retried
- ✅ Completed steps are preserved
- ✅ Provisioning completes successfully

**Test Command**:
```bash
curl -X POST http://localhost:4000/api/provisioning/tenants/{tenant_id}/retry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```

---

### TC3: Continue Provisioning (Async)
**Objective**: Verify that `/continue` endpoint returns immediately and continues from failed step

**Prerequisites**: A workspace with partial provisioning failure

**Steps**:
1. Create a workspace with partial provisioning (some steps failed)
2. Note which step failed
3. Call `POST /api/provisioning/tenants/{tenant_id}/continue`
4. Verify response:
   - Status: `200 OK`
   - Response body contains:
     - `status: "IN_PROGRESS"`
     - `current_step: {first_failed_step}`
5. Poll status endpoint
6. Verify only the failed step is retried
7. Verify completed steps remain completed
8. Wait for completion

**Expected Results**:
- ✅ Continue endpoint returns immediately
- ✅ Only failed step is retried
- ✅ Completed steps are preserved
- ✅ Provisioning continues from failed step

**Test Command**:
```bash
curl -X POST http://localhost:4000/api/provisioning/tenants/{tenant_id}/continue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```

---

### TC4: Frontend Integration
**Objective**: Verify frontend correctly handles async provisioning

**Steps**:
1. Open frontend at `http://localhost:4000`
2. Login with valid credentials
3. Navigate to workspace creation page
4. Create a new workspace
5. Verify:
   - Provisioning status component appears
   - Shows "IN_PROGRESS" immediately
   - Progress updates automatically
   - Step indicators update in real-time
6. If provisioning fails:
   - Click "Retry All" button
   - Verify immediate response
   - Verify retry starts
7. If partial failure:
   - Click "Continue" button
   - Verify immediate response
   - Verify continue starts

**Expected Results**:
- ✅ Frontend shows immediate status
- ✅ Auto-refresh works correctly
- ✅ Progress bar updates
- ✅ Step indicators show current step
- ✅ Retry/Continue buttons work
- ✅ No UI freezing or timeouts

---

### TC5: Error Handling
**Objective**: Verify error handling in async endpoints

**Steps**:
1. Start provisioning with invalid tenant_id
2. Verify error response
3. Start provisioning with engine offline
4. Verify error response
5. Start provisioning when already provisioning
6. Verify 409 conflict response
7. Test with invalid authentication
8. Verify 401/403 responses

**Expected Results**:
- ✅ Invalid requests return appropriate error codes
- ✅ Error messages are clear and actionable
- ✅ Background threads handle errors gracefully
- ✅ Database status is updated on errors

---

### TC6: Concurrent Requests
**Objective**: Verify system handles concurrent provisioning requests

**Steps**:
1. Create multiple workspaces simultaneously
2. Start provisioning for all of them
3. Verify all return immediately
4. Poll status for all
5. Verify all complete successfully

**Expected Results**:
- ✅ All requests return immediately
- ✅ No blocking or queuing issues
- ✅ All provisioning processes run independently
- ✅ No resource conflicts

---

## Performance Benchmarks

### Response Time Targets
- **Start endpoint**: < 500ms
- **Retry endpoint**: < 500ms
- **Continue endpoint**: < 500ms
- **Status endpoint**: < 200ms

### Provisioning Duration
- **Full provisioning**: 30-120 seconds (depending on ERPNext response times)
- **Individual steps**: 2-10 seconds each

---

## Regression Tests

### Verify Existing Functionality
1. ✅ Status endpoint returns correct status
2. ✅ Progress calculation is accurate
3. ✅ Error messages are displayed correctly
4. ✅ Step tracking works correctly
5. ✅ Metadata is stored and retrieved correctly

---

## Test Data

### Test Workspace Configuration
```json
{
  "name": "Test Provisioning Workspace",
  "admin_email": "test@provisioning.com",
  "admin_name": "Test User",
  "admin_password": "TestPassword123!",
  "country_code": "KE",
  "engine": "erpnext",
  "category": "RETAIL",
  "description": "Test workspace for provisioning"
}
```

---

## Success Criteria

All test cases must pass:
- ✅ All endpoints return immediately (< 1 second)
- ✅ No request timeouts
- ✅ Provisioning completes successfully
- ✅ Frontend integration works correctly
- ✅ Error handling is robust
- ✅ Concurrent requests work correctly

---

## Known Issues / Limitations

None currently identified.

---

## Next Steps After Testing

1. Monitor production provisioning performance
2. Collect metrics on provisioning duration
3. Identify any bottlenecks
4. Optimize slow steps if needed
5. Add more comprehensive error messages
