#!/bin/bash

# Fix PARTIAL Provisioning Status
# Handles the case where status is PARTIAL but no steps are tracked

set -e

API_URL="http://localhost:4000/api"
EMAIL="${1:-admin@moran.com}"
PASSWORD="${2:-admin123}"
TENANT_ID="${3}"

if [ -z "$TENANT_ID" ]; then
  echo "Usage: $0 [email] [password] <tenant_id>"
  exit 1
fi

echo "=========================================="
echo "Fixing PARTIAL Provisioning Status"
echo "=========================================="
echo ""

# Login
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed!"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Check current status
echo "Current Status:"
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
  -H "Authorization: Bearer $TOKEN")

STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
STEPS_COMPLETED=$(echo $STATUS_RESPONSE | jq -r '.steps_completed')
echo "  Status: $STATUS"
echo "  Steps Completed: $STEPS_COMPLETED"
echo ""

# Strategy: If PARTIAL with 0 steps, retry all
if [ "$STATUS" = "PARTIAL" ] && [ "$STEPS_COMPLETED" = "0" ]; then
  echo "⚠️  Detected PARTIAL status with 0 steps completed"
  echo "   This indicates steps weren't tracked properly"
  echo ""
  echo "🔧 Solution: Retry all steps to start fresh"
  echo ""
  
  read -p "Retry all steps? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Retrying all steps..."
    RETRY_RESPONSE=$(curl -s -X POST "$API_URL/provisioning/tenants/$TENANT_ID/retry" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
    
    echo "Response:"
    echo "$RETRY_RESPONSE" | jq .
    echo ""
    
    echo "✅ Retry initiated. Monitoring progress..."
    echo ""
    
    # Monitor for a bit
    for i in {1..10}; do
      sleep 2
      STATUS_RESPONSE=$(curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
        -H "Authorization: Bearer $TOKEN")
      STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
      STEPS_COMPLETED=$(echo $STATUS_RESPONSE | jq -r '.steps_completed')
      PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress')
      CURRENT_STEP=$(echo $STATUS_RESPONSE | jq -r '.current_step')
      
      echo "[$i] Status: $STATUS | Progress: ${PROGRESS}% | Steps: $STEPS_COMPLETED | Current: $CURRENT_STEP"
      
      if [ "$STATUS" = "COMPLETED" ] || [ "$STATUS" = "FAILED" ]; then
        break
      fi
    done
    
    echo ""
    echo "Final Status:"
    curl -s -X GET "$API_URL/provisioning/tenants/$TENANT_ID/status" \
      -H "Authorization: Bearer $TOKEN" | jq .
  else
    echo "Cancelled."
  fi
else
  echo "Status is not PARTIAL with 0 steps. Current status: $STATUS ($STEPS_COMPLETED steps)"
  echo ""
  echo "Try:"
  echo "  - Continue: POST /provisioning/tenants/$TENANT_ID/continue"
  echo "  - Retry All: POST /provisioning/tenants/$TENANT_ID/retry"
fi

echo ""
echo "=========================================="
