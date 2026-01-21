"""
Notifications API
User notification management and delivery
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import logging

from app.database import get_db
from app.dependencies.auth import get_current_user

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class NotificationCreate(BaseModel):
    """Create notification request"""
    user_id: str = Field(..., description="Target user ID")
    tenant_id: Optional[str] = Field(None, description="Tenant context")
    title: str = Field(..., max_length=200)
    message: str = Field(..., max_length=1000)
    type: NotificationType = NotificationType.INFO
    action_url: Optional[str] = Field(None, description="URL to navigate on click")
    expires_at: Optional[str] = Field(None, description="Expiration datetime")


class NotificationResponse(BaseModel):
    """Notification response model"""
    id: str
    user_id: str
    tenant_id: Optional[str]
    title: str
    message: str
    type: str
    is_read: bool
    action_url: Optional[str]
    created_at: str
    read_at: Optional[str]


# In-memory storage for notifications (in production, use database)
# This is a temporary solution - the notification model should be added to the database
_notifications_store: Dict[str, List[Dict[str, Any]]] = {}


def _get_user_notifications(user_id: str) -> List[Dict[str, Any]]:
    """Get notifications for a user"""
    return _notifications_store.get(user_id, [])


def _add_notification(user_id: str, notification: Dict[str, Any]):
    """Add notification for a user"""
    if user_id not in _notifications_store:
        _notifications_store[user_id] = []
    _notifications_store[user_id].insert(0, notification)
    # Keep only last 100 notifications
    _notifications_store[user_id] = _notifications_store[user_id][:100]


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False, description="Show only unread notifications"),
    type: Optional[NotificationType] = Query(None, description="Filter by type"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    List notifications for current user
    
    Returns paginated list of notifications with filter options
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        
        notifications = _get_user_notifications(user_id)
        
        # Apply filters
        if unread_only:
            notifications = [n for n in notifications if not n.get("is_read")]
        
        if type:
            notifications = [n for n in notifications if n.get("type") == type.value]
        
        # Paginate
        total = len(notifications)
        notifications = notifications[offset:offset + limit]
        
        return {
            "notifications": notifications,
            "total": total,
            "unread_count": sum(1 for n in _get_user_notifications(user_id) if not n.get("is_read")),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Failed to list notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get unread notification count
    
    Returns count for badge display
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        notifications = _get_user_notifications(user_id)
        unread = sum(1 for n in notifications if not n.get("is_read"))
        
        return {
            "unread_count": unread,
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Failed to get unread count: {e}")
        return {"unread_count": 0}


@router.post("")
async def create_notification(
    notification: NotificationCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create a new notification (internal use)
    
    Typically called by system services, not end users
    """
    try:
        # Check if caller has permission (admin or system)
        caller_role = current_user.get("role", "")
        if caller_role not in ["ADMIN", "OWNER", "SYSTEM"]:
            raise HTTPException(
                status_code=403,
                detail="Only admins can create notifications for other users"
            )
        
        notification_id = str(uuid.uuid4())
        notification_data = {
            "id": notification_id,
            "user_id": notification.user_id,
            "tenant_id": notification.tenant_id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type.value,
            "is_read": False,
            "action_url": notification.action_url,
            "created_at": datetime.now().isoformat(),
            "read_at": None
        }
        
        _add_notification(notification.user_id, notification_data)
        
        logger.info(f"Notification created: {notification_id} for user {notification.user_id}")
        
        return {
            "success": True,
            "notification": notification_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notification_id}")
async def get_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get a specific notification
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        notifications = _get_user_notifications(user_id)
        
        for n in notifications:
            if n.get("id") == notification_id:
                return {"notification": n}
        
        raise HTTPException(status_code=404, detail="Notification not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mark a notification as read
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        notifications = _get_user_notifications(user_id)
        
        for n in notifications:
            if n.get("id") == notification_id:
                n["is_read"] = True
                n["read_at"] = datetime.now().isoformat()
                
                return {
                    "success": True,
                    "notification": n
                }
        
        raise HTTPException(status_code=404, detail="Notification not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mark all notifications as read
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        notifications = _get_user_notifications(user_id)
        
        read_count = 0
        for n in notifications:
            if not n.get("is_read"):
                n["is_read"] = True
                n["read_at"] = datetime.now().isoformat()
                read_count += 1
        
        return {
            "success": True,
            "marked_read": read_count
        }
        
    except Exception as e:
        logger.error(f"Failed to mark all as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Delete a notification
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        notifications = _get_user_notifications(user_id)
        
        for i, n in enumerate(notifications):
            if n.get("id") == notification_id:
                notifications.pop(i)
                
                return {
                    "success": True,
                    "id": notification_id,
                    "message": "Notification deleted"
                }
        
        raise HTTPException(status_code=404, detail="Notification not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def clear_all_notifications(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Clear all notifications for current user
    """
    try:
        user_id = current_user.get("user_id") or current_user.get("sub", "")
        
        if user_id in _notifications_store:
            count = len(_notifications_store[user_id])
            _notifications_store[user_id] = []
            
            return {
                "success": True,
                "cleared": count
            }
        
        return {
            "success": True,
            "cleared": 0
        }
        
    except Exception as e:
        logger.error(f"Failed to clear notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Utility function for other services to send notifications
async def send_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.INFO,
    action_url: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> str:
    """
    Send a notification to a user
    
    Can be called by other services to create notifications
    """
    notification_id = str(uuid.uuid4())
    notification_data = {
        "id": notification_id,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "title": title,
        "message": message,
        "type": notification_type.value,
        "is_read": False,
        "action_url": action_url,
        "created_at": datetime.now().isoformat(),
        "read_at": None
    }
    
    _add_notification(user_id, notification_data)
    
    return notification_id
