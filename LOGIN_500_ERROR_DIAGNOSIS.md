# Login 500 Error Diagnosis

## Error Details

- **Error:** `POST http://localhost:4000/api/auth/login 500 (Internal Server Error)`
- **Location:** Next.js API Route Handler (`Frontend/src/app/api/[...path]/route.ts`)
- **Issue:** The API proxy route is returning a 500 error instead of proxying to the backend

## Root Cause Analysis

The error occurs in the Next.js API route handler, which means:
1. The API route is being hit (good)
2. Something is failing in the proxy code itself (bad)
3. OR the backend is not accessible/reachable

## API Proxy Route Location

- **File:** `Frontend/src/app/api/[...path]/route.ts`
- **Purpose:** Proxies all `/api/*` requests to backend at `http://localhost:9000`
- **Backend URL:** `http://localhost:9000` (from `NEXT_PUBLIC_API_URL` or default)

## Potential Issues

### 1. Backend Not Running
- Check if backend is running: `docker ps | grep moran-api`
- Check backend logs: `docker logs moran-api --tail 100`

### 2. Backend Not Accessible
- The backend might not be reachable from the Next.js container
- Check Docker network configuration
- Verify backend is listening on correct port (9000)

### 3. API Route Handler Error
- The proxy code might have a runtime error
- Check Next.js logs: `docker logs moran-frontend --tail 100`
- Look for JavaScript/TypeScript errors in the route handler

### 4. Request Body Reading Issue
- The route handler reads `req.arrayBuffer()` which might fail
- Check if request body is being read correctly

## Debugging Steps

### Step 1: Check Backend Status
```bash
# Check if backend container is running
docker ps | grep moran-api

# Check backend logs
docker logs moran-api --tail 100

# Test backend directly
curl -X POST http://localhost:9000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@moran.com", "password": "admin123"}'
```

### Step 2: Check Frontend Logs
```bash
# Check Next.js logs for errors
docker logs moran-frontend --tail 100

# Look for errors related to the API route
docker logs moran-frontend --tail 200 | grep -i "error\|exception\|failed"
```

### Step 3: Test API Route Directly
```bash
# Test the API route from within the container
docker exec moran-frontend curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@moran.com", "password": "admin123"}'
```

### Step 4: Check Network Connectivity
```bash
# Test if frontend can reach backend
docker exec moran-frontend curl http://localhost:9000/health

# Or if backend is on host network
docker exec moran-frontend curl http://host.docker.internal:9000/health
```

## Common Solutions

### Solution 1: Backend Not Running
```bash
# Start backend container
docker-compose up -d api

# Wait a few seconds for it to start
sleep 5

# Check logs
docker logs moran-api --tail 50
```

### Solution 2: Docker Network Issue
- Ensure frontend and backend are on the same Docker network
- Check `docker-compose.yml` network configuration
- Backend should be accessible at `http://moran-api:9000` or `http://localhost:9000`

### Solution 3: API Route Handler Fix
- The route handler code looks correct
- But Next.js 13+ App Router might have issues with dynamic params
- Check Next.js version compatibility

## Quick Fix Commands

```bash
# Restart both services
docker-compose restart frontend api

# Check status
docker-compose ps

# Check logs
docker-compose logs frontend api --tail 50
```

## Next Steps

1. **Check Backend Logs:** Most important - see what error the backend is returning
2. **Check Frontend Logs:** See if there's a Next.js error in the API route
3. **Test Backend Directly:** Verify backend `/auth/login` endpoint works
4. **Verify Network:** Ensure frontend can reach backend

## Most Likely Cause

Based on the 500 error from Next.js API route, the most likely causes are:
1. **Backend is not running or not accessible** (most common)
2. **Docker network configuration issue**
3. **Backend is returning an error that causes the proxy to fail**

**Recommendation:** Check backend logs first - `docker logs moran-api --tail 100`
