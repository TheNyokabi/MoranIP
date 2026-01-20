# Mode of Payment Account Lookup - Enhanced Fix

## Issue

The Mode of Payment was being created without an account, causing ERPNext validation to fail when the POS Profile tried to use it. The error was:

```
frappe.exceptions.ValidationError: Please set default Cash or Bank account in Mode of Payments M-Pesa
```

## Root Cause

The account lookup was too restrictive and only tried exact name matches. If the account names didn't match exactly (e.g., "Cash - ABC" vs "Cash - Abc"), the lookup would fail, and the Mode of Payment would be created without an account.

## Solution

Enhanced the account lookup logic in `_ensure_mode_of_payment()` to:

1. **Try Multiple Name Variations**: 
   - `{AccountType} - {CompanyAbbr}` (e.g., "Cash - ABC")
   - `{AccountType} - {CompanyName}` (e.g., "Cash - Company Name")
   - `{AccountType}` (e.g., "Cash")
   - Case variations (lowercase, uppercase)

2. **Fallback to Account Type Search**:
   - If no exact name match is found, search for ANY account with the matching `account_type` (Cash or Bank)
   - Prefer non-group accounts over group accounts
   - Use the first matching account if found

3. **Fail Early with Clear Error**:
   - If no account is found after all attempts, raise an error immediately
   - Prevents creating a Mode of Payment without an account
   - Provides clear error message: "No {AccountType} account found for company '{CompanyName}'. Please ensure chart of accounts is imported and contains a {AccountType} account."

## Changes Made

### 1. Enhanced Account Name Matching
```python
possible_account_names = []
if company_abbr:
    possible_account_names.extend([
        f"{account_type} - {company_abbr}",
        f"{account_type} - {company_name}",
    ])
possible_account_names.append(account_type)
possible_account_names.extend([
    account_type.lower(),
    account_type.upper(),
])
```

### 2. Account Type Fallback Search
```python
# If still not found, try to find ANY account of the right type
if not account_name:
    accounts_response = erpnext_adapter.proxy_request(
        tenant_id,
        "resource/Account",
        method="GET",
        params={
            "filters": f'[["company", "=", "{company_name}"], ["account_type", "=", "{account_type_filter}"]]',
            "limit_page_length": 10
        }
    )
    # Prefer non-group accounts
    for acc in accounts:
        if not acc.get("is_group", 0):
            account_name = acc.get("name") or acc.get("account_name")
            break
```

### 3. Fail Early Instead of Warning
```python
# Add account if found - REQUIRED by ERPNext
if account_name:
    mode_of_payment_data["accounts"] = [{
        "company": company_name,
        "default_account": account_name
    }]
else:
    # ERPNext requires accounts to be set - fail early with clear error
    error_msg = f"No {account_type} account found for company '{company_name}'. Please ensure chart of accounts is imported and contains a {account_type} account."
    logger.error(f"[{correlation_id}] {error_msg}")
    raise ValueError(error_msg)
```

## Benefits

1. **More Robust**: Handles various account naming conventions
2. **Better Error Messages**: Clear error if account is missing
3. **Prevents Invalid State**: Won't create Mode of Payment without account
4. **Faster Failure**: Fails early instead of failing later during POS Profile creation

## Testing

1. **Create a new workspace** - Account lookup should find accounts even with different naming
2. **Verify Mode of Payment** - Should have accounts configured correctly
3. **Check Error Handling** - If account is missing, should get clear error message

## Notes

- The account lookup now works even if company_abbr is not available
- Falls back to searching by account_type if name matching fails
- Prefers non-group accounts (leaf accounts) over group accounts
- Fails early with actionable error message if no account is found
