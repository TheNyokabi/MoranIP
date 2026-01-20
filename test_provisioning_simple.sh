#!/bin/bash

# Simple Provisioning Test via Frontend API Proxy (ERPNext)
# Tests tenant creation and initial provisioning status

set -e

FRONTEND_URL="http://localhost:4000"
API_URL="${FRONTEND_URL}/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ERPNext Provisioning Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Create Tenant/Workspace
echo -e "${YELLOW}Step 1: Creating workspace with ERPNext engine...${NC}"
TIMESTAMP=$(date +%s)
TENANT_NAME="Test Company ${TIMESTAMP}"

CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/iam/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TENANT_NAME}\",
    \"category\": \"Enterprise\",
    \"description\": \"Test workspace for ERPNext provisioning\",
    \"country_code\": \"KE\",
    \"admin_email\": \"test${TIMESTAMP}@example.com\",
    \"admin_name\": \"Test Admin\",
    \"admin_password\": \"TestAdmin123!\",
    \"engine\": \"erpnext\"
  }")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Workspace creation failed${NC}"
  exit 1
fi

echo "Response:"
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Extract tenant ID and provisioning status
TENANT_ID=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('tenant', {}).get('id', ''))" 2>/dev/null || echo "")
PROVISIONING_STATUS=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('provisioning', {}).get('status', 'UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
PROVISIONING_PROGRESS=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('provisioning', {}).get('progress', 0))" 2>/dev/null || echo "0")
CURRENT_STEP=$(echo $CREATE_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('provisioning', {}).get('current_step', 'N/A'))" 2>/dev/null || echo "N/A")

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to extract tenant ID${NC}"
  echo "Full response: $CREATE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Workspace created successfully!${NC}"
echo "Tenant ID: $TENANT_ID"
echo "Tenant Name: $TENANT_NAME"
echo ""

# Step 2: Display Provisioning Status from Response
echo -e "${YELLOW}Step 2: Initial provisioning status...${NC}"
echo "Status: $PROVISIONING_STATUS"
echo "Progress: ${PROVISIONING_PROGRESS}%"
echo "Current Step: $CURRENT_STEP"
echo ""

# Step 3: Check if provisioning is in progress
if [ "$PROVISIONING_STATUS" = "IN_PROGRESS" ] || [ "$PROVISIONING_STATUS" = "PROVISIONING" ]; then
  echo -e "${YELLOW}Step 3: Provisioning is in progress...${NC}"
  echo "Note: To check detailed status, you'll need to authenticate and use:"
  echo "  GET ${API_URL}/provisioning/tenants/${TENANT_ID}/status"
  echo ""
  echo "Or monitor via the frontend UI at:"
  echo "  http://localhost:4000/admin/workspaces"
  echo ""
fi

# Step 4: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Workspace Creation: SUCCESS${NC}"
echo "Tenant ID: $TENANT_ID"
echo "Tenant Name: $TENANT_NAME"
echo "Engine: ERPNext"
echo "Provisioning Status: $PROVISIONING_STATUS"
echo "Progress: ${PROVISIONING_PROGRESS}%"
echo "Current Step: $CURRENT_STEP"
echo ""

if [ "$PROVISIONING_STATUS" = "COMPLETED" ]; then
  echo -e "${GREEN}✅ Provisioning completed successfully!${NC}"
  exit 0
elif [ "$PROVISIONING_STATUS" = "FAILED" ]; then
  echo -e "${RED}❌ Provisioning failed${NC}"
  echo "Check logs or retry provisioning via API"
  exit 1
elif [ "$PROVISIONING_STATUS" = "IN_PROGRESS" ] || [ "$PROVISIONING_STATUS" = "PROVISIONING" ]; then
  echo -e "${YELLOW}⚠️  Provisioning in progress${NC}"
  echo "Monitor via frontend UI or authenticated API calls"
  exit 0
else
  echo -e "${YELLOW}⚠️  Provisioning status: $PROVISIONING_STATUS${NC}"
  exit 0
fi
