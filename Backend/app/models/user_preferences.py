"""
User Preferences Model
Stores user-specific preferences like favorite workspaces, recent workspaces, etc.
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import uuid


class UserPreference(Base):
    """User preferences and settings"""
    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Preference data stored as JSON
    favorite_workspaces = Column(JSON, default=list, nullable=False)  # List of tenant IDs
    recent_workspaces = Column(JSON, default=list, nullable=False)    # List of tenant IDs (max 10)
    dashboard_view_mode = Column(String(20), default="grid")          # grid, list, compact
    
    # Additional preferences (for future use)
    theme = Column(String(20), default="dark")
    language = Column(String(10), default="en")
    notification_settings = Column(JSON, default=dict)
    custom_settings = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('ix_user_preferences_user_id', 'user_id'),
    )
