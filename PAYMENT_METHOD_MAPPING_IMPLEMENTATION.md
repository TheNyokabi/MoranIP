# Payment Method Mapping Implementation

## Overview

Added automatic Mode of Payment creation and mapping to handle the discrepancy between our `PaymentMethod.type` enum values and ERPNext's actual `mode_of_payment` names.

## Problem

- Our `PaymentMethod.type` uses `'M-Pesa'` (with hyphen) for validation
- ERPNext might have `'Mpesa'` (without hyphen) or `'M-Pesa'` (with hyphen)
- POS Profile creation was failing with validation errors when the Mode of Payment didn't exist or had a different name

## Solution

### 1. Added `_ensure_mode_of_payment()` Helper Method

**Location**: `Backend/app/services/provisioning_service.py`

**Purpose**: 
- Ensures Mode of Payment exists in ERPNext
- Maps our `PaymentMethod.type` to ERPNext `mode_of_payment` names
- Handles name variations (e.g., 'M-Pesa' vs 'Mpesa')
- Creates missing payment methods automatically

**Features**:
- **Name Mapping**: Tries multiple possible names for each payment type
  - `'M-Pesa'` → tries `['M-Pesa', 'Mpesa']`
  - `'Card'` → tries `['Card', 'Credit Card']`
  - `'Bank'` → tries `['Bank', 'Bank Transfer']`
  - `'Cash'` → tries `['Cash']`
  - `'Credit'` → tries `['Credit']`

- **Type Mapping**: Maps our types to ERPNext types
  - `'Cash'` → `'Cash'`
  - `'M-Pesa'` → `'Bank'`
  - `'Card'` → `'Bank'`
  - `'Bank'` → `'Bank'`
  - `'Credit'` → `'General'`

- **Idempotency**: 
  - Checks if payment method exists before creating
  - Handles 409 conflicts gracefully
  - Returns existing name if found

- **Error Handling**:
  - Logs warnings for unknown payment types
  - Raises errors for creation failures
  - Handles race conditions (409 conflicts)

### 2. Integrated into POS Profile Creation

**Location**: `Backend/app/services/provisioning_service.py` - `_step_pos_profile()`

**Changes**:
- Before creating POS Profile, ensures all payment methods exist
- Maps each `PaymentMethod.type` to the actual ERPNext name
- Builds `payment_methods` array with correct names and types

**Flow**:
1. Create `PosProfileCreate` with our payment method types (`'Cash'`, `'M-Pesa'`)
2. For each enabled payment method:
   - Call `_ensure_mode_of_payment()` to get/create ERPNext payment method
   - Map our type to ERPNext type
   - Add to `payment_methods_for_erpnext` array
3. Create POS Profile with mapped payment methods

## Code Changes

### New Method: `_ensure_mode_of_payment()`

```python
def _ensure_mode_of_payment(
    self,
    tenant_id: str,
    payment_type: str,
    correlation_id: str
) -> str:
    """
    Ensure Mode of Payment exists in ERPNext and return the actual name to use.
    
    Maps our PaymentMethod.type to ERPNext mode_of_payment name.
    Handles variations like 'M-Pesa' vs 'Mpesa'.
    """
    # Mapping logic with name variations
    # Checks existing payment methods
    # Creates if missing
    # Returns actual name to use
```

### Updated Method: `_step_pos_profile()`

```python
# Ensure payment methods exist in ERPNext and get their actual names
payment_methods_for_erpnext = []
for pm in profile_data.payment_methods:
    if pm.enabled:
        erpnext_name = self._ensure_mode_of_payment(tenant_id, pm.type, correlation_id)
        # Map our type to ERPNext type
        type_mapping = {
            'Cash': 'Cash',
            'M-Pesa': 'Bank',
            'Card': 'Bank',
            'Bank': 'Bank',
            'Credit': 'General'
        }
        erpnext_type = type_mapping.get(pm.type, 'Bank')
        payment_methods_for_erpnext.append({
            "mode_of_payment": erpnext_name,
            "type": erpnext_type
        })
```

## Benefits

1. **Automatic Setup**: Payment methods are created automatically during provisioning
2. **Name Flexibility**: Handles variations in payment method names
3. **Idempotency**: Safe to run multiple times (checks before creating)
4. **Error Resilience**: Handles existing payment methods gracefully
5. **Type Safety**: Maintains our strict type validation while mapping to ERPNext

## Testing

### Expected Behavior

1. **First Time Provisioning**:
   - `'Cash'` → Creates "Cash" Mode of Payment (type: Cash)
   - `'M-Pesa'` → Creates "M-Pesa" Mode of Payment (type: Bank)
   - POS Profile created with both payment methods

2. **Subsequent Provisioning** (Idempotency):
   - Checks for existing payment methods
   - Uses existing names if found
   - Only creates missing ones

3. **Name Variations**:
   - If "Mpesa" exists, uses "Mpesa"
   - If "M-Pesa" exists, uses "M-Pesa"
   - If neither exists, creates "M-Pesa" (preferred name)

### Verification

```bash
# Check created payment methods in ERPNext
docker-compose exec api python -c "
from app.services.erpnext_client import erpnext_adapter
import sys
tenant_id = sys.argv[1]
response = erpnext_adapter.proxy_request(
    tenant_id,
    'resource/Mode of Payment',
    method='GET',
    params={'limit_page_length': 100}
)
print(response)
" <tenant_id>
```

## Files Modified

- `Backend/app/services/provisioning_service.py`
  - Added `_ensure_mode_of_payment()` method
  - Updated `_step_pos_profile()` to use payment method mapping

## Related Issues Fixed

- ✅ Payment method validation error (`'Mpesa'` vs `'M-Pesa'`)
- ✅ Missing Mode of Payment in ERPNext
- ✅ Name mismatch between our types and ERPNext names

## Future Enhancements

1. **Configuration**: Allow custom payment method names via provisioning config
2. **Account Mapping**: Automatically map payment methods to GL accounts
3. **Multi-Currency**: Support currency-specific payment methods
4. **Validation**: Add validation for payment method accounts before POS Profile creation
