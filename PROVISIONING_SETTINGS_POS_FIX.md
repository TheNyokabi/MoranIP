# Provisioning Settings and POS Session Fixes

## Issues Fixed

### Issue 1: Stock Settings - Group Warehouse Error

**Error**: `Group Warehouses cannot be used in transactions. Please change the value of <strong>Default Warehouse</strong>`

**Root Cause**: The stock settings step was using the first warehouse from the list without checking if it was a group warehouse. ERPNext requires a non-group (leaf) warehouse for the default warehouse in stock settings.

**Solution**:
- Modified `_step_settings` to filter warehouses by `is_group = 0`
- Prioritizes non-group warehouses for default warehouse selection
- Falls back to group warehouse only if no non-group warehouses exist (with warning)
- Ensures at least one non-group warehouse exists before proceeding

**Code Changes**:
```python
# Find first non-group warehouse (is_group = 0)
main_store = None
for wh in existing_warehouses:
    if isinstance(wh, dict):
        is_group = wh.get("is_group", 1)
        if is_group == 0:  # Non-group warehouse
            main_store = wh.get("name")
            break
```

### Issue 2: POS Session - Company Name Mismatch

**Error**: `POS Profile Default POS Profile - All Warehouses - FRECOR does not belong to company Thef`

**Root Cause**: The POS Opening Entry was being created with a company name that didn't match the company name in the POS Profile. This happens when:
- Company abbreviation is used in POS Profile name
- Company name changes or is truncated
- POS Profile was created with different company context

**Solution**:
- Fetch the POS Profile to get its actual company name
- Use the company name from the POS Profile when creating POS Opening Entry
- Ensures company name matches between POS Profile and POS Opening Entry

**Code Changes**:
```python
# Verify POS Profile belongs to the correct company
profile_response = erpnext_adapter.proxy_request(
    tenant_id,
    f"resource/POS Profile/{pos_profile_id}",
    method="GET"
)
profile_company = profile_data.get("company")
if profile_company and profile_company != company_name:
    company_name = profile_company  # Use the company from the profile
```

## Files Modified

- `Backend/app/services/provisioning_service.py`
  - `_step_settings`: Added non-group warehouse filtering
  - `_step_pos_session`: Added POS Profile company verification

## Testing

After the fixes:
1. Stock settings should use a non-group warehouse
2. POS session should use the correct company name from POS Profile
3. Both steps should complete successfully

## Verification

To verify the fixes:

```bash
# Continue provisioning
curl -X POST "http://localhost:4000/api/provisioning/tenants/<tenant_id>/continue" \
  -H "Authorization: Bearer <token>"

# Check status
curl -X GET "http://localhost:4000/api/provisioning/tenants/<tenant_id>/status" \
  -H "Authorization: Bearer <token>"

# Should show:
# - step_5_settings: completed (no group warehouse error)
# - step_9_pos_session: completed (no company mismatch error)
```

## Related Issues

These fixes resolve:
- Stock Settings validation error for group warehouses
- POS Session company name mismatch error
- Provisioning completion issues
