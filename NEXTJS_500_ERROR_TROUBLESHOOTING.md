# Next.js 500 Error Troubleshooting Guide

## Error Description

```
GET http://localhost:4000/_next/static/chunks/fallback/webpack.js net::ERR_ABORTED 500 (Internal Server Error)
GET http://localhost:4000/_next/static/chunks/fallback/main.js net::ERR_ABORTED 500 (Internal Server Error)
GET http://localhost:4000/_next/static/chunks/fallback/react-refresh.js net::ERR_ABORTED 500 (Internal Server Error)
```

## Root Cause

500 errors on Next.js static chunks typically indicate:
1. **Compilation/Build Failure** - TypeScript or JavaScript errors
2. **Dev Server Crash** - The Next.js dev server failed to start or crashed
3. **Missing Dependencies** - Required packages not installed
4. **Build Cache Corruption** - Corrupted `.next` directory
5. **Type Errors** - TypeScript compilation errors

## Troubleshooting Steps

### Step 1: Check Dev Server Logs

First, check the terminal where you're running `npm run dev`. Look for:
- TypeScript errors
- Import errors
- Missing module errors
- Syntax errors

### Step 2: Clear Build Cache

```bash
cd Frontend
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

### Step 3: Check TypeScript Errors

```bash
cd Frontend
npx tsc --noEmit
```

This will show TypeScript errors without building.

### Step 4: Verify Dependencies

```bash
cd Frontend
npm install
```

### Step 5: Check for Import Errors

Verify all imports are correct:
- Check that all API clients are properly exported
- Verify module paths are correct
- Check for circular dependencies

### Step 6: Check Browser Console

Open browser DevTools (F12) and check:
- Console errors
- Network tab for actual error responses
- Any error messages in the console

### Step 7: Check Server Logs

Check the terminal where Next.js is running for:
- Compilation errors
- Module resolution errors
- Runtime errors

## Common Issues and Fixes

### Issue 1: Missing Exports

If you see "Module not found" or "Cannot find module" errors, check:
- All exports in `Frontend/src/lib/api/index.ts`
- All imports in module pages
- File paths are correct

### Issue 2: TypeScript Errors

If TypeScript compilation fails:
- Check type definitions
- Verify all types are properly exported
- Check for missing type definitions

### Issue 3: Circular Dependencies

If you see circular dependency warnings:
- Check import chains
- Refactor to break circular dependencies

### Issue 4: Missing Dependencies

If packages are missing:
```bash
cd Frontend
npm install
```

### Issue 5: Build Cache Issues

If cache is corrupted:
```bash
cd Frontend
rm -rf .next
npm run dev
```

## Quick Fixes

### Restart Dev Server

1. Stop the dev server (Ctrl+C)
2. Clear cache: `rm -rf .next`
3. Restart: `npm run dev`

### Reinstall Dependencies

```bash
cd Frontend
rm -rf node_modules
npm install
npm run dev
```

### Check for Syntax Errors

Look for:
- Missing commas
- Unclosed brackets
- Incorrect import syntax
- Type errors

## Verification Checklist

- [ ] Dev server is running (`npm run dev`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] All dependencies installed (`npm install`)
- [ ] Build cache cleared (`.next` directory removed)
- [ ] Browser console checked for errors
- [ ] Server logs checked for errors
- [ ] All imports are correct
- [ ] All exports are correct

## Expected Behavior

After fixes, you should see:
- Dev server starts successfully
- No compilation errors
- Static chunks load with 200 status
- Pages load correctly

## If Issues Persist

1. Check the actual error message in the dev server logs
2. Check browser console for specific errors
3. Verify the specific file/page causing the error
4. Check for recent changes that might have caused the issue
