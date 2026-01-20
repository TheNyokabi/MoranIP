#!/bin/bash

# Provisioning Monitor Script
# Creates a workspace and monitors provisioning progress

set -e

API_URL="http://localhost:4000/api"
EMAIL="admin@moran.com"
PASSWORD="admin123"  # Update with your password

echo "=========================================="
echo "Provisioning Monitor Test"
echo "=========================================="
echo ""

# Step 1: Login and get token
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

# Step 2: Create workspace
echo "Step 2: Creating workspace..."
TIMESTAMP=$(date +%s)
WORKSPACE_NAME="Test Workspace $TIMESTAMP"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/iam/tenants" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"name\": \"$WORKSPACE_NAME\",
    \"admin_email\": \"test-$TIMESTAMP@example.com\",
    \"admin_name\": \"Test Admin\",
    \"admin_password\": \"TestPassword123!\",
    \"country_code\": \"KE\",
    \"engine\": \"erpnext\",
    \"category\": \"RETAIL\",
    \"description\": \"Test workspace for provisioning monitoring\"
  }")

TENANT_ID=$(echo $CREATE_RESPONSE | jq -r '.tenant.id // empty')

if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
  echo "❌ Workspace creation failed!"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ Workspace created: $WORKSPACE_NAME"
echo "   Tenant ID: $TENANT_ID"
echo ""

# Check if provisioning started automatically
PROVISIONING_STATUS=$(echo $CREATE_RESPONSE | jq -r '.provisioning.status // empty')
if [ -n "$PROVISIONING_STATUS" ] && [ "$PROVISIONING_STATUS" != "null" ]; then
  echo "📋 Initial Provisioning Status: $PROVISIONING_STATUS"
  echo ""
fi

# Step 3: Monitor provisioning
echo "=========================================="
echo "Monitoring Provisioning Progress"
echo "=========================================="
echo ""

PREVIOUS_STATUS=""
PREVIOUS_STEP=""
ITERATION=0
MAX_ITERATIONS=300  # 10 minutes max (2 second intervals)

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
    -H "Authorization: Bearer $TOKEN")
  
  CURRENT_STATUS=$(echo $STATUS_RESPONSE | jq -r '.status // "UNKNOWN"')
  CURRENT_STEP=$(echo $STATUS_RESPONSE | jq -r '.current_step // "N/A"')
  PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress // 0')
  STEPS_COMPLETED=$(echo $STATUS_RESPONSE | jq -r '.steps_completed // 0')
  TOTAL_STEPS=$(echo $STATUS_RESPONSE | jq -r '.total_steps // 0')
  ERRORS=$(echo $STATUS_RESPONSE | jq -r '.errors // []')
  ERROR_COUNT=$(echo $STATUS_RESPONSE | jq -r '.errors | length // 0')
  STARTED_AT=$(echo $STATUS_RESPONSE | jq -r '.started_at // "N/A"')
  COMPLETED_AT=$(echo $STATUS_RESPONSE | jq -r '.completed_at // "N/A"')
  
  # Print every iteration for first 5, then only on changes
  if [ $ITERATION -lt 5 ] || [ "$CURRENT_STATUS" != "$PREVIOUS_STATUS" ] || [ "$CURRENT_STEP" != "$PREVIOUS_STEP" ]; then
    echo "[$(date +%H:%M:%S)] Status: $CURRENT_STATUS | Progress: ${PROGRESS}% | Steps: $STEPS_COMPLETED/$TOTAL_STEPS"
    
    if [ "$CURRENT_STEP" != "null" ] && [ "$CURRENT_STEP" != "N/A" ]; then
      echo "   Current Step: $CURRENT_STEP"
    fi
    
    if [ "$STARTED_AT" != "null" ] && [ "$STARTED_AT" != "N/A" ]; then
      echo "   Started: $STARTED_AT"
    fi
    
    if [ "$COMPLETED_AT" != "null" ] && [ "$COMPLETED_AT" != "N/A" ]; then
      echo "   Completed: $COMPLETED_AT"
    fi
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "   ⚠️  Errors/Warnings: $ERROR_COUNT"
      echo "$ERRORS" | jq -r '.[] | "      - \(.step): \(.error)"'
    fi
    
    # Show raw response for debugging on first few iterations
    if [ $ITERATION -lt 3 ]; then
      echo "   [Debug] Full Response:"
      echo "$STATUS_RESPONSE" | jq '.' | sed 's/^/      /'
    fi
    
    echo ""
  fi
  
  # Check if provisioning is complete
  if [ "$CURRENT_STATUS" = "COMPLETED" ]; then
    echo "=========================================="
    echo "✅ Provisioning Completed Successfully!"
    echo "=========================================="
    echo "Final Status: $CURRENT_STATUS"
    echo "Steps Completed: $STEPS_COMPLETED/$TOTAL_STEPS"
    echo "Progress: ${PROGRESS}%"
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo ""
      echo "Warnings:"
      echo "$ERRORS" | jq -r '.[] | "  - \(.step): \(.error)"'
    fi
    
    # Get detailed logs
    echo ""
    echo "Detailed Step Logs:"
    LOGS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/logs" \
      -H "Authorization: Bearer $TOKEN")
    echo "$LOGS_RESPONSE" | jq -r '.logs[]? | "  [\(.status)] \(.step): \(.message // "N/A")"'
    break
  fi
  
  if [ "$CURRENT_STATUS" = "FAILED" ]; then
    echo "=========================================="
    echo "❌ Provisioning Failed!"
    echo "=========================================="
    echo "Final Status: $CURRENT_STATUS"
    echo "Steps Completed: $STEPS_COMPLETED/$TOTAL_STEPS"
    echo "Progress: ${PROGRESS}%"
    echo ""
    echo "Errors:"
    echo "$ERRORS" | jq -r '.[] | "  - \(.step): \(.error)"'
    
    # Get detailed logs
    echo ""
    echo "Detailed Step Logs:"
    LOGS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/logs" \
      -H "Authorization: Bearer $TOKEN")
    echo "$LOGS_RESPONSE" | jq -r '.logs[]? | "  [\(.status)] \(.step): \(.message // "N/A") | Error: \(.error // "N/A")"'
    break
  fi
  
  if [ "$CURRENT_STATUS" = "PARTIAL" ]; then
    echo "=========================================="
    echo "⚠️  Provisioning Completed with Warnings"
    echo "=========================================="
    echo "Final Status: $CURRENT_STATUS"
    echo "Steps Completed: $STEPS_COMPLETED/$TOTAL_STEPS"
    echo "Progress: ${PROGRESS}%"
    echo ""
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "Warnings:"
      echo "$ERRORS" | jq -r '.[] | "  - \(.step): \(.error)"'
    else
      echo "No specific warnings in errors array"
    fi
    
    # Get detailed logs
    echo ""
    echo "Detailed Step Logs:"
    LOGS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/logs" \
      -H "Authorization: Bearer $TOKEN")
    echo "$LOGS_RESPONSE" | jq -r '.logs[]? | "  [\(.status)] \(.step): \(.message // "N/A") | Error: \(.error // "None")"'
    break
  fi
  
  PREVIOUS_STATUS=$CURRENT_STATUS
  PREVIOUS_STEP=$CURRENT_STEP
  ITERATION=$((ITERATION + 1))
  sleep 2
done

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
  echo "⏱️  Monitoring timeout reached (10 minutes)"
  echo "Current Status: $CURRENT_STATUS"
  echo "Steps Completed: $STEPS_COMPLETED/$TOTAL_STEPS"
fi

echo ""
echo "=========================================="
echo "Monitoring Complete"
echo "=========================================="
