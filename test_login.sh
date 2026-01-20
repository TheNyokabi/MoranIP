#!/bin/bash

# Test Login Script
# Tests login via API to diagnose login failures

set -e

API_URL="http://localhost:4000/api"
BACKEND_URL="http://localhost:9000"

echo "============================================================"
echo "LOGIN TEST - DIAGNOSING LOGIN FAILURE"
echo "============================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Step 1: Testing Backend Health..."
echo "-----------------------------------"
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed (HTTP $BACKEND_HEALTH)${NC}"
    echo "   Backend might not be running"
    echo "   Check: docker ps | grep moran-api"
    echo ""
fi

echo ""
echo "Step 2: Testing Frontend API Proxy..."
echo "--------------------------------------"
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Frontend API proxy is working${NC}"
else
    echo -e "${RED}❌ Frontend API proxy failed (HTTP $FRONTEND_HEALTH)${NC}"
    echo "   Frontend might not be running or proxy is broken"
    echo "   Check: docker ps | grep moran-frontend"
    echo ""
fi

echo ""
echo "Step 3: Testing Login via Frontend API Proxy..."
echo "------------------------------------------------"
echo "Testing with: admin@moran.com / admin123"
echo ""

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }' 2>/dev/null || echo "ERROR\n000")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
RESPONSE_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

echo "HTTP Status Code: $HTTP_CODE"
echo ""
echo "Response Body:"
echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Login successful via Frontend API!${NC}"
    TOKEN=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
    if [ -n "$TOKEN" ]; then
        echo "   Access Token: ${TOKEN:0:50}..."
    fi
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ Login failed: Invalid credentials (401)${NC}"
    echo "   Possible reasons:"
    echo "   • User doesn't exist"
    echo "   • Wrong password"
    echo "   • Run: ./setup_admin.sh to create user"
elif [ "$HTTP_CODE" = "500" ]; then
    echo -e "${RED}❌ Login failed: Internal Server Error (500)${NC}"
    echo "   Check backend logs: docker logs moran-api --tail 100"
elif [ "$HTTP_CODE" = "000" ] || [ "$HTTP_CODE" = "ERROR" ]; then
    echo -e "${RED}❌ Connection failed${NC}"
    echo "   Backend or Frontend might not be running"
    echo "   Check: docker ps"
else
    echo -e "${YELLOW}⚠️  Unexpected response code: $HTTP_CODE${NC}"
    echo "   Check backend logs: docker logs moran-api --tail 100"
fi

echo ""
echo "Step 4: Testing Login via Backend Direct..."
echo "--------------------------------------------"
echo "Testing with: admin@moran.com / admin123"
echo ""

BACKEND_LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }' 2>/dev/null || echo "ERROR\n000")

BACKEND_HTTP_CODE=$(echo "$BACKEND_LOGIN_RESPONSE" | tail -1)
BACKEND_RESPONSE_BODY=$(echo "$BACKEND_LOGIN_RESPONSE" | sed '$d')

echo "HTTP Status Code: $BACKEND_HTTP_CODE"
echo ""
echo "Response Body:"
echo "$BACKEND_RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$BACKEND_RESPONSE_BODY"
echo ""

if [ "$BACKEND_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Login successful via Backend!${NC}"
    echo "   Frontend API proxy might be the issue"
elif [ "$BACKEND_HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ Login failed: Invalid credentials (401)${NC}"
    echo "   User doesn't exist or wrong password"
    echo "   Run: ./setup_admin.sh to create user"
elif [ "$BACKEND_HTTP_CODE" = "500" ]; then
    echo -e "${RED}❌ Login failed: Internal Server Error (500)${NC}"
    echo "   Check backend logs: docker logs moran-api --tail 100"
else
    echo -e "${YELLOW}⚠️  Backend login test returned: $BACKEND_HTTP_CODE${NC}"
fi

echo ""
echo "============================================================"
echo "DIAGNOSIS SUMMARY"
echo "============================================================"
echo ""
echo "If login failed:"
echo "  1. Check backend logs: docker logs moran-api --tail 100"
echo "  2. Check if user exists: Run ./setup_admin.sh"
echo "  3. Check backend health: curl $BACKEND_URL/health"
echo "  4. Check frontend logs: docker logs moran-frontend --tail 100"
echo ""
echo "If user doesn't exist, create it:"
echo "  ./setup_admin.sh"
echo ""
