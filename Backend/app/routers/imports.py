
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies.auth import get_current_user, require_tenant_access
from app.dependencies.permissions import get_current_user_permissions
from app.services.import_service import import_service
from typing import List

router = APIRouter(
    prefix="/imports",
    tags=["Data Import"],
)

TEMPLATES = {
    "users": "full_name,email,phone,password,role\nJohn Doe,john@example.com,+254700000000,ChangeMe!,STAFF",
    "inventory": "name,sku,sale_price,cost_price,type\nBlue Paint,PAINT-BLU,1000,800,product",
    "warehouses": "name,code\nmain Warehouse,WH1",
    "storefronts": "name\nNairobi CBD Store"
}

PERMISSIONS_MAP = {
    "users": "iam:users:create",
    "inventory": "inventory:products:create",
    "warehouses": "inventory:warehouses:create",
    "storefronts": "pos:config:create"
}

@router.get("/template/{entity_type}")
def get_template(entity_type: str):
    if entity_type not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    content = TEMPLATES[entity_type]
    return Response(content=content, media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename=template_{entity_type}.csv"
    })

@router.post("/validate/{entity_type}")
async def validate_import(
    entity_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(require_tenant_access)
):
    if entity_type not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    content = await file.read()
    data = import_service.parse_csv(content)
    
    errors = []
    if entity_type == "users":
        errors = import_service.validate_users(data, db)
    elif entity_type in ["inventory", "warehouses", "storefronts"]:
        # Basic validation handled in execute, but we can do a check here
        if entity_type == "inventory":
             errors = import_service.validate_erp_entity(data, ['name'])
        elif entity_type == "warehouses":
             errors = import_service.validate_erp_entity(data, ['name', 'code'])
        elif entity_type == "storefronts":
             errors = import_service.validate_erp_entity(data, ['name'])

    if errors:
        return {"valid": False, "errors": errors, "row_count": len(data)}
    
    return {"valid": True, "row_count": len(data), "preview": data[:5]}

@router.post("/execute/{entity_type}")
async def execute_import(
    entity_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(require_tenant_access),
    permissions: List[str] = Depends(get_current_user_permissions)
):
    if entity_type not in TEMPLATES:
        raise HTTPException(status_code=400, detail="Invalid entity type")

    # Check Permissions
    required_perm = PERMISSIONS_MAP.get(entity_type)
    if required_perm and required_perm not in permissions and "*:*:*" not in permissions:
         raise HTTPException(status_code=403, detail=f"Permission denied: {required_perm} required")

    content = await file.read()
    data = import_service.parse_csv(content)
    
    result = {}
    if entity_type == "users":
        result = import_service.import_users(data, tenant_id, db)
    elif entity_type == "inventory":
        result = import_service.import_inventory(data, tenant_id, db)
    elif entity_type == "warehouses":
        result = import_service.import_warehouses(data, tenant_id, db)
    elif entity_type == "storefronts":
        result = import_service.import_storefronts(data, tenant_id, db)
    
    return result
