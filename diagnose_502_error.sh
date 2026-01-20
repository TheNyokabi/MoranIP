#!/bin/bash

# Diagnose 502 Bad Gateway Error
# This script helps identify why the frontend can't connect to the backend

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  502 Bad Gateway Diagnostic Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}1. Checking Docker containers...${NC}"
echo ""

# Check running containers
CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$CONTAINERS" ]; then
    echo -e "${RED}❌ No Docker containers are running${NC}"
    echo ""
    echo -e "${YELLOW}💡 Start the services:${NC}"
    echo "   docker-compose up -d"
    exit 1
fi

# Check for backend container
if echo "$CONTAINERS" | grep -q "moran-api\|api"; then
    echo -e "${GREEN}✅ Backend container is running${NC}"
    BACKEND_CONTAINER=$(echo "$CONTAINERS" | grep -E "moran-api|api" | head -1)
    echo "   Container: $BACKEND_CONTAINER"
else
    echo -e "${RED}❌ Backend container (moran-api) is NOT running${NC}"
    echo ""
    echo -e "${YELLOW}💡 Start the backend:${NC}"
    echo "   docker-compose up -d api"
    echo ""
fi

# Check for frontend container
if echo "$CONTAINERS" | grep -q "moran-frontend\|frontend"; then
    echo -e "${GREEN}✅ Frontend container is running${NC}"
    FRONTEND_CONTAINER=$(echo "$CONTAINERS" | grep -E "moran-frontend|frontend" | head -1)
    echo "   Container: $FRONTEND_CONTAINER"
else
    echo -e "${RED}❌ Frontend container is NOT running${NC}"
    echo ""
    echo -e "${YELLOW}💡 Start the frontend:${NC}"
    echo "   docker-compose up -d frontend"
    echo ""
fi

echo ""
echo -e "${YELLOW}2. Checking port mappings...${NC}"
echo ""

# Check port mappings
PORTS=$(docker ps --format "{{.Names}}\t{{.Ports}}" 2>/dev/null || echo "")

if echo "$PORTS" | grep -q "9000"; then
    echo -e "${GREEN}✅ Port 9000 is mapped (Backend)${NC}"
    echo "$PORTS" | grep "9000" | sed 's/^/   /'
else
    echo -e "${RED}❌ Port 9000 is NOT mapped${NC}"
    echo "   Backend should be accessible at http://localhost:9000"
fi

if echo "$PORTS" | grep -q "4000"; then
    echo -e "${GREEN}✅ Port 4000 is mapped (Frontend)${NC}"
    echo "$PORTS" | grep "4000" | sed 's/^/   /'
else
    echo -e "${RED}❌ Port 4000 is NOT mapped${NC}"
    echo "   Frontend should be accessible at http://localhost:4000"
fi

echo ""
echo -e "${YELLOW}3. Testing backend connectivity...${NC}"
echo ""

# Test backend health endpoint
BACKEND_URL="http://localhost:9000"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/health" 2>&1 || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Backend is accessible at ${BACKEND_URL}${NC}"
    echo "   Response: $BODY"
elif [ "$HTTP_CODE" -eq 000 ]; then
    echo -e "${RED}❌ Cannot connect to backend at ${BACKEND_URL}${NC}"
    echo "   Error: Connection refused or timeout"
    echo ""
    echo -e "${YELLOW}💡 Possible causes:${NC}"
    echo "   1. Backend container is not running"
    echo "   2. Backend is running on a different port"
    echo "   3. Backend is not exposed to host"
else
    echo -e "${YELLOW}⚠️  Backend responded with HTTP ${HTTP_CODE}${NC}"
    echo "   Response: $BODY"
fi

echo ""
echo -e "${YELLOW}4. Checking frontend environment variables...${NC}"
echo ""

# Check frontend container environment
if [ -n "$FRONTEND_CONTAINER" ]; then
    FRONTEND_ENV=$(docker exec "$FRONTEND_CONTAINER" env 2>/dev/null | grep "NEXT_PUBLIC_API_URL" || echo "")
    if [ -n "$FRONTEND_ENV" ]; then
        echo -e "${GREEN}✅ Frontend API URL configured:${NC}"
        echo "   $FRONTEND_ENV"
        
        # Extract the URL
        API_URL=$(echo "$FRONTEND_ENV" | cut -d'=' -f2-)
        if [[ "$API_URL" == *"api:8000"* ]]; then
            echo ""
            echo -e "${YELLOW}⚠️  Frontend is using Docker internal hostname (api:8000)${NC}"
            echo "   This is correct if both containers are in the same Docker network"
            echo "   But if frontend is running on host, it should use http://localhost:9000"
        fi
    else
        echo -e "${YELLOW}⚠️  NEXT_PUBLIC_API_URL not set in frontend container${NC}"
        echo "   Frontend will default to http://localhost:9000"
    fi
else
    echo -e "${RED}❌ Cannot check frontend environment (container not running)${NC}"
fi

echo ""
echo -e "${YELLOW}5. Testing frontend API proxy...${NC}"
echo ""

# Test frontend proxy
FRONTEND_URL="http://localhost:4000"
PROXY_RESPONSE=$(curl -s -w "\n%{http_code}" "${FRONTEND_URL}/api/health" 2>&1 || echo "000")
PROXY_HTTP_CODE=$(echo "$PROXY_RESPONSE" | tail -n1)
PROXY_BODY=$(echo "$PROXY_RESPONSE" | sed '$d')

if [ "$PROXY_HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Frontend proxy is working${NC}"
elif [ "$PROXY_HTTP_CODE" -eq 502 ]; then
    echo -e "${RED}❌ Frontend proxy returns 502 Bad Gateway${NC}"
    echo "   This means frontend can't reach backend"
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting steps:${NC}"
    echo "   1. Check if backend is running: docker ps | grep moran-api"
    echo "   2. Check backend logs: docker logs moran-api --tail 50"
    echo "   3. Check if both containers are on same network:"
    echo "      docker network inspect moran-network"
    echo "   4. Test backend directly: curl http://localhost:9000/health"
    echo "   5. Check frontend logs: docker logs moran-frontend --tail 50"
elif [ "$PROXY_HTTP_CODE" -eq 000 ]; then
    echo -e "${RED}❌ Cannot connect to frontend at ${FRONTEND_URL}${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend proxy returned HTTP ${PROXY_HTTP_CODE}${NC}"
    echo "   Response: $PROXY_BODY"
fi

echo ""
echo -e "${YELLOW}6. Checking Docker network...${NC}"
echo ""

# Check if containers are on same network
NETWORK_CHECK=$(docker network inspect moran-network --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "")
if [ -n "$NETWORK_CHECK" ]; then
    echo -e "${GREEN}✅ Containers on moran-network:${NC}"
    echo "$NETWORK_CHECK" | tr ' ' '\n' | sed 's/^/   /' | grep -v '^$'
    
    # Check if both containers are on network
    if echo "$NETWORK_CHECK" | grep -q "moran-api\|api" && echo "$NETWORK_CHECK" | grep -q "moran-frontend\|frontend"; then
        echo ""
        echo -e "${GREEN}✅ Both backend and frontend are on the same network${NC}"
    else
        echo ""
        echo -e "${RED}❌ Backend and frontend are NOT on the same network${NC}"
        echo "   They need to be on the same network to communicate"
    fi
else
    echo -e "${YELLOW}⚠️  moran-network not found or empty${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Summary & Recommendations${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Provide recommendations
if [ "$HTTP_CODE" -ne 200 ] && [ "$PROXY_HTTP_CODE" -eq 502 ]; then
    echo -e "${RED}❌ Issue: Backend is not accessible${NC}"
    echo ""
    echo -e "${YELLOW}Recommended fixes:${NC}"
    echo "1. Start backend: docker-compose up -d api"
    echo "2. Wait for backend to be healthy: docker-compose ps"
    echo "3. Check backend logs: docker logs moran-api --tail 100"
    echo "4. Restart frontend: docker-compose restart frontend"
elif [ "$HTTP_CODE" -eq 200 ] && [ "$PROXY_HTTP_CODE" -eq 502 ]; then
    echo -e "${RED}❌ Issue: Backend is accessible but frontend proxy can't reach it${NC}"
    echo ""
    echo -e "${YELLOW}Recommended fixes:${NC}"
    echo "1. Check frontend environment: docker exec moran-frontend env | grep API"
    echo "2. Restart frontend: docker-compose restart frontend"
    echo "3. Check frontend logs: docker logs moran-frontend --tail 100"
    echo "4. Verify network: docker network inspect moran-network"
else
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "If you're still getting 502 errors, check:"
    echo "1. Browser console for detailed error messages"
    echo "2. Frontend logs: docker logs moran-frontend --tail 100"
    echo "3. Backend logs: docker logs moran-api --tail 100"
fi

echo ""
