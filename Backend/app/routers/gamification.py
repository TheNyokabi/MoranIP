"""
Gamification API Router

Endpoints for:
- Achievements
- Challenges
- Leaderboards
- Points
- Rewards
- User profiles
"""

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.gamification_service import GamificationService
from ..models.gamification import (
    Achievement, Challenge, Leaderboard, UserPoints,
    GamificationSettings, Reward
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gamification", tags=["Gamification"])


# ==================== Pydantic Models ====================

class PointsBalance(BaseModel):
    available: int
    total_earned: int
    total_spent: int


class LevelInfo(BaseModel):
    current: int
    experience: int
    experience_to_next: int
    progress_percentage: float


class StreakInfo(BaseModel):
    current: int
    longest: int


class UserStats(BaseModel):
    achievements_earned: int
    challenges_completed: int
    challenges_won: int


class GamificationProfile(BaseModel):
    points: PointsBalance
    level: LevelInfo
    streak: StreakInfo
    stats: UserStats


class AchievementResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    icon: Optional[str]
    category: str
    badge_tier: str
    points_reward: int
    progress_current: int = 0
    progress_target: int = 1
    progress_percentage: float = 0
    is_earned: bool = False
    earned_at: Optional[datetime] = None
    is_claimed: bool = False

    class Config:
        from_attributes = True


class ChallengeResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    icon: Optional[str]
    challenge_type: str
    metric: str
    target_value: float
    start_date: datetime
    end_date: datetime
    points_reward: int
    prize_description: Optional[str]
    status: str
    current_value: float = 0
    progress_percentage: float = 0
    is_completed: bool = False
    joined_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    user_name: str
    score: float
    rank_change: int = 0


class LeaderboardResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    metric: str
    period: str
    entries: List[LeaderboardEntry] = []

    class Config:
        from_attributes = True


class RewardResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    image_url: Optional[str]
    points_cost: int
    reward_type: str
    quantity_available: Optional[int]
    quantity_remaining: Optional[int]
    min_level: int
    available: bool
    can_afford: bool
    can_redeem: bool

    class Config:
        from_attributes = True


class PointsTransactionResponse(BaseModel):
    id: str
    transaction_type: str
    points: int
    source: str
    description: Optional[str]
    balance_after: int
    created_at: datetime

    class Config:
        from_attributes = True


class GamificationSettingsUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    achievements_enabled: Optional[bool] = None
    challenges_enabled: Optional[bool] = None
    leaderboards_enabled: Optional[bool] = None
    points_enabled: Optional[bool] = None
    streaks_enabled: Optional[bool] = None
    points_per_sale: Optional[float] = None
    points_per_item: Optional[int] = None
    points_for_new_customer: Optional[int] = None
    streak_bonus_multiplier: Optional[float] = None


class CreateChallengeRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    challenge_type: str = "individual"
    metric: str
    target_value: float
    start_date: datetime
    end_date: datetime
    points_reward: int = 0
    prize_description: Optional[str] = None
    max_participants: Optional[int] = None
    is_public: bool = True


class CreateRewardRequest(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    points_cost: int
    reward_type: str = "physical"
    quantity_available: Optional[int] = None
    min_level: int = 1


# ==================== Dependencies ====================

def get_gamification_service(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
) -> GamificationService:
    return GamificationService(
        db=db,
        tenant_id=tenant_id,
        current_user_id=current_user.get("user_id")
    )


# ==================== Profile Endpoints ====================

@router.get("/profile", response_model=GamificationProfile)
async def get_my_profile(
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get current user's gamification profile"""
    user_id = current_user.get("user_id")
    return service.get_user_profile(user_id)


@router.get("/profile/{user_id}", response_model=GamificationProfile)
async def get_user_profile(
    user_id: str,
    service: GamificationService = Depends(get_gamification_service)
):
    """Get a specific user's gamification profile"""
    return service.get_user_profile(user_id)


# ==================== Achievement Endpoints ====================

@router.get("/achievements", response_model=List[AchievementResponse])
async def list_achievements(
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get all achievements with user's progress"""
    user_id = current_user.get("user_id")
    achievements_data = service.get_user_achievements(user_id)
    
    result = []
    for data in achievements_data:
        achievement = data["achievement"]
        result.append(AchievementResponse(
            id=str(achievement.id),
            code=achievement.code,
            name=achievement.name,
            description=achievement.description,
            icon=achievement.icon,
            category=achievement.category,
            badge_tier=achievement.badge_tier,
            points_reward=achievement.points_reward,
            progress_current=data["progress_current"],
            progress_target=data["progress_target"],
            progress_percentage=data["progress_percentage"],
            is_earned=data["is_earned"],
            earned_at=data["earned_at"],
            is_claimed=data["is_claimed"]
        ))
    
    return result


@router.post("/achievements/{achievement_id}/claim")
async def claim_achievement_reward(
    achievement_id: str,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Claim reward for an earned achievement"""
    from ..models.gamification import UserAchievement
    
    user_id = current_user.get("user_id")
    
    ua = db.query(UserAchievement).filter(
        UserAchievement.user_id == user_id,
        UserAchievement.achievement_id == achievement_id,
        UserAchievement.is_earned == True,
        UserAchievement.is_claimed == False
    ).first()
    
    if not ua:
        raise HTTPException(status_code=404, detail="Achievement not found or already claimed")
    
    ua.is_claimed = True
    ua.claimed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Achievement reward claimed"}


# ==================== Challenge Endpoints ====================

@router.get("/challenges", response_model=List[ChallengeResponse])
async def list_challenges(
    status: Optional[str] = Query(None, description="Filter by status: active, upcoming, completed"),
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all challenges"""
    query = db.query(Challenge).filter(
        Challenge.tenant_id == service.tenant_id
    )
    
    if status:
        query = query.filter(Challenge.status == status)
    
    challenges = query.order_by(Challenge.start_date.desc()).all()
    
    # Get user's participations
    from ..models.gamification import ChallengeParticipant
    user_id = current_user.get("user_id")
    participations = {
        str(p.challenge_id): p
        for p in db.query(ChallengeParticipant).filter(
            ChallengeParticipant.user_id == user_id
        ).all()
    }
    
    result = []
    for challenge in challenges:
        participation = participations.get(str(challenge.id))
        result.append(ChallengeResponse(
            id=str(challenge.id),
            code=challenge.code,
            name=challenge.name,
            description=challenge.description,
            icon=challenge.icon,
            challenge_type=challenge.challenge_type,
            metric=challenge.metric,
            target_value=float(challenge.target_value),
            start_date=challenge.start_date,
            end_date=challenge.end_date,
            points_reward=challenge.points_reward,
            prize_description=challenge.prize_description,
            status=challenge.status,
            current_value=float(participation.current_value) if participation else 0,
            progress_percentage=float(participation.progress_percentage) if participation else 0,
            is_completed=participation.is_completed if participation else False,
            joined_at=participation.joined_at if participation else None
        ))
    
    return result


@router.get("/challenges/active", response_model=List[ChallengeResponse])
async def list_active_challenges(
    service: GamificationService = Depends(get_gamification_service)
):
    """Get active challenges"""
    challenges = service.get_active_challenges()
    return [
        ChallengeResponse(
            id=str(c.id),
            code=c.code,
            name=c.name,
            description=c.description,
            icon=c.icon,
            challenge_type=c.challenge_type,
            metric=c.metric,
            target_value=float(c.target_value),
            start_date=c.start_date,
            end_date=c.end_date,
            points_reward=c.points_reward,
            prize_description=c.prize_description,
            status=c.status
        )
        for c in challenges
    ]


@router.post("/challenges", response_model=ChallengeResponse)
async def create_challenge(
    request: CreateChallengeRequest,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new challenge (admin only)"""
    # Check if code already exists
    existing = db.query(Challenge).filter(
        Challenge.tenant_id == service.tenant_id,
        Challenge.code == request.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Challenge code already exists")
    
    # Determine status based on dates
    now = datetime.utcnow()
    if request.start_date > now:
        status = "upcoming"
    elif request.end_date < now:
        status = "completed"
    else:
        status = "active"
    
    challenge = Challenge(
        tenant_id=service.tenant_id,
        code=request.code,
        name=request.name,
        description=request.description,
        icon=request.icon,
        challenge_type=request.challenge_type,
        metric=request.metric,
        target_value=request.target_value,
        start_date=request.start_date,
        end_date=request.end_date,
        points_reward=request.points_reward,
        prize_description=request.prize_description,
        max_participants=request.max_participants,
        is_public=request.is_public,
        status=status,
        created_by=current_user.get("user_id")
    )
    
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    
    return ChallengeResponse(
        id=str(challenge.id),
        code=challenge.code,
        name=challenge.name,
        description=challenge.description,
        icon=challenge.icon,
        challenge_type=challenge.challenge_type,
        metric=challenge.metric,
        target_value=float(challenge.target_value),
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        points_reward=challenge.points_reward,
        prize_description=challenge.prize_description,
        status=challenge.status
    )


@router.post("/challenges/{challenge_id}/join")
async def join_challenge(
    challenge_id: str,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Join a challenge"""
    user_id = current_user.get("user_id")
    participant = service.join_challenge(user_id, challenge_id)
    
    if not participant:
        raise HTTPException(status_code=400, detail="Unable to join challenge")
    
    return {"message": "Successfully joined challenge", "joined_at": participant.joined_at}


@router.get("/challenges/my", response_model=List[ChallengeResponse])
async def get_my_challenges(
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get challenges I'm participating in"""
    user_id = current_user.get("user_id")
    challenges_data = service.get_user_challenges(user_id)
    
    result = []
    for data in challenges_data:
        challenge = data["challenge"]
        result.append(ChallengeResponse(
            id=str(challenge.id),
            code=challenge.code,
            name=challenge.name,
            description=challenge.description,
            icon=challenge.icon,
            challenge_type=challenge.challenge_type,
            metric=challenge.metric,
            target_value=float(challenge.target_value),
            start_date=challenge.start_date,
            end_date=challenge.end_date,
            points_reward=challenge.points_reward,
            prize_description=challenge.prize_description,
            status=challenge.status,
            current_value=data["current_value"],
            progress_percentage=data["progress_percentage"],
            is_completed=data["is_completed"],
            joined_at=data["joined_at"]
        ))
    
    return result


# ==================== Leaderboard Endpoints ====================

@router.get("/leaderboards", response_model=List[LeaderboardResponse])
async def list_leaderboards(
    service: GamificationService = Depends(get_gamification_service)
):
    """Get all visible leaderboards with rankings"""
    leaderboards = service.get_leaderboards()
    
    result = []
    for lb in leaderboards:
        entries = service.get_leaderboard_rankings(str(lb.id))
        result.append(LeaderboardResponse(
            id=str(lb.id),
            code=lb.code,
            name=lb.name,
            description=lb.description,
            metric=lb.metric,
            period=lb.period,
            entries=[LeaderboardEntry(**e) for e in entries]
        ))
    
    return result


@router.get("/leaderboards/{leaderboard_id}", response_model=LeaderboardResponse)
async def get_leaderboard(
    leaderboard_id: str,
    limit: int = Query(10, ge=1, le=100),
    service: GamificationService = Depends(get_gamification_service),
    db: Session = Depends(get_db)
):
    """Get a specific leaderboard with rankings"""
    leaderboard = db.query(Leaderboard).filter(
        Leaderboard.id == leaderboard_id
    ).first()
    
    if not leaderboard:
        raise HTTPException(status_code=404, detail="Leaderboard not found")
    
    entries = service.get_leaderboard_rankings(leaderboard_id, limit=limit)
    
    return LeaderboardResponse(
        id=str(leaderboard.id),
        code=leaderboard.code,
        name=leaderboard.name,
        description=leaderboard.description,
        metric=leaderboard.metric,
        period=leaderboard.period,
        entries=[LeaderboardEntry(**e) for e in entries]
    )


@router.get("/leaderboards/{leaderboard_id}/my-rank")
async def get_my_rank(
    leaderboard_id: str,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get my rank in a leaderboard"""
    user_id = current_user.get("user_id")
    rank = service.get_user_rank(user_id, leaderboard_id)
    
    if not rank:
        return {"rank": None, "message": "Not ranked yet"}
    
    return rank


# ==================== Points Endpoints ====================

@router.get("/points/balance")
async def get_points_balance(
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get current points balance"""
    user_id = current_user.get("user_id")
    user_points = service.get_user_points(user_id)
    
    return {
        "available": user_points.available_points,
        "total_earned": user_points.total_points_earned,
        "total_spent": user_points.total_points_spent
    }


@router.get("/points/history", response_model=List[PointsTransactionResponse])
async def get_points_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    transaction_type: Optional[str] = None,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get points transaction history"""
    from ..models.gamification import PointsTransaction
    
    user_id = current_user.get("user_id")
    
    query = db.query(PointsTransaction).filter(
        PointsTransaction.user_id == user_id,
        PointsTransaction.tenant_id == service.tenant_id
    )
    
    if transaction_type:
        query = query.filter(PointsTransaction.transaction_type == transaction_type)
    
    transactions = query.order_by(
        PointsTransaction.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [
        PointsTransactionResponse(
            id=str(t.id),
            transaction_type=t.transaction_type,
            points=t.points,
            source=t.source,
            description=t.description,
            balance_after=t.balance_after,
            created_at=t.created_at
        )
        for t in transactions
    ]


# ==================== Rewards Endpoints ====================

@router.get("/rewards", response_model=List[RewardResponse])
async def list_rewards(
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Get available rewards"""
    user_id = current_user.get("user_id")
    rewards_data = service.get_available_rewards(user_id)
    
    result = []
    for data in rewards_data:
        reward = data["reward"]
        remaining = None
        if reward.quantity_available is not None:
            remaining = reward.quantity_available - reward.quantity_redeemed
        
        result.append(RewardResponse(
            id=str(reward.id),
            code=reward.code,
            name=reward.name,
            description=reward.description,
            image_url=reward.image_url,
            points_cost=reward.points_cost,
            reward_type=reward.reward_type,
            quantity_available=reward.quantity_available,
            quantity_remaining=remaining,
            min_level=reward.min_level,
            available=data["available"],
            can_afford=data["can_afford"],
            can_redeem=data["can_redeem"]
        ))
    
    return result


@router.post("/rewards", response_model=RewardResponse)
async def create_reward(
    request: CreateRewardRequest,
    service: GamificationService = Depends(get_gamification_service),
    db: Session = Depends(get_db)
):
    """Create a new reward (admin only)"""
    existing = db.query(Reward).filter(
        Reward.tenant_id == service.tenant_id,
        Reward.code == request.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Reward code already exists")
    
    reward = Reward(
        tenant_id=service.tenant_id,
        code=request.code,
        name=request.name,
        description=request.description,
        image_url=request.image_url,
        points_cost=request.points_cost,
        reward_type=request.reward_type,
        quantity_available=request.quantity_available,
        min_level=request.min_level
    )
    
    db.add(reward)
    db.commit()
    db.refresh(reward)
    
    return RewardResponse(
        id=str(reward.id),
        code=reward.code,
        name=reward.name,
        description=reward.description,
        image_url=reward.image_url,
        points_cost=reward.points_cost,
        reward_type=reward.reward_type,
        quantity_available=reward.quantity_available,
        quantity_remaining=reward.quantity_available,
        min_level=reward.min_level,
        available=True,
        can_afford=False,
        can_redeem=False
    )


@router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(
    reward_id: str,
    service: GamificationService = Depends(get_gamification_service),
    current_user: dict = Depends(get_current_user)
):
    """Redeem a reward"""
    user_id = current_user.get("user_id")
    redemption = service.redeem_reward(user_id, reward_id)
    
    if not redemption:
        raise HTTPException(status_code=400, detail="Unable to redeem reward")
    
    return {
        "message": "Reward redeemed successfully",
        "redemption_id": str(redemption.id),
        "status": redemption.status
    }


# ==================== Settings Endpoints ====================

@router.get("/settings")
async def get_settings(
    service: GamificationService = Depends(get_gamification_service)
):
    """Get gamification settings"""
    settings = service.settings
    return {
        "is_enabled": settings.is_enabled,
        "achievements_enabled": settings.achievements_enabled,
        "challenges_enabled": settings.challenges_enabled,
        "leaderboards_enabled": settings.leaderboards_enabled,
        "points_enabled": settings.points_enabled,
        "streaks_enabled": settings.streaks_enabled,
        "points_per_sale": float(settings.points_per_sale),
        "points_per_item": settings.points_per_item,
        "points_for_new_customer": settings.points_for_new_customer,
        "streak_bonus_multiplier": float(settings.streak_bonus_multiplier),
        "base_xp_per_level": settings.base_xp_per_level,
        "xp_growth_rate": float(settings.xp_growth_rate),
        "streak_grace_hours": settings.streak_grace_hours,
        "max_streak_multiplier": float(settings.max_streak_multiplier),
        "notify_on_achievement": settings.notify_on_achievement,
        "notify_on_level_up": settings.notify_on_level_up,
        "notify_on_leaderboard_change": settings.notify_on_leaderboard_change
    }


@router.patch("/settings")
async def update_settings(
    request: GamificationSettingsUpdate,
    service: GamificationService = Depends(get_gamification_service),
    db: Session = Depends(get_db)
):
    """Update gamification settings (admin only)"""
    settings = service.settings
    
    update_data = request.dict(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    
    db.commit()
    db.refresh(settings)
    
    return {"message": "Settings updated successfully"}


# ==================== Admin Endpoints ====================

@router.post("/seed/achievements")
async def seed_achievements(
    service: GamificationService = Depends(get_gamification_service)
):
    """Seed default achievements (admin only)"""
    service.seed_default_achievements()
    return {"message": "Default achievements seeded"}


@router.post("/seed/leaderboards")
async def seed_leaderboards(
    service: GamificationService = Depends(get_gamification_service)
):
    """Seed default leaderboards (admin only)"""
    service.seed_default_leaderboards()
    return {"message": "Default leaderboards seeded"}


@router.post("/seed/all")
async def seed_all(
    service: GamificationService = Depends(get_gamification_service)
):
    """Seed all default gamification data (admin only)"""
    service.seed_default_achievements()
    service.seed_default_leaderboards()
    return {"message": "All default gamification data seeded"}
