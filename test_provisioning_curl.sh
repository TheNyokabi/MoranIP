#!/bin/bash

# Test Provisioning Flow via Frontend API Proxy (ERPNext)
# This script tests the complete provisioning flow using curl

set -e

FRONTEND_URL="http://localhost:4000"
API_URL="${FRONTEND_URL}/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Provisioning Flow Test (ERPNext)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Create Tenant/Workspace (No auth required for tenant creation)
echo -e "${YELLOW}Step 1: Creating workspace (ERPNext)...${NC}"
TIMESTAMP=$(date +%s)
TENANT_NAME="Test Company ${TIMESTAMP}"

CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/iam/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TENANT_NAME}\",
    \"category\": \"Enterprise\",
    \"description\": \"Test workspace for provisioning verification\",
    \"country_code\": \"KE\",
    \"admin_email\": \"testadmin${TIMESTAMP}@example.com\",
    \"admin_name\": \"Test Admin\",
    \"admin_password\": \"TestAdmin123!\",
    \"engine\": \"erpnext\"
  }")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Workspace creation failed${NC}"
  exit 1
fi

TENANT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to get tenant ID from response${NC}"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Workspace created successfully${NC}"
echo "Tenant ID: $TENANT_ID"
echo "Tenant Name: $TENANT_NAME"
echo ""

# Step 2: Check Provisioning Status
echo -e "${YELLOW}Step 2: Checking provisioning status...${NC}"
sleep 2

STATUS_RESPONSE=$(curl -s -X GET "${API_URL}/provisioning/tenants/${TENANT_ID}/status")

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to get provisioning status${NC}"
  exit 1
fi

echo "Status Response:"
echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

# Step 3: Monitor Provisioning Progress
echo -e "${YELLOW}Step 3: Monitoring provisioning progress...${NC}"
MAX_ATTEMPTS=60
ATTEMPT=0
COMPLETED=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATUS_RESPONSE=$(curl -s -X GET "${API_URL}/provisioning/tenants/${TENANT_ID}/status")
  
  STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  PROGRESS=$(echo $STATUS_RESPONSE | grep -o '"progress":[0-9.]*' | cut -d':' -f2)
  CURRENT_STEP=$(echo $STATUS_RESPONSE | grep -o '"current_step":"[^"]*' | cut -d'"' -f4)
  STEPS_COMPLETED=$(echo $STATUS_RESPONSE | grep -o '"steps_completed":[0-9]*' | cut -d':' -f2)
  TOTAL_STEPS=$(echo $STATUS_RESPONSE | grep -o '"total_steps":[0-9]*' | cut -d':' -f2)
  
  echo -e "${BLUE}Attempt $((ATTEMPT + 1))/${MAX_ATTEMPTS}: Status=${STATUS}, Progress=${PROGRESS}%, Step=${CURRENT_STEP}, Completed=${STEPS_COMPLETED}/${TOTAL_STEPS}${NC}"
  
  if [ "$STATUS" = "COMPLETED" ]; then
    echo -e "${GREEN}✅ Provisioning completed successfully!${NC}"
    COMPLETED=true
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo -e "${RED}❌ Provisioning failed${NC}"
    ERRORS=$(echo $STATUS_RESPONSE | grep -o '"errors":\[[^]]*\]' || echo "[]")
    echo "Errors: $ERRORS"
    break
  fi
  
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$COMPLETED" = false ] && [ "$STATUS" != "FAILED" ]; then
  echo -e "${YELLOW}⚠️  Provisioning still in progress after ${MAX_ATTEMPTS} attempts${NC}"
fi

# Step 4: Get Final Status
echo ""
echo -e "${YELLOW}Step 4: Final provisioning status...${NC}"
FINAL_STATUS=$(curl -s -X GET "${API_URL}/provisioning/tenants/${TENANT_ID}/status")

echo "Final Status:"
echo "$FINAL_STATUS" | python3 -m json.tool 2>/dev/null || echo "$FINAL_STATUS"
echo ""

# Step 5: Get Provisioning Logs
echo -e "${YELLOW}Step 5: Provisioning logs...${NC}"
LOGS_RESPONSE=$(curl -s -X GET "${API_URL}/provisioning/tenants/${TENANT_ID}/logs")

echo "Logs:"
echo "$LOGS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGS_RESPONSE"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Tenant ID: $TENANT_ID"
echo "Tenant Name: $TENANT_NAME"
echo "Final Status: $STATUS"
echo "Progress: ${PROGRESS}%"
echo "Steps Completed: ${STEPS_COMPLETED}/${TOTAL_STEPS}"

if [ "$STATUS" = "COMPLETED" ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Tests failed or incomplete${NC}"
  exit 1
fi
