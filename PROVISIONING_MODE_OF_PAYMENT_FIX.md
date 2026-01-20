# Mode of Payment Account Fix

## Issue

ERPNext requires that Mode of Payment entries have a default Cash or Bank account configured. The error was:

```
frappe.exceptions.ValidationError: Please set default Cash or Bank account in Mode of Payments <a href="http:erpnext:8000/app/mode-of-payment/M-Pesa">M-Pesa</a>
```

## Solution

Updated `_ensure_mode_of_payment()` method to:

1. **Accept company information**: Added optional `company_name` and `company_abbr` parameters
2. **Lookup accounts**: Searches for appropriate Cash or Bank accounts based on payment type
3. **Set account in Mode of Payment**: Adds the account to the `accounts` child table when creating Mode of Payment

## Changes Made

### 1. Method Signature Update
```python
def _ensure_mode_of_payment(
    self,
    tenant_id: str,
    payment_type: Literal['Cash', 'M-Pesa', 'Card', 'Bank', 'Credit'],
    correlation_id: str,
    company_name: Optional[str] = None,  # NEW
    company_abbr: Optional[str] = None    # NEW
) -> str:
```

### 2. Account Lookup Logic
- Determines account type based on payment type:
  - Cash → "Cash" account
  - M-Pesa, Card, Bank → "Bank" account
- Searches for accounts in this order:
  1. `{AccountType} - {CompanyAbbr}` (e.g., "Cash - ABC")
  2. `{AccountType} - {CompanyName}` (e.g., "Cash - Company Name")
  3. `{AccountType}` (e.g., "Cash")
- Tries both `account_name` and `name` fields

### 3. Mode of Payment Creation
When creating a Mode of Payment, now includes:
```python
mode_of_payment_data["accounts"] = [{
    "company": company_name,
    "default_account": account_name
}]
```

### 4. Updated Call Site
In `_step_pos_profile()`, now passes company information:
```python
erpnext_name = self._ensure_mode_of_payment(
    tenant_id, 
    pm.type, 
    correlation_id,
    company_name=company_name,
    company_abbr=company_abbr
)
```

## Testing

1. **Create a new workspace** via `/admin/workspaces`
2. **Monitor provisioning** - should complete without Mode of Payment errors
3. **Verify in ERPNext** - Mode of Payment entries should have accounts configured

## Notes

- If account is not found, Mode of Payment is still created but with a warning
- User may need to manually configure the account in ERPNext if account lookup fails
- Account lookup is resilient - tries multiple account name formats
