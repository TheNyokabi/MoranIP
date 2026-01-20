"""
ERPNext PoS Service Implementation - Multi-tenant aware
"""
import re
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import HTTPException
from .pos_service_base import PosServiceBase
from app.config import settings


class ErpnextPosService(PosServiceBase):
    """ERPNext implementation of PoS service with multi-tenant support"""
    
    def __init__(self, tenant_id: str, base_url: str, company_name: str = None, username: str = None, password: str = None):
        """
        Initialize ERPNext PoS Service with tenant isolation.

        Uses session-based authentication (cookies) instead of API keys.

        Args:
            tenant_id: Tenant identifier for multi-tenant isolation
            base_url: ERPNext base URL
            company_name: Company name for tenant filtering
            username: ERPNext username (defaults to settings.ERPNEXT_USER)
            password: ERPNext password (defaults to settings.ERPNEXT_PASSWORD)
        """
        self.tenant_id = tenant_id  # Store tenant_id for audit logging and filtering
        self.company_name = company_name  # Store company name for filtering
        self.base_url = base_url.rstrip('/')
        self.username = username or settings.ERPNEXT_USER
        self.password = password or settings.ERPNEXT_PASSWORD
        self.client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)
        self._logged_in = False
        self._site_name = self._resolve_site_name(tenant_id)
    
    def _resolve_site_name(self, tenant_id: Optional[str]) -> str:
        """Resolve a Frappe site name from tenant context."""
        default_site = getattr(settings, "ERPNEXT_SITE", "moran.localhost")
        if not tenant_id:
            return default_site
        
        # If tenant_id looks like a UUID, it's not a valid Frappe site.
        if re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", tenant_id):
            return default_site
        
        return tenant_id

    async def _get_tenant_company(self) -> str:
        """
        Get the company name associated with this tenant.
        Uses the company_name passed during initialization.
        """
        if self.company_name:
            return self.company_name

        # Fallback: try to find company by tenant context
        try:
            # Query for companies - in a single ERPNext instance,
            # we might need to filter by some tenant-specific criteria
            companies_result = await self._request('GET', '/api/resource/Company', params={
                'fields': '["name"]',
                'limit_page_length': 10
            })
            companies = companies_result.get('data', [])

            if companies:
                # For now, return the first company
                # In production, you'd have proper tenant-company mapping
                return companies[0]['name']
        except Exception as e:
            print(f"Error getting companies: {e}")

        # Ultimate fallback
        return "Default Company"
    
    async def _login(self) -> bool:
        """
        Login to ERPNext to get session cookies.
        
        Returns:
            bool: True if login successful, False otherwise
        """
        if self._logged_in:
            return True
        
        try:
            headers = {"X-Frappe-Site-Name": self._site_name}
            response = await self.client.post(
                f"{self.base_url}/api/method/login",
                headers=headers,
                data={
                    "usr": self.username,
                    "pwd": self.password
                }
            )
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict):
                        # Check for exceptions
                        if "exception" in response_data or "exc" in response_data:
                            return False
                        # Check for "Logged In" message
                        if response_data.get("message") == "Logged In":
                            self._logged_in = True
                            return True
                except (ValueError, KeyError):
                    pass
                
                # If we got 200, assume success
                self._logged_in = True
                return True
            
            return False
        except Exception as e:
            print(f"ERPNext POS Service Login Error for {self._site_name}: {e}")
            return False
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request to ERPNext using session-based authentication"""
        # Ensure we're logged in
        if not self._logged_in:
            login_success = await self._login()
            if not login_success:
                raise HTTPException(
                    status_code=503,
                    detail=f"ERPNext login failed for tenant {self.tenant_id}"
                )
        
        headers = kwargs.pop('headers', {})
        headers['X-Frappe-Site-Name'] = self._site_name
        headers.setdefault('Content-Type', 'application/json')
        
        try:
            response = await self.client.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=headers,
                **kwargs
            )
            
            # Handle authentication errors (401/403)
            if response.status_code in (401, 403):
                # Try to re-login
                self._logged_in = False
                login_success = await self._login()
                if login_success:
                    # Retry the request
                    response = await self.client.request(
                        method,
                        f"{self.base_url}{endpoint}",
                        headers=headers,
                        **kwargs
                    )
                else:
                    raise HTTPException(
                        status_code=401,
                        detail="ERPNext authentication failed"
                    )
            
            response.raise_for_status()
            
            # Parse response
            try:
                return response.json()
            except Exception:
                return {"data": response.text}
                
        except httpx.HTTPStatusError as e:
            # Extract error message from response
            try:
                error_data = e.response.json()
                error_msg = error_data.get("message") or error_data.get("exc") or str(e)
            except:
                error_msg = str(e)
            
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"ERPNext error: {error_msg}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to ERPNext: {str(e)}"
            )
    
    async def __aenter__(self):
        """Async context manager entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close client"""
        await self.client.aclose()
    
    # ==================== Profile Management ====================
    
    async def create_profile(
        self,
        name: str,
        warehouse: str,
        payment_methods: List[Dict[str, Any]],
        session_settings: Dict[str, Any],
        inventory_settings: Dict[str, Any],
        receipt_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create PoS Profile in ERPNext.
        
        Idempotent: Checks if profile with same name exists before creating.
        """
        payments = []
        for idx, pm in enumerate(payment_methods):
            payments.append({
                "mode_of_payment": pm["type"],
                # ERPNext allows only one default mode of payment
                "default": idx == 0
            })
        
        # Check if profile exists (idempotency) - update if needed
        if await self._profile_exists(name):
            update_data = {
                "warehouse": warehouse,
                "payments": payments,
                "selling_price_list": "Standard Selling",
                "currency": "KES"
            }
            if " - " in warehouse:
                company_suffix = warehouse.split(" - ", 1)[1]
                update_data["write_off_account"] = f"Stock Adjustment - {company_suffix}"
                update_data["write_off_cost_center"] = f"Main - {company_suffix}"
            updated = await self._request('PUT', f'/api/resource/POS Profile/{name}', json=update_data)
            return updated.get('data', {})
        
        data = {
            "doctype": "POS Profile",
            "name": name,
            "warehouse": warehouse,
            "payments": payments,
            "custom_session_settings": session_settings,
            "custom_inventory_settings": inventory_settings,
            "custom_receipt_settings": receipt_settings,
            "selling_price_list": "Standard Selling",
            "currency": "KES"
        }
        
        # ERPNext requires write-off fields for POS Profile
        if " - " in warehouse:
            company_suffix = warehouse.split(" - ", 1)[1]
            data["write_off_account"] = f"Stock Adjustment - {company_suffix}"
            data["write_off_cost_center"] = f"Main - {company_suffix}"
        
        result = await self._request('POST', '/api/resource/POS Profile', json=data)
        return result.get('data', {})
    
    async def _profile_exists(self, name: str) -> bool:
        """Check if POS Profile with given name exists"""
        try:
            profiles = await self.list_profiles(limit=1000)
            return any(p.get("name") == name for p in profiles)
        except Exception:
            return False
    
    async def get_profile(self, profile_id: str) -> Dict[str, Any]:
        """Get PoS Profile from ERPNext"""
        try:
            result = await self._request('GET', f'/api/resource/POS Profile/{profile_id}')
            profile_data = result.get('data', {})
            if not profile_data:
                raise ValueError(f"POS Profile {profile_id} not found")
            return profile_data
        except Exception as e:
            # If profile doesn't exist, try to create a basic one
            print(f"POS Profile {profile_id} not found, attempting to create basic profile: {e}")
            return await self._create_fallback_profile(profile_id)

    async def _create_fallback_profile(self, profile_id: str) -> Dict[str, Any]:
        """Create a basic POS profile if it doesn't exist"""
        try:
            # Get tenant company
            company = await self._get_tenant_company()
            if not company:
                raise ValueError("Could not determine company for tenant")

            # Get a warehouse for this company
            warehouses_result = await self._request('GET', '/api/resource/Warehouse', params={
                'filters': f'[["company", "=", "{company}"]]',
                'limit_page_length': 10
            })
            warehouses = warehouses_result.get('data', [])
            if not warehouses:
                raise ValueError(f"No warehouses found for company {company}")

            # Use first warehouse (prefer stores)
            warehouse = None
            for wh in warehouses:
                if 'store' in wh.get('name', '').lower():
                    warehouse = wh.get('name')
                    break
            if not warehouse:
                warehouse = warehouses[0].get('name')

            # Create basic POS profile with minimal required fields
            # Skip write-off fields that may not exist
            profile_data = {
                "doctype": "POS Profile",
                "name": profile_id,
                "warehouse": warehouse,
                "company": company,
                "currency": "KES",
                "payments": [
                    {"mode_of_payment": "Cash", "default": 1},
                    {"mode_of_payment": "M-Pesa", "default": 0}
                ]
            }

            # Only add write-off fields if they exist
            try:
                # Check if write-off account exists
                accounts_result = await self._request('GET', '/api/resource/Account', params={
                    'filters': f'[["company", "=", "{company}"]]',
                    'limit_page_length': 50
                })
                accounts = accounts_result.get('data', [])

                # Look for any expense account as write-off account
                expense_accounts = [acc for acc in accounts if 'expense' in acc.get('account_name', '').lower()]
                if expense_accounts:
                    profile_data['write_off_account'] = expense_accounts[0]['name']

                # Check for cost centers
                cost_centers_result = await self._request('GET', '/api/resource/Cost Center', params={
                    'filters': f'[["company", "=", "{company}"]]',
                    'limit_page_length': 10
                })
                cost_centers = cost_centers_result.get('data', [])
                if cost_centers:
                    profile_data['write_off_cost_center'] = cost_centers[0]['name']

            except Exception as e:
                print(f"Could not find write-off accounts, proceeding without them: {e}")

            # Try to create the profile in ERPNext
            create_result = await self._request('POST', '/api/resource/POS Profile', json=profile_data)
            created_profile = create_result.get('data', {})

            print(f"Created fallback POS profile: {profile_id}")
            return created_profile

        except Exception as create_error:
            print(f"Failed to create fallback POS profile: {create_error}")
            # Return a mock profile for basic functionality
            return {
                "name": profile_id,
                "warehouse": "Main Store",  # Fallback
                "company": "Default Company",  # Fallback
                "currency": "KES",
                "payments": [
                    {"mode_of_payment": "Cash", "default": 1},
                    {"mode_of_payment": "M-Pesa", "default": 0}
                ]
            }
    
    async def list_profiles(
        self,
        warehouse: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List PoS Profiles filtered by tenant"""
        # First, get warehouses that belong to this tenant's company
        # We need to determine the company from tenant context
        tenant_company = await self._get_tenant_company()

        filters = {}
        if warehouse:
            filters['warehouse'] = warehouse
        else:
            # If no specific warehouse requested, filter by tenant's company warehouses
            # Get all warehouses for this tenant's company
            warehouses_result = await self._request('GET', '/api/resource/Warehouse', params={
                'fields': '["name"]',
                'filters': f'[["company", "=", "{tenant_company}"]]',
                'limit_page_length': 100
            })
            tenant_warehouses = [w['name'] for w in warehouses_result.get('data', [])]

            if tenant_warehouses:
                # Filter POS profiles to only those using tenant's warehouses
                filters['warehouse'] = ['in', tenant_warehouses]

        params = {
            'fields': '["*"]',
            'limit_page_length': limit,
            'limit_start': offset
        }
        if filters:
            import json
            params['filters'] = json.dumps(filters)

        result = await self._request('GET', '/api/resource/POS Profile', params=params)
        return result.get('data', [])
    
    async def update_profile(self, profile_id: str, **kwargs) -> Dict[str, Any]:
        """Update PoS Profile"""
        result = await self._request(
            'PUT',
            f'/api/resource/POS Profile/{profile_id}',
            json=kwargs
        )
        return result.get('data', {})
    
    async def delete_profile(self, profile_id: str) -> bool:
        """Delete PoS Profile"""
        await self._request('DELETE', f'/api/resource/POS Profile/{profile_id}')
        return True
    
    # ==================== Session Management ====================
    
    async def open_session(
        self,
        profile_id: str,
        user: str,
        opening_cash: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Open PoS Opening Entry.
        
        Enforces one-open-session rule: Checks for existing open sessions before creating.
        Raises HTTPException(409) if active session already exists.
        """
        # Check for existing open sessions (one-open-session rule)
        if await self._has_open_session(profile_id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "pos_session_already_open",
                    "message": f"Active POS session already exists for profile {profile_id}",
                    "profile_id": profile_id
                }
            )
        
        data = {
            "doctype": "POS Opening Entry",
            "pos_profile": profile_id,
            "user": user,
            "period_start_date": datetime.now().isoformat(),
            "posting_date": datetime.now().date().isoformat()
        }
        
        if opening_cash is not None:
            data["balance_details"] = [{
                "mode_of_payment": "Cash",
                "opening_amount": opening_cash
            }]
        
        result = await self._request('POST', '/api/resource/POS Opening Entry', json=data)
        return result.get('data', {})
    
    async def _has_open_session(self, profile_id: str) -> bool:
        """Check if there's an active open session for the given profile"""
        try:
            sessions = await self.list_sessions(profile_id=profile_id, status="Open", limit=1)
            return len(sessions) > 0
        except Exception:
            return False
    
    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get PoS Opening Entry"""
        result = await self._request('GET', f'/api/resource/POS Opening Entry/{session_id}')
        return result.get('data', {})
    
    async def list_sessions(
        self,
        profile_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List PoS Opening Entries"""
        filters = {}
        if profile_id:
            filters['pos_profile'] = profile_id
        if status:
            filters['status'] = status
        
        params = {
            'fields': '["*"]',
            'limit_page_length': limit
        }
        if filters:
            import json
            params['filters'] = json.dumps(filters)
        
        result = await self._request('GET', '/api/resource/POS Opening Entry', params=params)
        return result.get('data', [])
    
    async def close_session(
        self,
        session_id: str,
        closing_cash: Optional[float] = None
    ) -> Dict[str, Any]:
        """Close PoS session via Closing Entry"""
        # Get opening entry
        opening = await self.get_session(session_id)
        
        data = {
            "doctype": "POS Closing Entry",
            "pos_opening_entry": session_id,
            "period_end_date": datetime.now().isoformat(),
            "posting_date": datetime.now().date().isoformat()
        }
        
        result = await self._request('POST', '/api/resource/POS Closing Entry', json=data)
        return result.get('data', {})
    
    # ==================== Order Management ====================
    
    async def create_order(
        self,
        session_id: str,
        items: List[Dict[str, Any]],
        customer: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create PoS Invoice"""
        session = await self.get_session(session_id)
        
        data = {
            "doctype": "POS Invoice",
            "pos_profile": session.get("pos_profile"),
            "customer": customer or "Walk-In Customer",
            "is_pos": 1,
            "items": [
                {
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "rate": item.get("rate")
                }
                for item in items
            ]
        }
        
        result = await self._request('POST', '/api/resource/POS Invoice', json=data)
        return result.get('data', {})
    
    async def get_order(self, order_id: str) -> Dict[str, Any]:
        """Get PoS Invoice"""
        result = await self._request('GET', f'/api/resource/POS Invoice/{order_id}')
        return result.get('data', {})
    
    async def update_order(
        self,
        order_id: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Update PoS Invoice items"""
        data = {
            "items": [
                {
                    "item_code": item["item_code"],
                    "qty": item["qty"],
                    "rate": item.get("rate")
                }
                for item in items
            ]
        }
        
        result = await self._request('PUT', f'/api/resource/POS Invoice/{order_id}', json=data)
        return result.get('data', {})
    
    async def process_payment(
        self,
        order_id: str,
        payment_method: str,
        amount: float
    ) -> Dict[str, Any]:
        """Submit PoS Invoice with payment"""
        data = {
            "payments": [{
                "mode_of_payment": payment_method,
                "amount": amount
            }],
            "docstatus": 1  # Submit
        }
        
        result = await self._request('PUT', f'/api/resource/POS Invoice/{order_id}', json=data)
        return result.get('data', {})
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel PoS Invoice"""
        data = {"docstatus": 2}  # Cancel
        await self._request('PUT', f'/api/resource/POS Invoice/{order_id}', json=data)
        return True
    
    # ==================== Account Resolution ====================
    
    async def get_payment_account(self, mode_of_payment: str, company: str) -> str:
        """Get GL account for a payment mode using ERPNext method"""
        try:
            result = await self._request(
                'GET',
                f'/api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account',
                params={
                    'mode_of_payment': mode_of_payment,
                    'company': company
                }
            )
            return result.get('message', {}).get('account')
        except Exception as e:
            # Fallback: try to get from Mode of Payment directly
            try:
                mop = await self._request('GET', f'/api/resource/Mode of Payment/{mode_of_payment}')
                accounts = mop.get('data', {}).get('accounts', [])
                for acc in accounts:
                    if acc.get('company') == company:
                        return acc.get('default_account')
            except:
                pass
            raise ValueError(f"Could not resolve account for payment mode {mode_of_payment} in company {company}: {str(e)}")
    
    async def validate_accounts_exist(self, account_list: List[str], company: str) -> bool:
        """Validate that accounts exist in chart of accounts"""
        if not account_list:
            return True
        
        try:
            # Get all accounts for the company
            accounts = await self._request(
                'GET',
                '/api/resource/Account',
                params={
                    'filters': f'[["company", "=", "{company}"]]',
                    'fields': '["name"]',
                    'limit_page_length': 10000
                }
            )
            account_names = {acc.get('name') for acc in accounts.get('data', [])}
            
            # Check if all requested accounts exist
            missing = set(account_list) - account_names
            if missing:
                raise ValueError(f"Accounts not found: {', '.join(missing)}")
            return True
        except Exception as e:
            raise ValueError(f"Account validation failed: {str(e)}")
    
    async def get_pos_profile_details(self, profile_id: str) -> Dict[str, Any]:
        """Get POS Profile with account mappings"""
        profile = await self.get_profile(profile_id)
        
        # Get company from profile or default
        company = profile.get('company')
        if not company:
            # Try to get default company
            companies = await self._request('GET', '/api/resource/Company', params={'limit_page_length': 1})
            if companies.get('data'):
                company = companies['data'][0].get('name')
        
        # Resolve payment method accounts (skip in demo mode)
        payment_accounts = {}
        import os
        if not os.getenv("SKIP_POS_STOCK_VALIDATION", "false").lower() == "true":
            payments = profile.get('payments', [])
            for payment in payments:
                mode_of_payment = payment.get('mode_of_payment')
                if mode_of_payment and company:
                    try:
                        account = await self.get_payment_account(mode_of_payment, company)
                        payment_accounts[mode_of_payment] = account
                    except Exception as e:
                        # Log but don't fail - will be caught during validation
                        print(f"Warning: Could not resolve account for {mode_of_payment}: {e}")
        else:
            # In demo mode, use placeholder accounts
            payments = profile.get('payments', [])
            for payment in payments:
                mode_of_payment = payment.get('mode_of_payment')
                if mode_of_payment:
                    payment_accounts[mode_of_payment] = f"Demo Account for {mode_of_payment}"
        
        # Enhance profile with account mappings
        profile['payment_accounts'] = payment_accounts
        profile['company'] = company
        
        return profile