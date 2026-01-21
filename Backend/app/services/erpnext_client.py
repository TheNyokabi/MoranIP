import re
import html
import requests
from requests.exceptions import ConnectionError, Timeout, RequestException
from fastapi import HTTPException
from app.config import settings
from app.services.engine_adapter import EngineAdapter
from app.middleware.response_normalizer import ResponseNormalizer
from typing import Dict, Optional


class ERPNextClientAdapter(EngineAdapter):
    def __init__(self, tenant_id: str = "demo-erpnext", **kwargs):
        super().__init__(tenant_id, **kwargs)
        self.base_url = settings.ERPNEXT_HOST
        self.session = requests.Session()
        # Disable automatic Expect: 100-continue header which causes 417 errors
        self.session.headers.update({'Expect': ''})
        self.cookie_jar = None
        self._current_tenant = None  # Track tenant to re-login if changed
    
    def _init_credentials(self, **kwargs):
        # Initialize ERPNext-specific credentials.
        # Credentials come from settings
        pass

    def _resolve_site_name(self, tenant_id: Optional[str]) -> str:
        """Resolve a Frappe site name from tenant context.

        In MoranERP, `tenant_id` is typically a UUID (not a Frappe site name).
        For the ERPNext simulator, we should fall back to `settings.ERPNEXT_SITE`.
        """
        default_site = getattr(settings, "ERPNEXT_SITE", "moran.localhost")
        if not tenant_id:
            return default_site

        # If tenant_id looks like a UUID, it's not a valid Frappe site.
        if re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", tenant_id):
            return default_site

        return tenant_id

    def _login(self, tenant_id: str = None):
        """
        Logins to ERPNext to get a session cookie.
        
        Args:
            tenant_id: Tenant identifier (mapped to ERPNext site name)
        
        Returns:
            tuple: (success: bool, error_message: Optional[str])
        """
        site_name = self._resolve_site_name(tenant_id)
        
        try:
            headers = {"X-Frappe-Site-Name": site_name}
            resp = self.session.post(
                f"{self.base_url}/api/method/login", 
                headers=headers, 
                data={
                    "usr": settings.ERPNEXT_USER,
                    "pwd": settings.ERPNEXT_PASSWORD
                },
                timeout=10
            )

            # In practice, ERPNext can sometimes return a "Logged In" message even when
            # the HTTP status code isn't 200 (e.g., via intermediary/proxy quirks). Treat
            # it as success to avoid breaking provisioning/health checks.
            try:
                response_data = resp.json() if resp.content else None
                if isinstance(response_data, dict) and response_data.get("message") == "Logged In" and "exception" not in response_data:
                    self.cookie_jar = resp.cookies
                    self._current_tenant = site_name
                    return True, None
            except Exception:
                pass

            if resp.status_code == 200:
                # Check if response contains an exception (HTTP 200 but with error in body)
                try:
                    response_data = resp.json()
                    if isinstance(response_data, dict):
                        # Check for exceptions in the response
                        if "exception" in response_data or "exc" in response_data:
                            exception_msg = response_data.get("exception") or response_data.get("exc", "")
                            if "OperationalError" in exception_msg or "Unknown column" in exception_msg:
                                error_msg = f"Database schema issue detected. Site may need migration. Error: {exception_msg[:200]}"
                                print(f"ERPNext Database Schema Issue for {site_name}: {error_msg}")
                                return False, error_msg
                        # Check for "Logged In" message which indicates success
                        if response_data.get("message") == "Logged In" and "exception" not in response_data:
                            self.cookie_jar = resp.cookies
                            self._current_tenant = site_name
                            return True, None
                except (ValueError, KeyError):
                    # If we can't parse JSON or check for exceptions, assume success if 200
                    pass
                
                # If we got here with 200 status, assume success
                self.cookie_jar = resp.cookies
                self._current_tenant = site_name
                return True, None
            
            error_msg = f"ERPNext login failed (HTTP {resp.status_code})"
            try:
                error_data = resp.json()
                if isinstance(error_data, dict) and "message" in error_data:
                    error_msg = error_data["message"]
            except:
                pass

            if isinstance(error_msg, str) and error_msg.strip() == "Logged In":
                self.cookie_jar = resp.cookies
                self._current_tenant = site_name
                return True, None

            print(f"ERPNext Login Failed for {site_name}: {error_msg}")
            return False, error_msg
        except ConnectionError as e:
            error_msg = f"Cannot connect to ERPNext at {self.base_url}. Please ensure ERPNext is running."
            print(f"ERPNext Connection Error for {site_name}: {e}")
            return False, error_msg
        except Timeout as e:
            error_msg = f"ERPNext connection timeout. The server at {self.base_url} is not responding."
            print(f"ERPNext Timeout for {site_name}: {e}")
            return False, error_msg
        except RequestException as e:
            error_msg = f"ERPNext request error: {str(e)}"
            print(f"ERPNext Request Exception for {site_name}: {e}")
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error connecting to ERPNext: {str(e)}"
            print(f"ERPNext Login Exception for {site_name}: {e}")
            return False, error_msg

    def proxy_request(self, tenant_id: str, path: str, method: str = "GET", params: dict = None, json_data: dict = None):
        """
        Proxies a request to the ERPNext/Frappe API using Cookie Auth with structured error handling.
        
        Args:
            tenant_id: Tenant identifier (site name)
            path: API endpoint path
            method: HTTP method
            params: Query parameters
            json_data: JSON request body
        """
        site_name = self._resolve_site_name(tenant_id)
        
        # Re-login if tenant changed
        if not self.cookie_jar or self._current_tenant != site_name:
            login_success, login_error = self._login(site_name)
            if not login_success:
                error_message = login_error or f"ERPNext login failed for tenant {site_name}"
                raise HTTPException(
                    status_code=503, 
                    detail=error_message
                )
        
        url = f"{self.base_url}/api/{path}"
        headers = {
            "X-Frappe-Site-Name": site_name,
            "Accept": "application/json",
            "Content-Type": "application/json" if json_data else None
        }
        # Remove None values
        headers = {k: v for k, v in headers.items() if v is not None}

        try:
            resp = self.session.request(
                method, url,
                headers=headers,
                params=params,
                json=json_data,
                cookies=self.cookie_jar,
                timeout=30
            )

            def _clean_message(msg: object) -> str:
                if msg is None:
                    return ""
                if not isinstance(msg, str):
                    msg = str(msg)
                # ERPNext often returns HTML in `_server_messages`
                text = html.unescape(msg)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                return text

            def _parse_stock_shortage_message(message: str) -> Optional[Dict[str, object]]:
                """Parse ERPNext negative stock error text into structured fields.

                Variants seen in ERPNext/Frappe:
                - '3.0 units of ITEM-001 needed in Warehouse Finished Goods - AST for Sales Invoice ACC-SINV-2026-00066 to complete this transaction.'
                - '4.0 units of Item 100ml: Paint 100ml needed in Warehouse Finished Goods - AST on 2026-01-21 15:50:48.63 for Sales Invoice Walk-In Customer to complete this transaction.'
                """
                msg = _clean_message(message)

                m = re.search(
                    r"(?P<required>\d+(?:\.\d+)?)\s+units?(?:\s+of\s+(?P<item>.+?))?\s+needed in Warehouse\s+(?P<rest>.+)$",
                    msg,
                    flags=re.IGNORECASE,
                )
                if not m:
                    return None

                try:
                    required_qty = float(m.group("required"))
                except Exception:
                    required_qty = None

                raw_item = (m.group("item") or "").strip() or None
                item_code = None
                item_name = None
                if raw_item:
                    m_item = re.match(r"Item\s+(?P<code>[^:]+)\s*:\s*(?P<name>.+)$", raw_item, flags=re.IGNORECASE)
                    if m_item:
                        item_code = (m_item.group("code") or "").strip() or None
                        item_name = (m_item.group("name") or "").strip() or None
                    else:
                        # Best-effort: some messages just put the item code here
                        item_code = raw_item

                rest = (m.group("rest") or "").strip()
                rest = re.split(r"\s+to complete\b", rest, maxsplit=1, flags=re.IGNORECASE)[0].strip()

                posting_datetime = None
                voucher_type = None
                voucher_no = None
                party = None

                warehouse_part = rest
                for_part = None

                if " for " in rest:
                    warehouse_part, for_part = rest.split(" for ", 1)
                    warehouse_part = warehouse_part.strip()
                    for_part = (for_part or "").strip()

                if " on " in warehouse_part:
                    wh, after_on = warehouse_part.split(" on ", 1)
                    warehouse_part = wh.strip()
                    after_on = (after_on or "").strip()
                    if " for " in after_on and not for_part:
                        dt, fp = after_on.split(" for ", 1)
                        posting_datetime = dt.strip() or None
                        for_part = fp.strip()
                    else:
                        posting_datetime = after_on or None

                # Parse the "for ..." section if present
                if for_part:
                    # Sales Invoice is the common POS case (two-word doctype)
                    if for_part.lower().startswith("sales invoice "):
                        voucher_type = "Sales Invoice"
                        remainder = for_part[len("Sales Invoice "):].strip()
                        if remainder:
                            if re.match(r"^[A-Z0-9]+-[A-Z0-9-]+$", remainder):
                                voucher_no = remainder
                            else:
                                party = remainder
                    else:
                        # Generic fallback: last token as voucher, rest as type
                        parts = for_part.split()
                        if len(parts) >= 2:
                            candidate = parts[-1]
                            voucher_type = " ".join(parts[:-1])
                            if re.match(r"^[A-Z0-9]+-[A-Z0-9-]+$", candidate):
                                voucher_no = candidate
                            else:
                                party = candidate

                warehouse = (warehouse_part or "").strip() or None
                if not warehouse or required_qty is None:
                    return None

                return {
                    "item": raw_item,
                    "item_code": item_code,
                    "item_name": item_name,
                    "warehouse": warehouse,
                    "required_qty": required_qty,
                    "posting_datetime": posting_datetime,
                    "voucher_type": voucher_type,
                    "voucher_no": voucher_no,
                    "party": party,
                }

            def _extract_frappe_error(detail: object) -> Dict[str, Optional[str]]:
                """Extract a concise error message from common Frappe/ERPNext error payloads."""
                result: Dict[str, Optional[str]] = {"message": None, "exc_type": None}
                if not isinstance(detail, dict):
                    result["message"] = str(detail)
                    return result

                exc_type = detail.get("exc_type") or detail.get("exception_type")
                if isinstance(exc_type, str):
                    result["exc_type"] = exc_type

                # Prefer server messages (often contains the user-friendly error)
                server_messages = detail.get("_server_messages")
                if isinstance(server_messages, str) and server_messages.startswith("["):
                    try:
                        import json
                        parsed = json.loads(server_messages)
                        if isinstance(parsed, list) and parsed:
                            # Each entry can be plain text or a JSON-stringified object
                            first = parsed[0]
                            if isinstance(first, str) and first.strip().startswith("{"):
                                try:
                                    msg_obj = json.loads(first)
                                    if isinstance(msg_obj, dict):
                                        msg = msg_obj.get("message") or msg_obj.get("title")
                                        if isinstance(msg, str) and msg.strip():
                                            result["message"] = msg
                                            return result
                                except Exception:
                                    pass
                            if isinstance(first, str) and first.strip():
                                result["message"] = first
                                return result
                    except Exception:
                        pass

                # Next best: one-line exception
                exception_line = detail.get("exception")
                if isinstance(exception_line, str) and exception_line.strip():
                    result["message"] = exception_line
                    return result

                # Then: explicit message field
                msg = detail.get("message")
                if isinstance(msg, str) and msg.strip():
                    result["message"] = msg
                    return result

                # Fallback: traceback-ish string. Avoid returning a full traceback if possible.
                exc = detail.get("exc")
                if isinstance(exc, str) and exc.strip():
                    # Sometimes `exc` is a JSON list-string containing the traceback.
                    if exc.startswith("["):
                        try:
                            import json
                            exc_list = json.loads(exc)
                            if isinstance(exc_list, list) and exc_list:
                                exc = exc_list[0] if isinstance(exc_list[0], str) else str(exc_list[0])
                        except Exception:
                            pass

                    # If it contains a traceback, keep only the last non-empty line.
                    if "Traceback" in exc:
                        lines = [ln.strip() for ln in exc.splitlines() if ln.strip()]
                        if lines:
                            result["message"] = lines[-1]
                            return result

                    result["message"] = exc
                    return result

                result["message"] = "Unknown error"
                return result
            
            # Handle authentication errors
            if resp.status_code == 401 or resp.status_code == 403:
                login_success, login_error = self._login(site_name)
                if login_success:
                    resp = self.session.request(
                        method, url, 
                        headers=headers,
                        params=params, 
                        json=json_data, 
                        cookies=self.cookie_jar,
                        timeout=30
                    )
                else:
                    error_message = login_error or "ERPNext authentication failed"
                    raise HTTPException(
                        status_code=401, 
                        detail=error_message
                    )

            # Handle not found
            if resp.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "type": "not_found",
                        "message": "Resource not found"
                    }
                )
            
            # Handle validation errors (400)
            if resp.status_code == 400:
                try:
                    error_detail = resp.json()
                    extracted = _extract_frappe_error(error_detail)
                    error_msg = _clean_message(extracted.get("message") or "Validation error")
                except (ValueError, KeyError):
                    error_msg = _clean_message(resp.text or "Validation error")

                shortage = _parse_stock_shortage_message(error_msg)
                if shortage:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "type": "insufficient_stock",
                            "message": error_msg,
                            "errors": [
                                {
                                    "item_code": shortage.get("item_code") or shortage.get("item"),
                                    "item_name": shortage.get("item_name"),
                                    "warehouse": shortage.get("warehouse"),
                                    "required_qty": shortage.get("required_qty"),
                                    "available_qty": None,
                                    "posting_datetime": shortage.get("posting_datetime"),
                                    "voucher_type": shortage.get("voucher_type"),
                                    "voucher_no": shortage.get("voucher_no"),
                                    "party": shortage.get("party"),
                                }
                            ],
                        },
                    )
                
                raise HTTPException(
                    status_code=400, 
                    detail={
                        "type": "validation_error",
                        "message": error_msg
                    }
                )
            
            # Handle permission denied
            if resp.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "type": "permission_denied",
                        "message": "You don't have permission to perform this action"
                    }
                )
            
            # Handle conflict (duplicate, constraint violation, etc)
            if resp.status_code == 409:
                try:
                    error_detail = resp.json()
                    error_msg = error_detail.get("message", "Conflict")
                except (ValueError, KeyError):
                    error_msg = "Resource conflict"

                raise HTTPException(
                    status_code=409,
                    detail={
                        "type": "conflict",
                        "message": error_msg
                    }
                )

            # Handle expectation failed (417)
            if resp.status_code == 417:
                try:
                    error_detail = resp.json()
                    extracted = _extract_frappe_error(error_detail)
                    error_msg = _clean_message(extracted.get("message") or "Expectation Failed")
                except (ValueError, KeyError):
                    error_msg = _clean_message(resp.text or "Expectation Failed")

                shortage = _parse_stock_shortage_message(error_msg)
                if shortage:
                    raise HTTPException(
                        status_code=417,
                        detail={
                            "type": "insufficient_stock",
                            "message": error_msg,
                            "errors": [
                                {
                                    "item_code": shortage.get("item_code") or shortage.get("item"),
                                    "item_name": shortage.get("item_name"),
                                    "warehouse": shortage.get("warehouse"),
                                    "required_qty": shortage.get("required_qty"),
                                    "available_qty": None,
                                    "posting_datetime": shortage.get("posting_datetime"),
                                    "voucher_type": shortage.get("voucher_type"),
                                    "voucher_no": shortage.get("voucher_no"),
                                    "party": shortage.get("party"),
                                }
                            ],
                            "raw_response": error_detail if 'error_detail' in locals() else None,
                        },
                    )

                raise HTTPException(
                    status_code=417,
                    detail={
                        "type": "expectation_failed",
                        "message": error_msg,
                        "raw_response": error_detail if 'error_detail' in locals() else None,
                    }
                )
            
            # Handle general server errors (417 is Expectation Failed, often validation errors)
            if resp.status_code >= 400:
                try:
                    error_detail = resp.json()
                    extracted = _extract_frappe_error(error_detail)
                    error_msg = _clean_message(extracted.get("message") or "Unknown error")
                except (ValueError, KeyError):
                    error_msg = _clean_message(resp.text or "Unknown error")

                shortage = _parse_stock_shortage_message(error_msg)
                if shortage:
                    raise HTTPException(
                        status_code=resp.status_code,
                        detail={
                            "type": "insufficient_stock",
                            "message": error_msg,
                            "errors": [
                                {
                                    "item_code": shortage.get("item_code") or shortage.get("item"),
                                    "item_name": shortage.get("item_name"),
                                    "warehouse": shortage.get("warehouse"),
                                    "required_qty": shortage.get("required_qty"),
                                    "available_qty": None,
                                    "posting_datetime": shortage.get("posting_datetime"),
                                    "voucher_type": shortage.get("voucher_type"),
                                    "voucher_no": shortage.get("voucher_no"),
                                    "party": shortage.get("party"),
                                }
                            ],
                            "status_code": resp.status_code,
                            "raw_response": error_detail if 'error_detail' in locals() else None,
                        },
                    )
                
                raise HTTPException(
                    status_code=resp.status_code, 
                    detail={
                        "type": "erp_error",
                        "message": error_msg,
                        "status_code": resp.status_code,
                        "raw_response": error_detail if 'error_detail' in locals() else None
                    }
                )
            
            # Parse ERPNext response
            # ERPNext returns {"message": {...}} for success or {"data": {...}}
            try:
                response_json = resp.json()
                # If response has "message" key, extract it (ERPNext standard format)
                if isinstance(response_json, dict) and "message" in response_json:
                    return {"data": response_json["message"]}
                # If already has "data", return as-is
                if isinstance(response_json, dict) and "data" in response_json:
                    return response_json
                # Otherwise wrap in "data"
                return {"data": response_json}
            except (ValueError, KeyError):
                # If not JSON, return as text wrapped in data
                return {"data": resp.text} if resp.text else {"data": None}

        except Timeout:
            raise HTTPException(
                status_code=504, 
                detail=f"ERPNext request timeout. The server at {self.base_url} is not responding."
            )
        except ConnectionError as e:
            raise HTTPException(
                status_code=503, 
                detail=f"Cannot connect to ERPNext at {self.base_url}. Please ensure ERPNext is running and accessible. Error: {str(e)}"
            )
        except HTTPException:
            raise
        except RequestException as e:
            raise HTTPException(
                status_code=503,
                detail=f"ERPNext connection error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error communicating with ERPNext: {str(e)}"
            )

    def list_resource(self, doctype: str, tenant_id: str = "default"):
        """
        List all docs of a doctype.
        """
        response = self.proxy_request(tenant_id, f"resource/{doctype}", method="GET")
        if not response or "data" not in response:
            return []
        
        # ERPNext returns list of {name: "..."} for list view
        # To get details we might need to fetch individually or use fields param
        # The Simulator currently returns full objects for list view which simplifies things
        return response.get("data", [])

    def create_resource(self, doctype: str, data: dict, tenant_id: str = "default"):
        """
        Create a new doc.
        """
        response = self.proxy_request(tenant_id, f"resource/{doctype}", method="POST", json_data=data)
        if not response or "data" not in response:
             raise HTTPException(status_code=500, detail="Failed to create resource")
        return response.get("data")

    def get_resource(self, doctype: str, name: str, tenant_id: str = "default"):
        response = self.proxy_request(tenant_id, f"resource/{doctype}/{name}", method="GET")
        return response.get("data") if response else None

    def update_resource(self, doctype: str, name: str, data: dict, tenant_id: str = "default"):
        """
        Update an existing document.
        
        Args:
            doctype: DocType name (e.g., 'Item', 'Customer')
            name: Document name/ID
            data: Updated field values
            tenant_id: Tenant identifier
            
        Returns:
            Updated document data
        """
        response = self.proxy_request(
            tenant_id, 
            f"resource/{doctype}/{name}", 
            method="PUT", 
            json_data=data
        )
        if not response or "data" not in response:
            raise HTTPException(status_code=500, detail="Failed to update resource")
        return response.get("data")

    def delete_resource(self, doctype: str, name: str, tenant_id: str = "default"):
        """
        Delete a document.
        
        Args:
            doctype: DocType name
            name: Document name/ID
            tenant_id: Tenant identifier
            
        Returns:
            Deletion confirmation
        """
        self.proxy_request(
            tenant_id, 
            f"resource/{doctype}/{name}", 
            method="DELETE"
        )
        return {"status": "deleted", "doctype": doctype, "name": name}

    # Keep backward compatibility for existing router if needed, or refactor router to use proxy_request
    def execute_call(self, tenant_id: str, endpoint: str, method: str = "GET", data: dict = None):
        # Map old 'execute_call' to new 'proxy_request'
        # Old endpoint was just 'doctype' e.g. 'Customer' -> mapped to 'resource/Customer'
        # Old data was params for GET
        return self.proxy_request(tenant_id, f"resource/{endpoint}", method, params=data)

    # ========================================================================
    # ONBOARDING SETUP METHODS
    # ========================================================================

    def setup_step_company(self, tenant_id: str, config: dict) -> dict:
        """
        Setup company during onboarding.
        
        Args:
            tenant_id: Tenant identifier
            config: Configuration dict with keys:
                - company_name: Name of company
                - company_currency: Currency code (e.g., KES)
                - fiscal_year_start: Start date
                
        Returns:
            Dict with created company details
        """
        company_data = {
            "doctype": "Company",
            "company_name": config.get("company_name", f"Company-{tenant_id[:8]}"),
            "country": config.get("country", "Kenya"),
            "currency": config.get("company_currency", "KES"),
            "is_group": 0,
            "parent_company": ""
        }
        
        company = self.create_resource("Company", company_data, tenant_id)
        
        return {
            "company_id": company.get("name"),
            "company_name": company.get("company_name"),
            "currency": company.get("currency"),
            "created_at": company.get("creation")
        }

    def setup_step_warehouse(self, tenant_id: str, config: dict) -> dict:
        """
        Setup warehouse during onboarding (for Inventory module).
        
        Args:
            tenant_id: Tenant identifier
            config: Configuration dict with keys:
                - warehouse_name: Name of warehouse
                - company: Company name (must exist)
                - parent_warehouse: Parent warehouse (optional)
                
        Returns:
            Dict with created warehouse details
        """
        warehouse_data = {
            "doctype": "Warehouse",
            "warehouse_name": config.get("warehouse_name", "Main Store"),
            "company": config.get("company", ""),
            "parent_warehouse": config.get("parent_warehouse", "")
        }
        
        warehouse = self.create_resource("Warehouse", warehouse_data, tenant_id)
        
        return {
            "warehouse_id": warehouse.get("name"),
            "warehouse_name": warehouse.get("warehouse_name"),
            "created_at": warehouse.get("creation")
        }

    def setup_step_chart_of_accounts(self, tenant_id: str, config: dict) -> dict:
        """
        Setup chart of accounts during onboarding (for Accounting module).
        
        Args:
            tenant_id: Tenant identifier
            config: Configuration dict with keys:
                - company: Company name
                - country_template: Chart of accounts template (default: "Standard")
                
        Returns:
            Dict with setup status and created accounts
        """
        from datetime import datetime, timezone
        
        company = config.get("company", "")
        country_template = config.get("country_template", "Standard")
        
        if not company:
            raise ValueError("Company name is required for chart of accounts setup")
        
        try:
            # Call ERPNext's setup_account_structure RPC to initialize chart of accounts
            self.proxy_request(
                tenant_id,
                "method/erpnext.accounts.utils.setup_account_structure",
                method="POST",
                json_data={
                    "company": company,
                    "chart_of_accounts": country_template
                }
            )
            
            # Fetch created accounts via list_resource
            accounts = self.list_resource("Account", tenant_id)
            # Filter to company (in real scenario, would use filters)
            company_accounts = [acc for acc in accounts if acc.get("company") == company]
            
            return {
                "status": "success",
                "company": company,
                "country_template": country_template,
                "accounts_created": len(company_accounts),
                "account_count": len(company_accounts),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "message": f"Chart of accounts initialized with {len(company_accounts)} accounts"
            }
        except Exception as e:
            # Return error response maintaining structure
            return {
                "status": "error",
                "company": company,
                "error_message": str(e),
                "created_at": datetime.now(timezone.utc).isoformat()
            }

    def enable_module(self, tenant_id: str, module_code: str, config: dict) -> dict:
        """
        Enable a module for a company during onboarding.
        
        Args:
            tenant_id: Tenant identifier
            module_code: Module code (e.g., 'inventory', 'pos', 'accounting')
            config: Module-specific configuration (optional)
            
        Returns:
            Dict with module enable status
        """
        from datetime import datetime
        
        # Map module codes to ERPNext modules
        module_mapping = {
            "inventory": "Stock",
            "pos": "Selling",
            "accounting": "Accounting",
            "crm": "CRM",
            "manufacturing": "Manufacturing",
            "hr": "Human Resources",
            "projects": "Projects",
            "purchasing": "Buying"
        }
        
        erp_module = module_mapping.get(module_code, module_code)
        company = config.get("company", "") if config else ""
        
        try:
            # Call ERPNext's module setup/enable endpoint
            # This sets up the module's DocTypes for the company
            module_enable_path = "method/erpnext.setup.setup_wizard.setup_wizard.set_module_enables"
            self.proxy_request(
                tenant_id,
                module_enable_path,
                method="POST",
                json_data={
                    "enabled_modules": [erp_module],
                    "company": company
                }
            )
            
            return {
                "status": "success",
                "module": erp_module,
                "module_code": module_code,
                "enabled": True,
                "company": company,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "message": f"Module {erp_module} enabled successfully"
            }
        except Exception as e:
            # Return error but maintain response structure
            return {
                "status": "error",
                "module": erp_module,
                "module_code": module_code,
                "enabled": False,
                "error_message": str(e),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
    
    # ============== PROVISIONING METHODS ==============
    
    def import_chart_of_accounts(
        self,
        tenant_id: str,
        company_name: str,
        template_name: str
    ) -> dict:
        """
        Import chart of accounts for a company using ERPNext's chart importer.
        
        This is the recommended method for importing country-specific chart of accounts.
        Uses: erpnext.accounts.doctype.chart_of_accounts_importer.chart_of_accounts_importer.import_chart_of_accounts
        
        Args:
            tenant_id: Tenant identifier
            company_name: Company name in ERPNext
            template_name: Chart template name (e.g., "Kenya", "Uganda", "Standard")
        
        Returns:
            Dict with import status and account count
        
        Raises:
            HTTPException: If import fails
        """
        from datetime import datetime, timezone
        
        try:
            # Check if accounts already exist (idempotency check)
            # Use filters in query params
            existing_response = self.proxy_request(
                tenant_id,
                "resource/Account",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"], ["is_group", "=", 0]]',
                    "limit_page_length": 10
                }
            )
            existing_accounts = existing_response.get("data", []) if isinstance(existing_response, dict) else []
            
            if existing_accounts and len(existing_accounts) > 5:  # Threshold: if more than 5 accounts exist
                return {
                    "status": "exists",
                    "company": company_name,
                    "template": template_name,
                    "accounts_count": len(existing_accounts),
                    "message": f"Chart of accounts already exists for {company_name}",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            
            # Call ERPNext's chart of accounts importer method
            response = self.proxy_request(
                tenant_id,
                "method/erpnext.accounts.doctype.chart_of_accounts_importer.chart_of_accounts_importer.import_chart_of_accounts",
                method="POST",
                json_data={
                    "company": company_name,
                    "chart_template": template_name
                }
            )
            
            # Verify import by checking account count
            accounts_response = self.proxy_request(
                tenant_id,
                "resource/Account",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company_name}"]]',
                    "limit_page_length": 1000
                }
            )
            accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
            account_count = len(accounts) if isinstance(accounts, list) else 0
            
            return {
                "status": "success",
                "company": company_name,
                "template": template_name,
                "accounts_count": account_count,
                "message": f"Chart of accounts imported successfully with {account_count} accounts",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "chart_import_error",
                    "message": f"Failed to import chart of accounts: {str(e)}",
                    "company": company_name,
                    "template": template_name
                }
            )
    
    def update_selling_settings(self, tenant_id: str, settings: dict) -> dict:
        """
        Update Selling Settings in ERPNext.
        
        Args:
            tenant_id: Tenant identifier
            settings: Dictionary of settings to update
                Example: {
                    "enable_pos": 1,
                    "default_customer": "Walk-In Customer",
                    "allow_negative_stock": 0,
                    "maintain_same_rate": 1
                }
        
        Returns:
            Dict with update status
        
        Raises:
            HTTPException: If update fails
        """
        from datetime import datetime, timezone
        
        try:
            # Get current settings first (idempotency check)
            current_settings = self.proxy_request(
                tenant_id,
                "resource/Selling Settings/Selling Settings",
                method="GET"
            )
            
            current_data = current_settings.get("data", {}) if isinstance(current_settings, dict) else {}
            
            # Merge settings (only update provided fields)
            merged_settings = {**current_data, **settings}
            
            # Only update if there are actual changes
            if merged_settings == current_data:
                return {
                    "status": "no_change",
                    "message": "Selling settings already match desired values",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            
            # Update settings
            response = self.proxy_request(
                tenant_id,
                "resource/Selling Settings/Selling Settings",
                method="PUT",
                json_data=merged_settings
            )
            
            return {
                "status": "success",
                "message": "Selling settings updated successfully",
                "updated_fields": list(settings.keys()),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "settings_update_error",
                    "message": f"Failed to update selling settings: {str(e)}"
                }
            )
    
    def update_stock_settings(self, tenant_id: str, settings: dict) -> dict:
        """
        Update Stock Settings in ERPNext.
        
        Args:
            tenant_id: Tenant identifier
            settings: Dictionary of settings to update
                Example: {
                    "enable_stock_tracking": 1,
                    "default_warehouse": "Main Store",
                    "auto_create_serial_and_batch_bundle_for_outward_transaction": 1
                }
        
        Returns:
            Dict with update status
        
        Raises:
            HTTPException: If update fails
        """
        from datetime import datetime, timezone
        
        try:
            # Get current settings first (idempotency check)
            current_settings = self.proxy_request(
                tenant_id,
                "resource/Stock Settings/Stock Settings",
                method="GET"
            )
            
            current_data = current_settings.get("data", {}) if isinstance(current_settings, dict) else {}
            
            # Only update if there are actual changes
            changed_settings = {
                key: value for key, value in settings.items()
                if current_data.get(key) != value
            }
            if not changed_settings:
                return {
                    "status": "no_change",
                    "message": "Stock settings already match desired values",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            
            # Update settings
            response = self.proxy_request(
                tenant_id,
                "resource/Stock Settings/Stock Settings",
                method="PUT",
                json_data=changed_settings
            )
            
            return {
                "status": "success",
                "message": "Stock settings updated successfully",
                "updated_fields": list(changed_settings.keys()),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "settings_update_error",
                    "message": f"Failed to update stock settings: {str(e)}"
                }
            )
    
    # ============== ABSTRACT METHOD IMPLEMENTATIONS ==============
    
    def execute_method(self, method: str, **kwargs) -> Dict:
        """Execute RPC method."""
        try:
            response = self.proxy_request(
                tenant_id=self.tenant_id,
                path=f"method/{method}",
                method="POST",
                json_data=kwargs
            )
            return self._wrap_response(response)
        except Exception as e:
            return self._handle_error(e)
    
    def supports_transactions(self) -> bool:
        """ERPNext supports transactions."""
        return True
    
    def supports_audit_trail(self) -> bool:
        """ERPNext tracks change history."""
        return True


# Export singleton adapter instance
erpnext_adapter = ERPNextClientAdapter()
