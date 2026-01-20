#!/bin/bash

# Simple Provisioning Status Checker
# Shows pending activities and provides resolution guidance

set -e

API_URL="http://localhost:4000/api"
EMAIL="${1:-admin@moran.com}"
PASSWORD="${2:-admin123}"
TENANT_ID="${3}"

if [ -z "$TENANT_ID" ]; then
  echo "Usage: $0 [email] [password] <tenant_id>"
  exit 1
fi

# Login
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed!"
  exit 1
fi

# Get status
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress')
STEPS_COMPLETED=$(echo $STATUS_RESPONSE | jq -r '.steps_completed')
TOTAL_STEPS=$(echo $STATUS_RESPONSE | jq -r '.total_steps')
CURRENT_STEP=$(echo $STATUS_RESPONSE | jq -r '.current_step')
ERRORS=$(echo $STATUS_RESPONSE | jq -r '.errors // []')
ERROR_COUNT=$(echo $STATUS_RESPONSE | jq -r '.errors | length')

echo "=========================================="
echo "Provisioning Status: $STATUS"
echo "=========================================="
echo "Progress: ${PROGRESS}%"
echo "Steps: $STEPS_COMPLETED/$TOTAL_STEPS"
echo "Current Step: $CURRENT_STEP"
echo ""

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "Errors/Warnings:"
  echo "$ERRORS" | jq -r '.[] | "  • \(.step): \(.error)"'
  echo ""
fi

# Get logs
LOGS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/logs" \
  -H "Authorization: Bearer $TOKEN")

LOG_COUNT=$(echo $LOGS_RESPONSE | jq -r '.logs | length')

if [ "$LOG_COUNT" -gt 0 ]; then
  echo "Step Details:"
  echo "$LOGS_RESPONSE" | jq -r '.logs[] | "  [\(.status)] \(.step): \(.message // "N/A")"'
  echo ""
fi

# Resolution guidance
echo "=========================================="
echo "Resolution Options"
echo "=========================================="

case "$STATUS" in
  "PARTIAL")
    echo "Status: PARTIAL - Some steps completed, some failed/skipped"
    echo ""
    echo "Options:"
    echo "  1. Continue (recommended):"
    echo "     curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/continue\" \\"
    echo "       -H \"Authorization: Bearer $TOKEN\""
    echo ""
    echo "  2. Retry All:"
    echo "     curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/retry\" \\"
    echo "       -H \"Authorization: Bearer $TOKEN\""
    ;;
  "FAILED")
    echo "Status: FAILED - Provisioning encountered errors"
    echo ""
    echo "Options:"
    echo "  1. Continue (resume from failed step):"
    echo "     curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/continue\" \\"
    echo "       -H \"Authorization: Bearer $TOKEN\""
    echo ""
    echo "  2. Retry All (start fresh):"
    echo "     curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/retry\" \\"
    echo "       -H \"Authorization: Bearer $TOKEN\""
    ;;
  "NOT_STARTED")
    echo "Status: NOT_STARTED - Provisioning hasn't begun"
    echo ""
    echo "Start provisioning:"
    echo "  curl -X POST \"$API_URL/provisioning/tenants/$TENANT_ID/start\" \\"
    echo "    -H \"Authorization: Bearer $TOKEN\" \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{}'"
    ;;
  "IN_PROGRESS")
    echo "Status: IN_PROGRESS - Provisioning is running"
    echo "Wait for completion or check logs if stuck"
    ;;
  "COMPLETED")
    echo "Status: COMPLETED - All steps finished successfully!"
    ;;
esac

echo ""
echo "=========================================="
