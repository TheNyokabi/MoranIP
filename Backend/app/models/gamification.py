"""
Gamification Models

Models for the gamification system including:
- Achievements/Badges
- Challenges/Quests
- Leaderboards
- Points System
- Streaks
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint, Text, Numeric, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .iam import Base


def generate_uuid():
    return uuid.uuid4()


class Achievement(Base):
    """Achievements/badges employees can earn"""
    __tablename__ = "achievements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    code = Column(String(50), nullable=False)  # "first_sale", "sales_champion", "perfect_attendance"
    name = Column(String(100), nullable=False)  # "First Sale!"
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)  # Icon name or emoji
    category = Column(String(50), nullable=False, default="general")  # "sales", "inventory", "attendance", "learning"
    
    # Unlock criteria
    criteria_type = Column(String(50), nullable=False, default="count")  # "count", "streak", "milestone", "manual"
    criteria_config = Column(JSONB, nullable=True)  # {"metric": "sales_count", "threshold": 100}
    
    # Rewards
    points_reward = Column(Integer, default=0)
    badge_tier = Column(String(20), default="bronze")  # "bronze", "silver", "gold", "platinum"
    
    # Visibility
    is_active = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False)  # Secret achievements
    display_order = Column(Integer, default=0)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    # Relationships
    user_achievements = relationship("UserAchievement", back_populates="achievement", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_achievement_code_per_tenant'),
    )


class UserAchievement(Base):
    """Achievements earned by users"""
    __tablename__ = "user_achievements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    achievement_id = Column(UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Progress tracking
    progress_current = Column(Integer, default=0)
    progress_target = Column(Integer, default=1)
    progress_percentage = Column(Numeric(5, 2), default=0)
    
    # Status
    earned_at = Column(TIMESTAMP(timezone=True), nullable=True)
    is_earned = Column(Boolean, default=False)
    is_claimed = Column(Boolean, default=False)  # If points were claimed
    claimed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    # Relationships
    achievement = relationship("Achievement", back_populates="user_achievements")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'achievement_id', name='unique_user_achievement'),
    )


class Challenge(Base):
    """Time-limited challenges/quests"""
    __tablename__ = "challenges"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)  # "Weekend Sales Sprint"
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    
    # Challenge type
    challenge_type = Column(String(50), default="individual")  # "individual", "team", "company"
    
    # Goals
    metric = Column(String(50), nullable=False)  # "total_sales", "items_sold", "new_customers"
    target_value = Column(Numeric(15, 2), nullable=False)
    metric_config = Column(JSONB, nullable=True)  # Additional metric configuration
    
    # Timing
    start_date = Column(TIMESTAMP(timezone=True), nullable=False)
    end_date = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Rewards
    points_reward = Column(Integer, default=0)
    prize_description = Column(Text, nullable=True)
    badge_reward_id = Column(UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=True)
    
    # Status
    status = Column(String(20), default="draft")  # "draft", "upcoming", "active", "completed", "cancelled"
    
    # Settings
    max_participants = Column(Integer, nullable=True)  # None = unlimited
    min_participants = Column(Integer, default=1)
    is_public = Column(Boolean, default=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    # Relationships
    participants = relationship("ChallengeParticipant", back_populates="challenge", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_challenge_code_per_tenant'),
    )


class ChallengeParticipant(Base):
    """Users participating in challenges"""
    __tablename__ = "challenge_participants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    challenge_id = Column(UUID(as_uuid=True), ForeignKey("challenges.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Progress
    current_value = Column(Numeric(15, 2), default=0)
    progress_percentage = Column(Numeric(5, 2), default=0)
    
    # Status
    joined_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)
    is_winner = Column(Boolean, default=False)
    
    # Rewards
    points_awarded = Column(Integer, default=0)
    prize_claimed = Column(Boolean, default=False)
    
    # Relationships
    challenge = relationship("Challenge", back_populates="participants")
    
    __table_args__ = (
        UniqueConstraint('challenge_id', 'user_id', name='unique_challenge_participant'),
    )


class Leaderboard(Base):
    """Leaderboard configurations"""
    __tablename__ = "leaderboards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)  # "Top Sellers This Month"
    description = Column(Text, nullable=True)
    
    # Metrics
    metric = Column(String(50), nullable=False)  # "sales_value", "items_sold", "points"
    metric_config = Column(JSONB, nullable=True)
    
    # Period
    period = Column(String(20), default="monthly")  # "daily", "weekly", "monthly", "quarterly", "yearly", "all_time"
    
    # Display settings
    max_entries = Column(Integer, default=10)
    is_visible = Column(Boolean, default=True)
    show_rank_change = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_leaderboard_code_per_tenant'),
    )


class LeaderboardEntry(Base):
    """Cached leaderboard entries for performance"""
    __tablename__ = "leaderboard_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    leaderboard_id = Column(UUID(as_uuid=True), ForeignKey("leaderboards.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Period info (for historical tracking)
    period_start = Column(TIMESTAMP(timezone=True), nullable=False)
    period_end = Column(TIMESTAMP(timezone=True), nullable=False)
    
    # Ranking
    rank = Column(Integer, nullable=False)
    previous_rank = Column(Integer, nullable=True)
    rank_change = Column(Integer, default=0)  # positive = moved up, negative = moved down
    
    # Score
    score = Column(Numeric(15, 2), default=0)
    
    # Metadata
    calculated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    
    __table_args__ = (
        UniqueConstraint('leaderboard_id', 'user_id', 'period_start', name='unique_leaderboard_user_period'),
    )


class UserPoints(Base):
    """Track user points balance and level"""
    __tablename__ = "user_points"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Points
    total_points_earned = Column(Integer, default=0)  # Lifetime earned
    total_points_spent = Column(Integer, default=0)  # Lifetime spent
    available_points = Column(Integer, default=0)  # Current balance
    
    # Leveling
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)
    experience_to_next_level = Column(Integer, default=100)
    
    # Streaks
    current_streak = Column(Integer, default=0)  # Days active
    longest_streak = Column(Integer, default=0)
    streak_last_updated = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Stats
    achievements_earned = Column(Integer, default=0)
    challenges_completed = Column(Integer, default=0)
    challenges_won = Column(Integer, default=0)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'tenant_id', name='unique_user_points_per_tenant'),
    )


class PointsTransaction(Base):
    """Points earn/spend history"""
    __tablename__ = "points_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Transaction details
    transaction_type = Column(String(20), nullable=False)  # "earn", "redeem", "bonus", "penalty", "expire"
    points = Column(Integer, nullable=False)  # Positive for earn, negative for spend
    
    # Source tracking
    source = Column(String(50), nullable=False)  # "sale", "achievement", "challenge", "streak", "manual", "referral"
    source_id = Column(String(100), nullable=True)  # Reference ID (e.g., invoice_id)
    source_type = Column(String(50), nullable=True)  # "POS Invoice", "Achievement", etc.
    
    # Description
    description = Column(String(255), nullable=True)
    
    # Balance tracking
    balance_before = Column(Integer, default=0)
    balance_after = Column(Integer, default=0)
    
    # Transaction data (extra metadata)
    transaction_data = Column(JSONB, nullable=True)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))


class GamificationSettings(Base):
    """Tenant-level gamification settings"""
    __tablename__ = "gamification_settings"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    
    # Feature toggles
    is_enabled = Column(Boolean, default=True)
    achievements_enabled = Column(Boolean, default=True)
    challenges_enabled = Column(Boolean, default=True)
    leaderboards_enabled = Column(Boolean, default=True)
    points_enabled = Column(Boolean, default=True)
    streaks_enabled = Column(Boolean, default=True)
    
    # Points configuration
    points_per_sale = Column(Numeric(5, 2), default=1)  # Points per currency unit sold
    points_per_item = Column(Integer, default=5)  # Bonus points per item sold
    points_for_new_customer = Column(Integer, default=50)
    streak_bonus_multiplier = Column(Numeric(3, 2), default=1.1)  # 10% bonus for streaks
    
    # Level configuration
    base_xp_per_level = Column(Integer, default=100)
    xp_growth_rate = Column(Numeric(3, 2), default=1.5)  # XP needed grows by 50% each level
    
    # Streak configuration
    streak_grace_hours = Column(Integer, default=24)  # Hours before streak resets
    max_streak_multiplier = Column(Numeric(3, 2), default=2.0)
    
    # Notifications
    notify_on_achievement = Column(Boolean, default=True)
    notify_on_level_up = Column(Boolean, default=True)
    notify_on_leaderboard_change = Column(Boolean, default=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)


class Reward(Base):
    """Redeemable rewards catalog"""
    __tablename__ = "rewards"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    
    # Cost
    points_cost = Column(Integer, nullable=False)
    
    # Type
    reward_type = Column(String(50), nullable=False)  # "physical", "digital", "discount", "time_off", "recognition"
    
    # Availability
    quantity_available = Column(Integer, nullable=True)  # None = unlimited
    quantity_redeemed = Column(Integer, default=0)
    
    # Validity
    valid_from = Column(TIMESTAMP(timezone=True), nullable=True)
    valid_until = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Requirements
    min_level = Column(Integer, default=1)
    required_achievement_id = Column(UUID(as_uuid=True), ForeignKey("achievements.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_reward_code_per_tenant'),
    )


class RewardRedemption(Base):
    """Track reward redemptions"""
    __tablename__ = "reward_redemptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    reward_id = Column(UUID(as_uuid=True), ForeignKey("rewards.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    points_transaction_id = Column(UUID(as_uuid=True), ForeignKey("points_transactions.id"), nullable=True)
    
    # Cost at time of redemption
    points_spent = Column(Integer, nullable=False)
    
    # Status
    status = Column(String(20), default="pending")  # "pending", "approved", "fulfilled", "cancelled"
    
    # Fulfillment
    fulfilled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    fulfilled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    fulfillment_notes = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=datetime.utcnow)
