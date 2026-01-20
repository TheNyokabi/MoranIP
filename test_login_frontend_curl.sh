#!/bin/bash

# Test Login via Frontend API Proxy
# This script tests login through the Next.js frontend proxy (http://localhost:4000/api)
# which then forwards to the backend (http://localhost:9000)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Login Test via Frontend API Proxy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
FRONTEND_URL="${FRONTEND_URL:-http://localhost:4000}"
API_BASE="${FRONTEND_URL}/api"
LOGIN_ENDPOINT="${API_BASE}/auth/login"

# Default credentials (can be overridden via environment variables)
EMAIL="${EMAIL:-admin@moran.com}"
PASSWORD="${PASSWORD:-admin123}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Frontend URL: ${FRONTEND_URL}"
echo "  API Base: ${API_BASE}"
echo "  Login Endpoint: ${LOGIN_ENDPOINT}"
echo "  Email: ${EMAIL}"
echo ""
echo -e "${YELLOW}Testing connection to frontend...${NC}"

# Test if frontend is accessible
if ! curl -s -f "${FRONTEND_URL}" > /dev/null 2>&1; then
    echo -e "${RED}❌ Frontend is not accessible at ${FRONTEND_URL}${NC}"
    echo -e "${YELLOW}   Make sure the frontend is running:${NC}"
    echo "   docker-compose up frontend"
    echo "   or"
    echo "   cd Frontend && npm run dev"
    exit 1
fi

echo -e "${GREEN}✅ Frontend is accessible${NC}"
echo ""

echo -e "${YELLOW}Sending login request...${NC}"
echo "  POST ${LOGIN_ENDPOINT}"
echo "  Body: {\"email\": \"${EMAIL}\", \"password\": \"***\"}"
echo ""

# Make login request
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}" \
    "${LOGIN_ENDPOINT}")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "${YELLOW}Response:${NC}"
echo "  HTTP Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    echo ""
    echo -e "${YELLOW}Response Body:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extract token if jq is available
    if command -v jq &> /dev/null; then
        TOKEN=$(echo "$BODY" | jq -r '.access_token // .data.access_token // empty')
        if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
            echo -e "${GREEN}✅ Access Token extracted:${NC}"
            echo "  ${TOKEN:0:50}..."
            echo ""
            echo -e "${YELLOW}💡 Save this token for subsequent requests:${NC}"
            echo "   export AUTH_TOKEN=\"${TOKEN}\""
            echo ""
            echo -e "${YELLOW}Example authenticated request:${NC}"
            echo "   curl -H \"Authorization: Bearer \${AUTH_TOKEN}\" \\"
            echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
            echo "        ${API_BASE}/pos/items"
        fi
        
        # Extract tenant info
        TENANTS=$(echo "$BODY" | jq -r '.tenants // .data.tenants // []')
        if [ "$TENANTS" != "[]" ] && [ "$TENANTS" != "null" ]; then
            echo ""
            echo -e "${YELLOW}Available Tenants:${NC}"
            echo "$BODY" | jq -r '.tenants // .data.tenants | .[] | "  - \(.name) (ID: \(.id))"'
        fi
    fi
elif [ "$HTTP_CODE" -eq 401 ]; then
    echo -e "${RED}❌ Login failed: Invalid credentials${NC}"
    echo ""
    echo -e "${YELLOW}Response Body:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}💡 Try different credentials:${NC}"
    echo "   EMAIL=your@email.com PASSWORD=yourpass ./test_login_frontend_curl.sh"
elif [ "$HTTP_CODE" -eq 500 ]; then
    echo -e "${RED}❌ Internal Server Error${NC}"
    echo ""
    echo -e "${YELLOW}Response Body:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo "   1. Check backend logs: docker logs moran-api --tail 50"
    echo "   2. Check if backend is running: docker ps | grep moran-api"
    echo "   3. Check frontend logs: docker logs moran-frontend --tail 50"
    echo "   4. Verify database connection"
elif [ "$HTTP_CODE" -eq 502 ]; then
    echo -e "${RED}❌ Bad Gateway - Frontend cannot connect to backend${NC}"
    echo ""
    echo -e "${YELLOW}Response Body:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo "   1. Check if backend is running: docker ps | grep moran-api"
    echo "   2. Check backend URL in frontend .env: NEXT_PUBLIC_API_URL"
    echo "   3. Check backend logs: docker logs moran-api --tail 50"
else
    echo -e "${RED}❌ Unexpected response: HTTP ${HTTP_CODE}${NC}"
    echo ""
    echo -e "${YELLOW}Response Body:${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
