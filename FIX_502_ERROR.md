# Fix 502 Bad Gateway Error

## Problem
The frontend is returning `502 Bad Gateway` when trying to login. This means the Next.js API route (frontend proxy) cannot connect to the backend.

## Error Message
```
POST http://localhost:4000/api/auth/login 502 (Bad Gateway)
```

## Root Causes

### 1. Backend Not Running
The backend container (`moran-api`) is not running or not accessible.

**Solution:**
```bash
# Start the backend
docker-compose up -d api

# Check if it's running
docker ps | grep moran-api

# Check backend logs
docker logs moran-api --tail 50
```

### 2. Wrong Backend URL Configuration
The frontend is configured with the wrong backend URL.

**Check current configuration:**
```bash
# Check frontend environment variable
docker exec moran-frontend env | grep NEXT_PUBLIC_API_URL
```

**Expected values:**
- If running in Docker: `NEXT_PUBLIC_API_URL=http://api:8000` (Docker internal)
- If running on host: `NEXT_PUBLIC_API_URL=http://localhost:9000` (host machine)

**Fix:**
```bash
# If frontend is in Docker, it should use Docker internal hostname
# Update docker-compose.yml or .env file:
NEXT_PUBLIC_API_URL=http://api:8000

# Then restart frontend
docker-compose restart frontend
```

### 3. Network Issues
Backend and frontend containers are not on the same Docker network.

**Check:**
```bash
# Check if both containers are on the same network
docker network inspect moran-network

# Should show both moran-api and moran-frontend
```

**Fix:**
```bash
# Recreate containers to ensure they're on the same network
docker-compose down
docker-compose up -d
```

### 4. Backend Port Not Exposed
Backend is running but port 9000 is not exposed to the host.

**Check:**
```bash
# Check port mappings
docker ps --format "{{.Names}}\t{{.Ports}}" | grep moran-api

# Should show: 0.0.0.0:9000->8000/tcp
```

**Fix:**
```bash
# Verify docker-compose.yml has:
ports:
  - "9000:8000"
```

## Quick Diagnostic

Run the diagnostic script:
```bash
./diagnose_502_error.sh
```

This will check all the above issues and provide specific recommendations.

## Step-by-Step Fix

### Step 1: Verify Backend is Running
```bash
# Check backend status
docker ps | grep moran-api

# If not running, start it
docker-compose up -d api

# Wait for it to be healthy
docker-compose ps
```

### Step 2: Test Backend Directly
```bash
# Test backend health endpoint
curl http://localhost:9000/health

# Should return: {"status": "healthy"} or similar
```

### Step 3: Check Frontend Configuration
```bash
# Check frontend environment
docker exec moran-frontend env | grep NEXT_PUBLIC_API_URL

# If empty or wrong, check docker-compose.yml
grep NEXT_PUBLIC_API_URL docker-compose.yml
```

### Step 4: Restart Services
```bash
# Restart both services
docker-compose restart api frontend

# Or recreate everything
docker-compose down
docker-compose up -d
```

### Step 5: Check Logs
```bash
# Frontend logs
docker logs moran-frontend --tail 100

# Backend logs
docker logs moran-api --tail 100

# Look for connection errors or configuration issues
```

## Common Solutions

### Solution 1: Backend Not Started
```bash
docker-compose up -d api
sleep 5
docker-compose restart frontend
```

### Solution 2: Wrong API URL in Frontend
If frontend is in Docker, it should use `http://api:8000`:
```bash
# Update docker-compose.yml
# Under frontend service, ensure:
environment:
  - NEXT_PUBLIC_API_URL=http://api:8000

# Then restart
docker-compose restart frontend
```

### Solution 3: Network Issues
```bash
# Recreate network and containers
docker-compose down
docker network prune -f
docker-compose up -d
```

### Solution 4: Port Conflicts
If port 9000 is already in use:
```bash
# Check what's using port 9000
lsof -i :9000

# Or change the port in docker-compose.yml
ports:
  - "9001:8000"  # Use 9001 instead
```

## Testing After Fix

1. **Test backend directly:**
   ```bash
   curl http://localhost:9000/health
   ```

2. **Test frontend proxy:**
   ```bash
   curl http://localhost:4000/api/health
   ```

3. **Test login via frontend:**
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@moran.com", "password": "admin123"}'
   ```

## Still Having Issues?

1. Run the diagnostic script: `./diagnose_502_error.sh`
2. Check all logs: `docker-compose logs --tail=100`
3. Verify Docker network: `docker network inspect moran-network`
4. Check if services are healthy: `docker-compose ps`

## Prevention

To prevent this issue:
1. Always start services with `docker-compose up -d`
2. Use health checks in docker-compose.yml
3. Ensure `NEXT_PUBLIC_API_URL` is correctly set for your environment
4. Keep containers on the same Docker network
