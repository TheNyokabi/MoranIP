# POS Invoice Zero Amount Issue - Debug Guide

## Problem
Invoices are being created but showing zero amounts instead of the cart totals.

## Investigation Summary

### Data Flow
1. **Frontend**: Items loaded from `/api/pos/items` with `standard_rate` field
2. **Frontend**: Items added to cart with `rate = item.standard_rate`
3. **Frontend**: Invoice created with `items: cart.map(c => ({ item_code, qty, rate: c.rate }))`
4. **Backend**: Receives invoice request with items containing `rate` field
5. **Backend**: For each item, uses `rate = item.rate or item_detail.get("standard_rate", 0)`
6. **Backend**: Sends to ERPNext with calculated `rate` and `amount`

### Potential Root Causes
1. **Items have zero standard_rate in ERPNext** - Most likely cause
2. **Frontend cart items have rate = 0** - Need to verify
3. **Backend not sending rate correctly to ERPNext** - Need to verify
4. **ERPNext not accepting/processing the rate field** - Need to verify

## Debug Logging Added

### Visual Indicators (Frontend)

**Item cards with zero rates:**
- Border highlighted in amber/orange
- Price shown in amber color with "(No Price)" label
- Makes it immediately obvious which items have pricing issues

### Frontend (`Frontend/src/app/w/[tenantSlug]/pos/page.tsx`)

**When adding items to cart (line ~420):**
```typescript
console.log('[POS DEBUG] Adding item to cart:', {
    item_code: item.item_code,
    item_name: item.item_name,
    standard_rate: item.standard_rate,
    stock_qty: item.stock_qty
})
console.log('[POS DEBUG] New cart item created:', newCartItem)
```

**Before creating invoice (line ~505):**
```typescript
console.log('[POS DEBUG] Cart items before invoice creation:')
cart.forEach((item, idx) => {
    console.log(`  [${idx}] ${item.item_code}: qty=${item.qty}, rate=${item.rate}, total=${item.total}`)
})
console.log('[POS DEBUG] Cart totals: subtotal=${cartTotal}, vat=${cartVat}, grand_total=${cartGrandTotal}')
console.log('[POS DEBUG] Invoice payload being sent to backend:', JSON.stringify(invoice, null, 2))
```

### Backend (`Backend/app/routers/pos.py`)

**When receiving invoice request (line ~1145):**
```python
logger.info(f"[POS DEBUG] Received invoice request for tenant {tenant_id}")
logger.info(f"[POS DEBUG] Invoice items received:")
for idx, item in enumerate(invoice.items):
    logger.info(f"  [{idx}] item_code={item.item_code}, qty={item.qty}, rate={item.rate}, is_vatable={item.is_vatable}")
```

**When calculating rate for each item (line ~1160):**
```python
logger.info(f"[POS DEBUG] Item {item.item_code}: frontend_rate={item.rate}, erpnext_standard_rate={item_detail.get('standard_rate')}, final_rate={rate}, qty={item.qty}, amount={amount}")
```

**Before sending to ERPNext (line ~1390):**
```python
logger.info(f"[POS DEBUG] Payload being sent to ERPNext:")
logger.info(f"  Customer: {payload.get('customer')}")
logger.info(f"  Items ({len(payload.get('items', []))}):")
for idx, item in enumerate(payload.get('items', [])):
    logger.info(f"    [{idx}] {item.get('item_code')}: qty={item.get('qty')}, rate={item.get('rate')}, amount={item.get('qty', 0) * item.get('rate', 0)}")
logger.info(f"  Payments: {payload.get('payments')}")
logger.info(f"  Taxes: {payload.get('taxes')}")
```

**After ERPNext response (line ~1400):**
```python
logger.info(f"[POS DEBUG] ERPNext response received:")
if isinstance(result, dict):
    logger.info(f"  Invoice name: {result.get('name')}")
    logger.info(f"  Grand total: {result.get('grand_total')}")
    logger.info(f"  Net total: {result.get('net_total')}")
    logger.info(f"  Total taxes: {result.get('total_taxes_and_charges')}")
```

## Testing Steps

1. **Open browser console** (F12) and navigate to POS page
2. **Check backend logs** - tail the backend logs to see debug output
3. **Add an item to cart** and check console logs:
   - Does the item have a `standard_rate > 0`?
   - Is the cart item created with `rate > 0`?
4. **Process a sale** and check both console and backend logs:
   - Frontend: Are cart items showing correct rates?
   - Backend: Are items received with correct rates?
   - Backend: What rate is calculated (frontend vs ERPNext)?
   - Backend: What payload is sent to ERPNext?
   - Backend: What does ERPNext return?

## Expected Findings

### Scenario 1: Items have zero standard_rate in ERPNext
**Symptoms:**
- Frontend logs show `standard_rate: 0` when adding to cart
- Cart items have `rate: 0`
- Backend receives `rate: 0` from frontend
- Backend logs show `erpnext_standard_rate=0, final_rate=0`

**Solution:** Update item prices in ERPNext or set default pricing

### Scenario 2: Frontend not setting rate correctly
**Symptoms:**
- Frontend logs show `standard_rate: 100` but cart item has `rate: 0`
- Backend receives `rate: 0` from frontend

**Solution:** Fix cart item creation logic in `addToCart()`

### Scenario 3: Backend not sending rate to ERPNext
**Symptoms:**
- Backend receives `rate: 100` from frontend
- Backend calculates `final_rate=100`
- Payload shows `rate: 100`
- ERPNext returns invoice with `grand_total: 0`

**Solution:** Check ERPNext API requirements or field mapping

### Scenario 4: ERPNext not processing rate
**Symptoms:**
- Everything looks correct in logs
- ERPNext returns invoice with zero amounts

**Solution:** Check ERPNext Sales Invoice doctype configuration, pricing rules, or permissions

## Quick Test Commands

### Check item prices in ERPNext
```bash
# Via backend API
curl -X GET "http://localhost:8000/api/pos/items" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.items[] | {item_code, standard_rate}'
```

### Check backend logs
```bash
# If running with docker-compose
docker-compose logs -f backend | grep "POS DEBUG"

# If running locally
tail -f backend.log | grep "POS DEBUG"
```

## Files Modified
- `Frontend/src/app/w/[tenantSlug]/pos/page.tsx` - Added debug logging
- `Backend/app/routers/pos.py` - Added debug logging

## Next Steps
1. Run a test sale with the debug logging enabled
2. Analyze the logs to identify where the rate becomes zero
3. Implement the appropriate fix based on findings
4. Remove or reduce debug logging once issue is resolved
