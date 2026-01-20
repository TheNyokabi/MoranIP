from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.iam import Tenant
from datetime import datetime
import uuid

router = APIRouter(
    prefix="/iam",
    tags=["ERP Modules"],
)

# Available ERPNext modules
AVAILABLE_ERP_MODULES = [
    {
        "code": "inventory",
        "name": "Inventory Management",
        "description": "Stock management, warehouses, item tracking",
        "icon": "package",
        "category": "Operations"
    },
    {
        "code": "pos",
        "name": "Point of Sale",
        "description": "Retail POS system for sales transactions",
        "icon": "shopping-cart",
        "category": "Sales"
    },
    {
        "code": "accounting",
        "name": "Accounting",
        "description": "General ledger, accounts payable/receivable",
        "icon": "calculator",
        "category": "Finance"
    },
    {
        "code": "crm",
        "name": "Customer Relationship Management",
        "description": "Leads, opportunities, customer management",
        "icon": "users",
        "category": "Sales"
    },
    {
        "code": "manufacturing",
        "name": "Manufacturing",
        "description": "Production planning, work orders, BOMs",
        "icon": "factory",
        "category": "Operations"
    },
    {
        "code": "hr",
        "name": "Human Resources",
        "description": "Employee management, payroll, attendance",
        "icon": "user-check",
        "category": "HR"
    },
    {
        "code": "projects",
        "name": "Project Management",
        "description": "Tasks, timesheets, project tracking",
        "icon": "briefcase",
        "category": "Operations"
    },
    {
        "code": "purchasing",
        "name": "Purchasing",
        "description": "Purchase orders, supplier management",
        "icon": "shopping-bag",
        "category": "Operations"
    }
]

@router.post("/tenants/{tenant_id}/erp/setup")
def setup_tenant_erp(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    Initialize ERPNext for a tenant.
    Creates ERP site using tenant_code as site name.
    """
    from app.models.erp_modules import TenantERPConfig
    
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if already configured
    existing_config = db.query(TenantERPConfig).filter(
        TenantERPConfig.tenant_id == tenant_id
    ).first()
    
    if existing_config:
        return {
            "message": "ERP already configured for this tenant",
            "config": {
                "site_name": existing_config.erp_site_name,
                "company_name": existing_config.erp_company_name,
                "is_provisioned": existing_config.is_provisioned
            }
        }
    
    # Create ERP config using tenant_code as site name
    erp_config = TenantERPConfig(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        erp_site_name=tenant.tenant_code,  # Use tenant code as unique site identifier
        erp_company_name=tenant.name,
        is_provisioned=False  # Will be set to True after actual ERPNext site creation
    )
    
    db.add(erp_config)
    db.commit()
    db.refresh(erp_config)
    
    return {
        "message": "ERP configuration created successfully",
        "config": {
            "site_name": erp_config.erp_site_name,
            "company_name": erp_config.erp_company_name,
            "is_provisioned": erp_config.is_provisioned
        }
    }

@router.get("/tenants/{tenant_id}/erp/modules")
def list_erp_modules(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    List all available ERP modules and which ones are enabled for this tenant.
    """
    from app.models.erp_modules import TenantERPModule
    
    # Get enabled modules for this tenant
    enabled_modules = db.query(TenantERPModule).filter(
        TenantERPModule.tenant_id == tenant_id,
        TenantERPModule.is_enabled == True
    ).all()
    
    enabled_codes = {m.module_code for m in enabled_modules}
    
    # Build response with all available modules
    modules = []
    for module in AVAILABLE_ERP_MODULES:
        is_enabled = module["code"] in enabled_codes
        module_data = {
            **module,
            "is_enabled": is_enabled
        }
        
        # Add configuration if enabled
        if is_enabled:
            enabled_module = next(m for m in enabled_modules if m.module_code == module["code"])
            module_data["configuration"] = enabled_module.configuration
            module_data["enabled_at"] = enabled_module.enabled_at.isoformat() if enabled_module.enabled_at else None
        
        modules.append(module_data)
    
    return {
        "tenant_id": tenant_id,
        "total_available": len(AVAILABLE_ERP_MODULES),
        "total_enabled": len(enabled_codes),
        "modules": modules
    }

@router.post("/tenants/{tenant_id}/erp/modules")
def enable_erp_module(
    tenant_id: str,
    module_code: str = Body(..., embed=True),
    configuration: dict = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """
    Enable an ERP module for a tenant.
    """
    from app.models.erp_modules import TenantERPModule, TenantERPConfig
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Verify ERP is set up
    erp_config = db.query(TenantERPConfig).filter(
        TenantERPConfig.tenant_id == tenant_id
    ).first()
    
    if not erp_config:
        raise HTTPException(
            status_code=400, 
            detail="ERP not configured for this tenant. Please run setup first."
        )
    
    # Verify module exists
    module_info = next((m for m in AVAILABLE_ERP_MODULES if m["code"] == module_code), None)
    if not module_info:
        raise HTTPException(status_code=404, detail=f"Module '{module_code}' not found")
    
    # Check if already enabled
    existing = db.query(TenantERPModule).filter(
        TenantERPModule.tenant_id == tenant_id,
        TenantERPModule.module_code == module_code
    ).first()
    
    if existing:
        if existing.is_enabled:
            return {
                "message": f"Module '{module_code}' is already enabled",
                "module": {
                    "code": existing.module_code,
                    "name": existing.module_name,
                    "is_enabled": existing.is_enabled
                }
            }
        else:
            # Re-enable
            existing.is_enabled = True
            existing.enabled_at = datetime.utcnow()
            if configuration:
                existing.configuration = configuration
            db.commit()
            db.refresh(existing)
            
            return {
                "message": f"Module '{module_code}' re-enabled successfully",
                "module": {
                    "code": existing.module_code,
                    "name": existing.module_name,
                    "is_enabled": existing.is_enabled
                }
            }
    
    # Create new module entry
    tenant_module = TenantERPModule(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        module_code=module_code,
        module_name=module_info["name"],
        is_enabled=True,
        configuration=configuration,
        enabled_at=datetime.utcnow()
    )
    
    db.add(tenant_module)
    db.commit()
    db.refresh(tenant_module)
    
    return {
        "message": f"Module '{module_code}' enabled successfully",
        "module": {
            "code": tenant_module.module_code,
            "name": tenant_module.module_name,
            "is_enabled": tenant_module.is_enabled,
            "enabled_at": tenant_module.enabled_at.isoformat()
        }
    }

@router.patch("/tenants/{tenant_id}/erp/modules/{module_code}/configure")
def configure_erp_module(
    tenant_id: str,
    module_code: str,
    configuration: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Update configuration for an enabled ERP module for a tenant.
    """
    from app.models.erp_modules import TenantERPModule
    
    # Find the module
    tenant_module = db.query(TenantERPModule).filter(
        TenantERPModule.tenant_id == tenant_id,
        TenantERPModule.module_code == module_code
    ).first()
    
    if not tenant_module:
        raise HTTPException(status_code=404, detail=f"Module '{module_code}' not found for this tenant")
    
    if not tenant_module.is_enabled:
        raise HTTPException(
            status_code=400, 
            detail=f"Module '{module_code}' must be enabled before configuration"
        )
    
    # Merge new configuration with existing
    if tenant_module.configuration is None:
        tenant_module.configuration = {}
    
    tenant_module.configuration.update(configuration)
    tenant_module.configured_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant_module)
    
    return {
        "message": f"Module '{module_code}' configured successfully",
        "module": {
            "code": tenant_module.module_code,
            "name": tenant_module.module_name,
            "is_enabled": tenant_module.is_enabled,
            "configuration": tenant_module.configuration,
            "configured_at": tenant_module.configured_at.isoformat() if tenant_module.configured_at else None
        }
    }

@router.delete("/tenants/{tenant_id}/erp/modules/{module_code}")
def disable_erp_module(
    tenant_id: str,
    module_code: str,
    db: Session = Depends(get_db)
):
    """
    Disable an ERP module for a tenant.
    """
    from app.models.erp_modules import TenantERPModule
    
    # Find the module
    tenant_module = db.query(TenantERPModule).filter(
        TenantERPModule.tenant_id == tenant_id,
        TenantERPModule.module_code == module_code
    ).first()
    
    if not tenant_module:
        raise HTTPException(status_code=404, detail=f"Module '{module_code}' not found for this tenant")
    
    if not tenant_module.is_enabled:
        return {
            "message": f"Module '{module_code}' is already disabled"
        }
    
    # Disable the module
    tenant_module.is_enabled = False
    db.commit()
    
    return {
        "message": f"Module '{module_code}' disabled successfully",
        "module": {
            "code": tenant_module.module_code,
            "name": tenant_module.module_name,
            "is_enabled": tenant_module.is_enabled
        }
    }
