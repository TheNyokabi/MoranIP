# Docker Frontend 500 Error Troubleshooting

## Error Context
- Running in Docker containers
- Frontend container: `moran-frontend`
- Port: 4000
- Next.js dev server

## Quick Docker Commands

### Check Frontend Container Status
```bash
docker ps | grep frontend
```

### Check Frontend Container Logs
```bash
docker logs moran-frontend --tail 100
```

### Restart Frontend Container
```bash
docker-compose restart frontend
```

### Rebuild and Restart Frontend
```bash
docker-compose up -d --build frontend
```

### Access Frontend Container Shell
```bash
docker exec -it moran-frontend sh
```

## Step-by-Step Troubleshooting

### Step 1: Check Container Logs
The most important step - check what's actually failing:

```bash
docker logs moran-frontend --tail 200 -f
```

Look for:
- TypeScript compilation errors
- Module not found errors
- Import errors
- Syntax errors
- Build failures

### Step 2: Check Container Status
```bash
docker ps -a | grep frontend
```

Verify the container is:
- Running (not exited)
- Healthy (if healthcheck exists)

### Step 3: Restart Container (Quick Fix)
```bash
docker-compose restart frontend
```

This clears the Next.js cache and restarts the dev server.

### Step 4: Clear Build Cache (If restart doesn't work)
```bash
# Stop container
docker-compose stop frontend

# Remove .next directory inside container
docker exec -it moran-frontend rm -rf /app/.next

# Restart
docker-compose start frontend
```

### Step 5: Rebuild Container (If code changes aren't reflected)
```bash
docker-compose up -d --build frontend
```

### Step 6: Check for Compilation Errors Inside Container
```bash
docker exec -it moran-frontend sh

# Inside container:
cd /app
npx tsc --noEmit
npm run build
```

### Step 7: Check Volume Mounts
Verify that code is properly mounted:

```bash
docker inspect moran-frontend | grep -A 10 Mounts
```

Expected volumes:
- `./Frontend:/app` (source code)
- `/app/node_modules` (anonymous volume for node_modules)

## Common Docker-Specific Issues

### Issue 1: Volume Mount Problems
If code changes aren't reflected:

```bash
# Check if files are synced
docker exec -it moran-frontend ls -la /app/src/app/w
```

### Issue 2: Node Modules Cache
If dependencies are missing or outdated:

```bash
docker-compose exec frontend npm install
```

### Issue 3: File Permissions
If files can't be read:

```bash
# Check file permissions
docker exec -it moran-frontend ls -la /app
```

### Issue 4: Memory Limits
If container is crashing:

```bash
# Check memory usage
docker stats moran-frontend
```

### Issue 5: Port Conflicts
If port 4000 is already in use:

```bash
# Check what's using the port
lsof -i :4000
# or
docker ps | grep 4000
```

## Complete Reset (Nuclear Option)

If nothing else works:

```bash
# Stop and remove container
docker-compose stop frontend
docker-compose rm -f frontend

# Remove build cache
docker volume prune

# Rebuild from scratch
docker-compose up -d --build frontend
```

## Verify Fix

After applying fixes:

1. Check logs: `docker logs moran-frontend --tail 50`
2. Check container status: `docker ps | grep frontend`
3. Access frontend: `http://localhost:4000`
4. Check browser console (should see no 500 errors)

## Expected Log Output (Healthy)

```
✓ Ready in Xms
○ Compiling / ...
✓ Compiled / in Xms
```

## Error Log Patterns

### TypeScript Error
```
Error: [tsl] ERROR in .../page.tsx(X:Y)
TSXXXX: Error message
```

### Import Error
```
Module not found: Can't resolve '@/lib/api/...'
```

### Build Error
```
Failed to compile
```

### Memory Error
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

## Next Steps After Fixing

1. Verify all modules load correctly
2. Test CRUD operations
3. Run test script: `./test_all_crud_features.sh`
4. Check for any other errors
