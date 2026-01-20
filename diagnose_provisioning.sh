#!/bin/bash

# Provisioning Diagnostic Tool
# Shows pending activities, failed steps, and resolution guidance

set -e

API_URL="http://localhost:4000/api"
EMAIL="${1:-admin@moran.com}"
PASSWORD="${2:-admin123}"
TENANT_ID="${3}"

if [ -z "$TENANT_ID" ]; then
  echo "Usage: $0 [email] [password] <tenant_id>"
  echo "Or set TENANT_ID environment variable"
  exit 1
fi

echo "=========================================="
echo "Provisioning Diagnostic Tool"
echo "=========================================="
echo ""

# Step 1: Login
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Get provisioning status
echo "Step 2: Fetching provisioning status..."
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $STATUS_RESPONSE | jq -r '.status // "UNKNOWN"')
PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress // 0')
STEPS_COMPLETED=$(echo $STATUS_RESPONSE | jq -r '.steps_completed // 0')
TOTAL_STEPS=$(echo $STATUS_RESPONSE | jq -r '.total_steps // 0')
CURRENT_STEP=$(echo $STATUS_RESPONSE | jq -r '.current_step // "N/A"')
ERRORS=$(echo $STATUS_RESPONSE | jq -r '.errors // []')
ERROR_COUNT=$(echo $STATUS_RESPONSE | jq -r '.errors | length // 0')

echo "=========================================="
echo "Current Status"
echo "=========================================="
echo "Status: $STATUS"
echo "Progress: ${PROGRESS}%"
echo "Steps Completed: $STEPS_COMPLETED/$TOTAL_STEPS"
echo "Current Step: $CURRENT_STEP"
echo ""

# Step 3: Get detailed logs
echo "Step 3: Fetching detailed step logs..."
LOGS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/logs" \
  -H "Authorization: Bearer $TOKEN")

echo "=========================================="
echo "Step-by-Step Breakdown"
echo "=========================================="

# Step name mapping (using simple function instead of associative array for compatibility)
get_step_name() {
  case "$1" in
    "step_0_engine_check") echo "Engine Availability Check" ;;
    "step_1_platform_setup") echo "Platform Setup" ;;
    "step_2_company") echo "Company Creation" ;;
    "step_3_chart_of_accounts") echo "Chart of Accounts Import" ;;
    "step_4_warehouses") echo "Warehouse Creation" ;;
    "step_5_customer") echo "Customer Creation" ;;
    "step_6_items") echo "Item Creation (Demo Data)" ;;
    "step_7_pos_profile") echo "POS Profile Creation" ;;
    "step_8_pos_session") echo "POS Session Creation" ;;
    "step_9_final_validation") echo "Final Validation" ;;
    *) echo "$1" ;;
  esac
}

# Parse logs
LOG_COUNT=$(echo $LOGS_RESPONSE | jq -r '.logs | length // 0')

if [ "$LOG_COUNT" -eq 0 ]; then
  echo "⚠️  No step logs found. This might indicate:"
  echo "   - Provisioning hasn't started properly"
  echo "   - Steps aren't being tracked"
  echo "   - Database issue"
  echo ""
else
  echo "$LOGS_RESPONSE" | jq -r '.logs[] | 
    "\(.step // "unknown"): \(.status // "unknown")
    Message: \(.message // "N/A")
    Error: \(.error // "None")
    Duration: \(.duration_ms // 0)ms
    ---"'
  echo ""
fi

# Step 4: Analyze status
echo "=========================================="
echo "Status Analysis"
echo "=========================================="

case "$STATUS" in
  "NOT_STARTED")
    echo "📋 Provisioning has not been started yet."
    echo ""
    echo "🔧 Resolution:"
    echo "   1. Call POST /api/provisioning/tenants/$TENANT_ID/start"
    echo "   2. Or provisioning should start automatically when workspace is created"
    ;;
    
  "IN_PROGRESS")
    echo "⏳ Provisioning is currently in progress."
    echo "   Current Step: $CURRENT_STEP"
    echo ""
    echo "💡 Action:"
    echo "   - Wait for provisioning to complete"
    echo "   - Check status again in a few seconds"
    echo "   - If stuck, check backend logs for errors"
    ;;
    
  "COMPLETED")
    echo "✅ Provisioning completed successfully!"
    echo ""
    echo "🎉 All steps completed. Workspace is ready to use."
    ;;
    
  "FAILED")
    echo "❌ Provisioning failed."
    echo ""
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "Errors found:"
      echo "$ERRORS" | jq -r '.[] | "  • \(.step): \(.error)"'
      echo ""
    fi
    echo "🔧 Resolution Options:"
    echo "   1. Retry All: POST /api/provisioning/tenants/$TENANT_ID/retry"
    echo "      - Clears all failed steps and retries from beginning"
    echo ""
    echo "   2. Continue: POST /api/provisioning/tenants/$TENANT_ID/continue"
    echo "      - Resumes from the first failed step"
    echo "      - Keeps completed steps"
    ;;
    
  "PARTIAL")
    echo "⚠️  Provisioning completed with warnings (PARTIAL status)."
    echo ""
    echo "This means:"
    echo "  - Some steps completed successfully"
    echo "  - Some steps failed or were skipped"
    echo "  - Workspace may be partially functional"
    echo ""
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "⚠️  Warnings/Errors:"
      echo "$ERRORS" | jq -r '.[] | "  • \(.step): \(.error)"'
      echo ""
    fi
    
    if [ "$STEPS_COMPLETED" -eq 0 ]; then
      echo "⚠️  WARNING: Status is PARTIAL but 0 steps completed!"
      echo "   This might indicate:"
      echo "   - Steps aren't being tracked properly"
      echo "   - Provisioning failed early but wasn't marked as FAILED"
      echo "   - Database sync issue"
      echo ""
    fi
    
    echo "🔧 Resolution Options:"
    echo "   1. Continue Provisioning: POST /api/provisioning/tenants/$TENANT_ID/continue"
    echo "      - Attempts to complete failed/skipped steps"
    echo ""
    echo "   2. Retry All: POST /api/provisioning/tenants/$TENANT_ID/retry"
    echo "      - Clears all steps and retries from beginning"
    echo "      - Use if workspace is in inconsistent state"
    echo ""
    echo "   3. Manual Resolution:"
    echo "      - Check backend logs for specific errors"
    echo "      - Fix issues in ERPNext manually if needed"
    echo "      - Then retry or continue provisioning"
    ;;
    
  *)
    echo "❓ Unknown status: $STATUS"
    ;;
esac

echo ""
echo "=========================================="
echo "Quick Actions"
echo "=========================================="
echo ""
echo "To retry all steps:"
echo "  curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/retry\" \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\""
echo ""
echo "To continue from failed step:"
echo "  curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/continue\" \\"
echo "    -H \"Authorization: Bearer $TOKEN\" \\"
echo "    -H \"Content-Type: application/json\""
echo ""
echo "To check status again:"
echo "  curl -X GET \"$API_URL/provisioning/tenants/$TENANT_ID/status\" \\"
echo "    -H \"Authorization: Bearer $TOKEN\""
echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
