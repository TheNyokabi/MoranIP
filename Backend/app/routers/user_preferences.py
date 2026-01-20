"""
User Preferences API Router
Handles user-specific preferences like favorites, recent workspaces, dashboard settings
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user_preferences import UserPreference
import uuid

router = APIRouter(
    prefix="/api/users/preferences",
    tags=["User Preferences"]
)

# --- Request/Response Models ---

class UserPreferencesResponse(BaseModel):
    favorite_workspaces: List[str] = Field(default_factory=list)
    recent_workspaces: List[str] = Field(default_factory=list)
    dashboard_view_mode: str = "grid"
    theme: str = "dark"
    language: str = "en"
    updated_at: datetime

    class Config:
        from_attributes = True


class UpdateFavoritesRequest(BaseModel):
    favorite_workspaces: List[str]


class UpdateRecentsRequest(BaseModel):
    recent_workspaces: List[str]


class UpdateViewModeRequest(BaseModel):
    dashboard_view_mode: str = Field(..., pattern="^(grid|list|compact)$")


class UpdatePreferencesRequest(BaseModel):
    favorite_workspaces: Optional[List[str]] = None
    recent_workspaces: Optional[List[str]] = None
    dashboard_view_mode: Optional[str] = Field(None, pattern="^(grid|list|compact)$")
    theme: Optional[str] = Field(None, pattern="^(light|dark)$")
    language: Optional[str] = None


# --- Endpoints ---

@router.get("", response_model=UserPreferencesResponse)
async def get_user_preferences(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's preferences.
    Creates default preferences if none exist.
    """
    user_id = current_user["sub"]
    
    # Try to get existing preferences
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    # Create default if doesn't exist
    if not prefs:
        prefs = UserPreference(
            user_id=user_id,
            favorite_workspaces=[],
            recent_workspaces=[],
            dashboard_view_mode="grid",
            theme="dark",
            language="en"
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    return prefs


@router.put("", response_model=UserPreferencesResponse)
async def update_user_preferences(
    updates: UpdatePreferencesRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user preferences.
    Only updates provided fields.
    """
    user_id = current_user["sub"]
    
    # Get or create preferences
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    if not prefs:
        prefs = UserPreference(user_id=user_id)
        db.add(prefs)
    
    # Update only provided fields
    if updates.favorite_workspaces is not None:
        prefs.favorite_workspaces = updates.favorite_workspaces[:50]  # Limit to 50
    
    if updates.recent_workspaces is not None:
        prefs.recent_workspaces = updates.recent_workspaces[:10]  # Limit to 10
    
    if updates.dashboard_view_mode is not None:
        prefs.dashboard_view_mode = updates.dashboard_view_mode
    
    if updates.theme is not None:
        prefs.theme = updates.theme
    
    if updates.language is not None:
        prefs.language = updates.language
    
    prefs.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(prefs)
    
    return prefs


@router.post("/favorites/toggle", response_model=UserPreferencesResponse)
async def toggle_favorite_workspace(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle a workspace as favorite.
    Adds if not present, removes if present.
    """
    user_id = current_user["sub"]
    
    # Get or create preferences
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    if not prefs:
        prefs = UserPreference(user_id=user_id, favorite_workspaces=[])
        db.add(prefs)
    
    # Toggle
    favorites = prefs.favorite_workspaces or []
    if tenant_id in favorites:
        favorites.remove(tenant_id)
    else:
        favorites.append(tenant_id)
        # Limit to 50 favorites
        favorites = favorites[-50:]
    
    prefs.favorite_workspaces = favorites
    prefs.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(prefs)
    
    return prefs


@router.post("/recents/add", response_model=UserPreferencesResponse)
async def add_recent_workspace(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a workspace to recent list.
    Moves to front if already exists.
    Maintains max 10 items.
    """
    user_id = current_user["sub"]
    
    # Get or create preferences
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    if not prefs:
        prefs = UserPreference(user_id=user_id, recent_workspaces=[])
        db.add(prefs)
    
    # Update recents
    recents = prefs.recent_workspaces or []
    
    # Remove if already exists
    if tenant_id in recents:
        recents.remove(tenant_id)
    
    # Add to front
    recents.insert(0, tenant_id)
    
    # Keep only last 10
    recents = recents[:10]
    
    prefs.recent_workspaces = recents
    prefs.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(prefs)
    
    return prefs


@router.delete("/favorites/{tenant_id}", response_model=UserPreferencesResponse)
async def remove_favorite_workspace(
    tenant_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a workspace from favorites"""
    user_id = current_user["sub"]
    
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    if not prefs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User preferences not found"
        )
    
    favorites = prefs.favorite_workspaces or []
    if tenant_id in favorites:
        favorites.remove(tenant_id)
        prefs.favorite_workspaces = favorites
        prefs.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(prefs)
    
    return prefs


@router.delete("/recents/clear", response_model=UserPreferencesResponse)
async def clear_recent_workspaces(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all recent workspaces"""
    user_id = current_user["sub"]
    
    stmt = select(UserPreference).where(UserPreference.user_id == user_id)
    prefs = db.execute(stmt).scalar_one_or_none()
    
    if not prefs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User preferences not found"
        )
    
    prefs.recent_workspaces = []
    prefs.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(prefs)
    
    return prefs
