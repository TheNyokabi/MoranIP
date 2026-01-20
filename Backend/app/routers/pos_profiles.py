"""
PoS Profile Management Router
Configurable profiles for different store locations
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.pos_profile import (
    PosProfile,
    PosProfileCreate,
    PosProfileUpdate
)
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.dependencies.permissions import require_permission

router = APIRouter(prefix="/pos/profiles", tags=["PoS Profiles"])


@router.post("", response_model=dict, dependencies=[Depends(require_permission("pos:profiles:create"))])
async def create_pos_profile(
    profile: PosProfileCreate,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a new PoS Profile
    
    Configures payment methods, session rules, inventory behavior, and receipt settings
    for a specific warehouse/storefront.
    """
    try:
        result = await pos_service.create_profile(
            name=profile.name,
            warehouse=profile.warehouse,
            payment_methods=[pm.dict() for pm in profile.payment_methods],
            session_settings=profile.session_settings.dict(),
            inventory_settings=profile.inventory_settings.dict(),
            receipt_settings=profile.receipt_settings.dict()
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=dict)
async def list_pos_profiles(
    warehouse: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    List PoS Profiles
    
    Optionally filter by warehouse.
    """
    try:
        profiles = await pos_service.list_profiles(
            warehouse=warehouse,
            limit=limit,
            offset=offset
        )
        return {"profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{profile_id}", response_model=dict)
async def get_pos_profile(
    profile_id: str,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get PoS Profile by ID
    
    Returns complete profile configuration including all settings.
    """
    try:
        profile = await pos_service.get_profile(profile_id)
        return {"data": profile}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Profile not found: {str(e)}")


@router.put("/{profile_id}", response_model=dict)
async def update_pos_profile(
    profile_id: str,
    profile: PosProfileUpdate,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Update PoS Profile
    
    Update any aspect of the profile configuration.
    """
    try:
        update_data = profile.dict(exclude_unset=True)
        
        # Convert nested models to dicts
        if 'payment_methods' in update_data:
            update_data['payment_methods'] = [
                pm.dict() if hasattr(pm, 'dict') else pm 
                for pm in update_data['payment_methods']
            ]
        if 'session_settings' in update_data:
            update_data['session_settings'] = update_data['session_settings'].dict()
        if 'inventory_settings' in update_data:
            update_data['inventory_settings'] = update_data['inventory_settings'].dict()
        if 'receipt_settings' in update_data:
            update_data['receipt_settings'] = update_data['receipt_settings'].dict()
        
        result = await pos_service.update_profile(profile_id, **update_data)
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{profile_id}", response_model=dict)
async def delete_pos_profile(
    profile_id: str,
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Delete PoS Profile
    
    Permanently removes the profile. Cannot be undone.
    """
    try:
        success = await pos_service.delete_profile(profile_id)
        return {"success": success, "message": "Profile deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
