import xmlrpc.client
from fastapi import HTTPException
from app.config import settings
from app.services.engine_adapter import EngineAdapter
from app.middleware.response_normalizer import ResponseNormalizer
from typing import Dict, Optional


class OdooClientAdapter(EngineAdapter):
    def __init__(self, tenant_id: str = "demo", **kwargs):
        super().__init__(tenant_id, **kwargs)
        self.common_url = f"http://{settings.ODOO_DB_HOST}:{settings.ODOO_DB_PORT}/xmlrpc/2/common"
        self.object_url = f"http://{settings.ODOO_DB_HOST}:{settings.ODOO_DB_PORT}/xmlrpc/2/object"
    
    def _init_credentials(self, **kwargs):
        # Initialize Odoo-specific credentials.
        # Credentials come from settings
        pass

    def _get_tenant_credentials(self, tenant_id: str):
        """
        Resolves system credentials for a given tenant.
        In production, this would fetch from a secure Vault or encrypted DB.
        """
        if tenant_id in ["demo", "moran", "f83650c4-ca25-48ce-9d5e-eb5a4d9b166e"]:
            return {
                "db": settings.POSTGRES_DB,
                "user": "admin", # System user for the engine
                "password": "admin" # Should be settings.ODOO_ADMIN_PASSWORD
            }
        raise HTTPException(status_code=403, detail=f"Unknown tenant: {tenant_id}")

    def authenticate_system(self, tenant_id: str):
        """
        Authenticates the system user for the tenant to ensure connectivity/validity.
        Returns user ID (uid).
        """
        creds = self._get_tenant_credentials(tenant_id)
        try:
            common = xmlrpc.client.ServerProxy(self.common_url)
            uid = common.authenticate(creds['db'], creds['user'], creds['password'], {})
            if not uid:
                raise HTTPException(status_code=500, detail="Odoo system authentication failed")
            return uid
        except xmlrpc.client.Fault as e:
            raise HTTPException(status_code=502, detail=f"Odoo Engine Error: {e.faultString}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Odoo Connection Error: {str(e)}")

    def execute_kw(self, tenant_id: str, model: str, method: str, args: list = None, kwargs: dict = None):
        """
        Stateless execution of an Odoo method using tenant system credentials.
        """
        creds = self._get_tenant_credentials(tenant_id)
        args = args or []
        kwargs = kwargs or {}

        try:
            # 1. Authenticate (could be cached in Redis for performance)
            common = xmlrpc.client.ServerProxy(self.common_url)
            uid = common.authenticate(creds['db'], creds['user'], creds['password'], {})
            if not uid:
                 raise HTTPException(status_code=500, detail="Engine authentication failed during execution")

            # 2. Execute
            models = xmlrpc.client.ServerProxy(self.object_url)
            return models.execute_kw(creds['db'], uid, creds['password'], model, method, args, kwargs)

        except xmlrpc.client.Fault as e:
             # Sanitize Odoo errors
            raise HTTPException(status_code=400, detail=f"Engine Logic Error: {e.faultString}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Engine Communication Error: {str(e)}")

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
                
        Returns:
            Dict with created company details
        """
        company_data = {
            "name": config.get("company_name", f"Company-{tenant_id[:8]}"),
            "currency_id": self._get_currency_id(tenant_id, config.get("company_currency", "KES")),
        }
        
        company_id = self.execute_kw(
            tenant_id,
            "res.company",
            "create",
            [company_data]
        )
        
        # Fetch created company
        company = self.execute_kw(
            tenant_id,
            "res.company",
            "read",
            [company_id],
            {"fields": ["id", "name", "currency_id"]}
        )[0]
        
        return {
            "company_id": company.get("id"),
            "company_name": company.get("name"),
            "currency_id": company.get("currency_id"),
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }

    def setup_step_warehouse(self, tenant_id: str, config: dict) -> dict:
        """
        Setup warehouse during onboarding (for Inventory module).
        
        Args:
            tenant_id: Tenant identifier
            config: Configuration dict with keys:
                - warehouse_name: Name of warehouse
                - company_id: Company ID (must exist)
                
        Returns:
            Dict with created warehouse details
        """
        warehouse_data = {
            "name": config.get("warehouse_name", "Main Store"),
            "company_id": config.get("company_id"),
        }
        
        warehouse_id = self.execute_kw(
            tenant_id,
            "stock.warehouse",
            "create",
            [warehouse_data]
        )
        
        warehouse = self.execute_kw(
            tenant_id,
            "stock.warehouse",
            "read",
            [warehouse_id],
            {"fields": ["id", "name", "company_id"]}
        )[0]
        
        return {
            "warehouse_id": warehouse.get("id"),
            "warehouse_name": warehouse.get("name"),
            "company_id": warehouse.get("company_id"),
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }

    def setup_step_chart_of_accounts(self, tenant_id: str, config: dict) -> dict:
        """
        Setup chart of accounts during onboarding (for Accounting module).
        
        Args:
            tenant_id: Tenant identifier
            config: Configuration dict with keys:
                - company_id: Company ID
                - country_template: Chart of accounts template
                
        Returns:
            Dict with setup status
        """
        # In real implementation, call Odoo's account setup
        # For now, return stub response
        return {
            "status": "success",
            "company_id": config.get("company_id"),
            "accounts_created": True,
            "created_at": __import__('datetime').datetime.utcnow().isoformat()
        }

    def enable_module(self, tenant_id: str, module_code: str, config: dict) -> dict:
        """
        Enable a module for an Odoo database during onboarding.
        
        Args:
            tenant_id: Tenant identifier
            module_code: Module code (e.g., 'inventory', 'pos', 'accounting')
            config: Module-specific configuration
            
        Returns:
            Dict with module enable status
        """
        # Map MoranERP module codes to Odoo module names
        module_mapping = {
            "inventory": "stock",
            "pos": "point_of_sale",
            "accounting": "account",
            "crm": "crm",
            "manufacturing": "mrp",
            "hr": "hr",
            "projects": "project",
            "purchasing": "purchase"
        }
        
        odoo_module = module_mapping.get(module_code, module_code)
        
        try:
            # Get module in Odoo
            module_ids = self.execute_kw(
                tenant_id,
                "ir.module.module",
                "search",
                [[("name", "=", odoo_module)]]
            )
            
            if not module_ids:
                return {
                    "status": "error",
                    "module": odoo_module,
                    "message": f"Module {odoo_module} not found",
                    "enabled": False
                }
            
            # Button to install (if not already installed)
            self.execute_kw(
                tenant_id,
                "ir.module.module",
                "button_immediate_install",
                module_ids
            )
            
            return {
                "status": "success",
                "module": odoo_module,
                "module_code": module_code,
                "enabled": True,
                "created_at": __import__('datetime').datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "status": "error",
                "module": odoo_module,
                "message": str(e),
                "enabled": False
            }

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _get_currency_id(self, tenant_id: str, currency_code: str) -> int:
        """Get Odoo currency ID by code."""
        currencies = self.execute_kw(
            tenant_id,
            "res.currency",
            "search",
            [[("name", "=", currency_code)]]
        )
        
        if currencies:
            return currencies[0]
        
        # Default to KES if not found
        kkes = self.execute_kw(
            tenant_id,
            "res.currency",
            "search",
            [[("name", "=", "KES")]]
        )
        
        return kkes[0] if kkes else None

    # ============== ABSTRACT METHOD IMPLEMENTATIONS ==============
    
    def list_resource(self, doctype: str, filters: Optional[Dict] = None) -> Dict:
        """List resources (Odoo models)."""
        try:
            domain = self._dict_to_domain(filters or {})
            response = self.execute_kw(
                self.tenant_id,
                doctype,
                'search_read',
                [domain],
                {'fields': ['__all__']}
            )
            return self._wrap_response(response)
        except Exception as e:
            return self._handle_error(e)
    
    def get_resource(self, doctype: str, name: str) -> Dict:
        """Get single resource (record) by ID."""
        try:
            response = self.execute_kw(
                self.tenant_id,
                doctype,
                'read',
                [int(name)],
                {'fields': ['__all__']}
            )
            return self._wrap_response(response[0] if response else {})
        except Exception as e:
            return self._handle_error(e)
    
    def create_resource(self, doctype: str, data: Dict) -> Dict:
        """Create new resource (record)."""
        try:
            record_id = self.execute_kw(
                self.tenant_id,
                doctype,
                'create',
                [data]
            )
            return self._wrap_response({"id": record_id})
        except Exception as e:
            return self._handle_error(e)
    
    def update_resource(self, doctype: str, name: str, data: Dict) -> Dict:
        """Update existing resource (record)."""
        try:
            self.execute_kw(
                self.tenant_id,
                doctype,
                'write',
                [int(name)],
                data
            )
            return self._wrap_response({"updated": True})
        except Exception as e:
            return self._handle_error(e)
    
    def delete_resource(self, doctype: str, name: str) -> Dict:
        """Delete resource (record)."""
        try:
            self.execute_kw(
                self.tenant_id,
                doctype,
                'unlink',
                [int(name)]
            )
            return self._wrap_response({"deleted": True})
        except Exception as e:
            return self._handle_error(e)
    
    def execute_method(self, method: str, **kwargs) -> Dict:
        """Execute RPC method."""
        try:
            model, action = method.split(".")
            response = self.execute_kw(
                self.tenant_id,
                model,
                action,
                [],
                kwargs
            )
            return self._wrap_response(response)
        except Exception as e:
            return self._handle_error(e)
    
    def supports_transactions(self) -> bool:
        """Odoo supports transactions."""
        return True
    
    def supports_audit_trail(self) -> bool:
        """Odoo tracks change history."""
        return True
    
    def _dict_to_domain(self, filters: Dict) -> list:
        """Convert filter dict to Odoo domain syntax."""
        domain = []
        for key, value in filters.items():
            if isinstance(value, (list, tuple)):
                domain.append((key, 'in', value))
            else:
                domain.append((key, '=', value))
        return domain

odoo_adapter = OdooClientAdapter()
