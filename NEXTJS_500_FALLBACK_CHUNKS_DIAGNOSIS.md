# Next.js 500 Errors on Fallback Chunks - Diagnosis Guide

## Understanding the Error

When you see these errors:
```
GET http://localhost:4000/_next/static/chunks/fallback/webpack.js net::ERR_ABORTED 500
GET http://localhost:4000/_next/static/chunks/fallback/main.js net::ERR_ABORTED 500
GET http://localhost:4000/_next/static/chunks/fallback/react-refresh.js net::ERR_ABORTED 500
GET http://localhost:4000/_next/static/chunks/fallback/pages/_app.js net::ERR_ABORTED 500
GET http://localhost:4000/_next/static/chunks/fallback/pages/_error.js net::ERR_ABORTED 500
```

**What it means:**
- Next.js encountered a **compilation error** during the build/dev process
- The main application chunks failed to compile
- Next.js tried to serve **fallback/error pages** instead
- Even the fallback chunks are failing (500 errors)

**Root cause:** There's a compilation error preventing Next.js from building successfully.

## Critical First Step: Check Docker Logs

The actual error message will be in the Docker container logs. **You MUST check these logs to see the real error.**

```bash
# Check the last 200 lines of logs
docker logs moran-frontend --tail 200

# Or follow logs in real-time
docker logs moran-frontend -f
```

Look for errors like:
- `SyntaxError`
- `Module not found`
- `TypeError`
- `Cannot find module`
- `Unexpected token`
- `Export/Import errors`
- `Type errors`

## Common Causes

### 1. Import/Export Errors
- Missing exports
- Incorrect import paths
- Circular dependencies
- Missing dependencies

### 2. TypeScript Errors
- Type mismatches
- Missing type definitions
- Syntax errors

### 3. Missing Dependencies
- Package not installed
- Version conflicts
- Missing peer dependencies

### 4. Configuration Issues
- `next.config.js` errors
- `tsconfig.json` errors
- Environment variable issues

## Step-by-Step Fix Process

### Step 1: Get the Actual Error (CRITICAL)
```bash
docker logs moran-frontend --tail 200
```

**Copy the error message** - this is the key to fixing the issue.

### Step 2: Check Container Status
```bash
docker ps | grep moran-frontend
```

Make sure the container is running. If it's not running or keeps restarting, that indicates a fatal error.

### Step 3: Restart the Container
```bash
# Clear Next.js cache and restart
docker-compose restart frontend

# Wait 10-15 seconds for it to start
sleep 15

# Check logs again
docker logs moran-frontend --tail 50
```

### Step 4: If Restart Doesn't Work
```bash
# Rebuild the container from scratch
docker-compose up -d --build frontend

# Wait for build to complete
docker logs moran-frontend -f
```

### Step 5: Check for Specific Errors

Once you have the error message from the logs, look for these common patterns:

#### Module Not Found
```
Error: Cannot find module 'X'
```
**Fix:** Check if the module exists and is properly imported.

#### TypeScript Errors
```
Type error: X is not assignable to type Y
```
**Fix:** Check type definitions and fix type mismatches.

#### Syntax Errors
```
SyntaxError: Unexpected token
```
**Fix:** Check for syntax errors in the file mentioned.

#### Import Errors
```
Attempted import error: 'X' is not exported from 'Y'
```
**Fix:** Check exports in the source file.

## Quick Diagnostic Script

Run this to get a comprehensive view:

```bash
#!/bin/bash
echo "=== Container Status ==="
docker ps | grep moran-frontend

echo ""
echo "=== Recent Logs (last 100 lines) ==="
docker logs moran-frontend --tail 100

echo ""
echo "=== Checking for Common Errors ==="
docker logs moran-frontend --tail 200 | grep -i "error\|failed\|cannot\|not found" | tail -20
```

## What to Share for Help

If you need help fixing the error, share:

1. **The error message from Docker logs** (most important!)
2. The file path mentioned in the error
3. The line number (if available)
4. Container status: `docker ps | grep moran-frontend`
5. Full error context: `docker logs moran-frontend --tail 200`

## Next Steps After Getting the Error

1. **If it's a module error:** Check imports/exports
2. **If it's a type error:** Fix TypeScript issues
3. **If it's a syntax error:** Fix the syntax
4. **If it's a config error:** Fix configuration files

Once you have the actual error message from the logs, I can help fix it!
