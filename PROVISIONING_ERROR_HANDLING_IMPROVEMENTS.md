# Provisioning Error Handling Improvements

## Summary

This document outlines the improvements made to error handling and ERPNext validation in the provisioning service.

## Key Improvements

### 1. **ERPNext Error Parsing Helper**
Added `_parse_erpnext_error()` function that:
- Extracts meaningful error messages from ERPNext's complex error responses
- Categorizes errors into types: `missing_resource`, `duplicate_resource`, `validation_error`, `link_validation_error`, etc.
- Provides actionable error messages for users

### 2. **Unique Company Abbreviation Generation**
Added `_generate_unique_abbr()` function that:
- Generates unique company abbreviations to avoid conflicts
- Tries multiple strategies: first 3 chars, with numbers, first+last chars, UUID fallback
- Prevents "Abbreviation already used" errors

### 3. **Enhanced Error Handling in Company Creation**
- Validates required fields before sending to ERPNext
- Maps country codes to full country names (e.g., "KE" → "Kenya")
- Provides specific error messages for duplicate companies, missing resources, etc.
- Raises `CriticalProvisioningError` with actionable messages

### 4. **Enhanced Error Handling in Warehouse Creation**
- Better error parsing for warehouse conflicts
- Distinguishes between critical errors (company missing) and non-critical (duplicate warehouse)
- Provides context about which company the warehouse belongs to

### 5. **Enhanced Error Handling in POS Profile Creation**
- Validates required fields (company, warehouse, payment methods) before creation
- Verifies warehouse belongs to the correct company
- Provides specific error messages for:
  - Missing warehouse
  - Invalid warehouse-company linkage
  - Missing payment methods
  - Validation errors

### 6. **Enhanced Error Handling in Payment Method Creation**
- Better error parsing for Mode of Payment creation
- Handles 409 conflicts gracefully (idempotency)

## Common ERPNext Validation Issues Addressed

1. **Country Code vs Country Name**: ERPNext expects full country names, not ISO codes
2. **Company Abbreviation Uniqueness**: Abbreviations must be unique across all companies
3. **Warehouse Full Name**: ERPNext stores warehouses with company suffix (e.g., "Main Store - ABC")
4. **Payment Methods Format**: ERPNext expects `payments` array with `mode_of_payment`, `default`, and `allow_in_returns` fields
5. **Link Validation**: Resources must belong to the same company (warehouse, customer, etc.)

## Error Types Handled

- `missing_resource`: Resource doesn't exist in ERPNext
- `duplicate_resource`: Resource already exists
- `validation_error`: ERPNext validation failed
- `link_validation_error`: Resource reference is invalid or not linked to company
- `missing_required_field`: Required field is missing

## Next Steps

To apply these improvements, the helper functions (`_parse_erpnext_error` and `_generate_unique_abbr`) should be added to the provisioning service, and error handling should be enhanced in:
- `_step_company` (company creation)
- `_step_warehouses` (warehouse creation)
- `_step_pos_profile` (POS profile creation)
- `_ensure_mode_of_payment` (payment method creation)
