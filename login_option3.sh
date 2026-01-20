#!/bin/bash

# Option 3: Login and Save Token
# Tests both direct backend and frontend proxy, saves token

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Option 3: Login and Save Token${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:9000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:4000}"
EMAIL="${EMAIL:-admin@moran.com}"
PASSWORD="${PASSWORD:-admin123}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Backend URL: ${BACKEND_URL}"
echo "  Frontend URL: ${FRONTEND_URL}"
echo "  Email: ${EMAIL}"
echo ""

# Function to extract token from response
extract_token() {
    echo "$1" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    token = data.get('access_token', '')
    if not token:
        token = data.get('data', {}).get('access_token', '')
    print(token)
except:
    print('')
" 2>/dev/null
}

# Function to test login
test_login() {
    local URL=$1
    local NAME=$2
    
    echo -e "${YELLOW}Testing ${NAME}...${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "${URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}" 2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        TOKEN=$(extract_token "$BODY")
        if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
            echo -e "${GREEN}✅ Login successful via ${NAME}!${NC}"
            echo ""
            echo -e "${GREEN}📝 Access Token:${NC}"
            echo "$TOKEN"
            echo ""
            
            # Show tenant info
            echo "$BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', data.get('data', {}).get('tenants', []))
    if tenants:
        print('🏢 Available Tenants:')
        for t in tenants:
            print(f\"  - {t.get('name', 'N/A')} (ID: {t.get('id', 'N/A')})\")
except:
    pass
" 2>/dev/null
            echo ""
            
            # Save token
            echo "export AUTH_TOKEN=\"$TOKEN\"" > .auth_token.sh
            echo "export BACKEND_URL=\"$BACKEND_URL\"" >> .auth_token.sh
            echo "export FRONTEND_URL=\"$FRONTEND_URL\"" >> .auth_token.sh
            echo ""
            echo -e "${GREEN}💾 Token saved to .auth_token.sh${NC}"
            echo ""
            echo -e "${YELLOW}💡 To use the token:${NC}"
            echo "   source .auth_token.sh"
            echo ""
            echo -e "${YELLOW}💡 Example authenticated requests:${NC}"
            echo "   # Direct backend:"
            echo "   curl -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
            echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
            echo "        \${BACKEND_URL}/pos/items"
            echo ""
            echo "   # Via frontend proxy:"
            echo "   curl -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
            echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
            echo "        \${FRONTEND_URL}/api/pos/items"
            
            return 0
        else
            echo -e "${RED}❌ Token not found in response${NC}"
            return 1
        fi
    elif [ "$HTTP_CODE" -eq 000 ] || [ -z "$HTTP_CODE" ]; then
        echo -e "${RED}❌ Connection failed: Cannot reach ${NAME} at ${URL}${NC}"
        return 1
    else
        echo -e "${RED}❌ Login failed: HTTP ${HTTP_CODE}${NC}"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY" | head -5
        return 1
    fi
}

# Try direct backend first
if test_login "$BACKEND_URL" "Backend (Direct)"; then
    exit 0
fi

echo ""
echo -e "${YELLOW}Trying Frontend Proxy...${NC}"
echo ""

# Try frontend proxy
if test_login "${FRONTEND_URL}/api" "Frontend Proxy"; then
    exit 0
fi

# If both failed
echo ""
echo -e "${RED}❌ Both login methods failed${NC}"
echo ""
echo -e "${YELLOW}💡 Troubleshooting:${NC}"
echo "   1. Check if backend is running:"
echo "      docker ps | grep moran-api"
echo ""
echo "   2. Check backend logs:"
echo "      docker logs moran-api --tail 50"
echo ""
echo "   3. Check if frontend is running:"
echo "      docker ps | grep moran-frontend"
echo ""
echo "   4. Start services if needed:"
echo "      docker-compose up -d api"
echo "      docker-compose up -d frontend"
echo ""
echo "   5. Try different credentials:"
echo "      EMAIL=user@example.com PASSWORD=pass123 ./login_option3.sh"
echo ""
echo "   6. Check port mappings:"
echo "      Backend should be on port 9000 (from docker-compose.yml)"
echo "      Frontend should be on port 4000"

exit 1
