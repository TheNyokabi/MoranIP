#!/bin/bash

# Login directly to Backend and Save Token
# This bypasses the frontend proxy and connects directly to the backend

set -e

echo "🔐 Logging in directly to backend..."
echo ""

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:9000}"
LOGIN_ENDPOINT="${BACKEND_URL}/api/auth/login"

# Default credentials
EMAIL="${EMAIL:-admin@moran.com}"
PASSWORD="${PASSWORD:-admin123}"

echo "📋 Configuration:"
echo "  Backend URL: ${BACKEND_URL}"
echo "  Login Endpoint: ${LOGIN_ENDPOINT}"
echo "  Email: ${EMAIL}"
echo ""

# Make login request and capture response
echo "🔄 Sending login request..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${LOGIN_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${EMAIL}\", \"password\": \"${PASSWORD}\"}")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "  HTTP Status: ${HTTP_CODE}"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    # Extract token
    TOKEN=$(echo "$BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    token = data.get('access_token', '')
    if not token:
        token = data.get('data', {}).get('access_token', '')
    print(token)
except:
    print('')
" 2>/dev/null)
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
        echo "✅ Login successful!"
        echo ""
        echo "📝 Access Token:"
        echo "$TOKEN"
        echo ""
        
        # Show full response
        echo "🔍 Full Response:"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
        echo ""
        
        # Extract and show tenant info
        echo "🏢 Available Tenants:"
        echo "$BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', data.get('data', {}).get('tenants', []))
    if tenants:
        for t in tenants:
            print(f\"  - {t.get('name', 'N/A')} (ID: {t.get('id', 'N/A')})\")
    else:
        print('  No tenants found')
except:
    print('  Could not parse tenant info')
" 2>/dev/null
        echo ""
        
        # Save token to file
        echo "export AUTH_TOKEN=\"$TOKEN\"" > .auth_token.sh
        echo "export BACKEND_URL=\"$BACKEND_URL\"" >> .auth_token.sh
        echo ""
        echo "💾 Token saved to .auth_token.sh"
        echo ""
        echo "💡 To use the token:"
        echo "   source .auth_token.sh"
        echo ""
        echo "💡 Example authenticated request:"
        echo "   curl -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
        echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
        echo "        ${BACKEND_URL}/api/pos/items"
        echo ""
        echo "💡 Or via frontend proxy (once frontend is configured):"
        echo "   curl -H \"Authorization: Bearer \$AUTH_TOKEN\" \\"
        echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
        echo "        http://localhost:4000/api/pos/items"
    else
        echo "❌ Token not found in response"
        echo ""
        echo "📋 Full Response:"
        echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    fi
elif [ "$HTTP_CODE" -eq 401 ]; then
    echo "❌ Login failed: Invalid credentials"
    echo ""
    echo "📋 Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "💡 Try different credentials:"
    echo "   EMAIL=user@example.com PASSWORD=pass123 ./login_and_save_token_direct.sh"
elif [ "$HTTP_CODE" -eq 000 ] || [ -z "$HTTP_CODE" ]; then
    echo "❌ Connection failed: Cannot reach backend at ${BACKEND_URL}"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check if backend is running: docker ps | grep moran-api"
    echo "   2. Check backend logs: docker logs moran-api --tail 50"
    echo "   3. Try different backend URL: BACKEND_URL=http://localhost:8000 ./login_and_save_token_direct.sh"
    echo "   4. Check if port 9000 is correct (backend might be on port 8000)"
else
    echo "❌ Unexpected response: HTTP ${HTTP_CODE}"
    echo ""
    echo "📋 Response:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check backend logs: docker logs moran-api --tail 50"
    echo "   2. Check if backend is running: docker ps | grep moran-api"
fi
