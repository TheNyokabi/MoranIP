"""
Gamification Service

Handles all gamification logic including:
- Points calculation and awarding
- Achievement tracking and unlocking
- Challenge management
- Leaderboard calculations
- Streak tracking
- Level progression
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from uuid import UUID

from sqlalchemy import func, desc, and_, or_
from sqlalchemy.orm import Session

from ..models.gamification import (
    Achievement, UserAchievement, Challenge, ChallengeParticipant,
    Leaderboard, LeaderboardEntry, UserPoints, PointsTransaction,
    GamificationSettings, Reward, RewardRedemption
)
from ..models.iam import User

logger = logging.getLogger(__name__)


# Level XP requirements (can be configured per tenant)
DEFAULT_LEVEL_XP = {
    1: 0,
    2: 100,
    3: 250,
    4: 450,
    5: 700,
    6: 1000,
    7: 1400,
    8: 1900,
    9: 2500,
    10: 3200,
}


class GamificationService:
    """Main service for gamification features"""
    
    def __init__(self, db: Session, tenant_id: str, current_user_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.current_user_id = current_user_id
        self._settings: Optional[GamificationSettings] = None
    
    @property
    def settings(self) -> GamificationSettings:
        """Get or create tenant gamification settings"""
        if self._settings is None:
            self._settings = self.db.query(GamificationSettings).filter(
                GamificationSettings.tenant_id == self.tenant_id
            ).first()
            
            if not self._settings:
                # Create default settings
                self._settings = GamificationSettings(tenant_id=self.tenant_id)
                self.db.add(self._settings)
                self.db.commit()
                self.db.refresh(self._settings)
        
        return self._settings
    
    # ==================== Points Management ====================
    
    def get_user_points(self, user_id: str) -> UserPoints:
        """Get or create user points record"""
        points = self.db.query(UserPoints).filter(
            UserPoints.user_id == user_id,
            UserPoints.tenant_id == self.tenant_id
        ).first()
        
        if not points:
            points = UserPoints(
                user_id=user_id,
                tenant_id=self.tenant_id,
                experience_to_next_level=self._get_xp_for_level(2)
            )
            self.db.add(points)
            self.db.commit()
            self.db.refresh(points)
        
        return points
    
    def award_points(
        self,
        user_id: str,
        points: int,
        source: str,
        description: str,
        source_id: Optional[str] = None,
        source_type: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> PointsTransaction:
        """Award points to a user"""
        if not self.settings.is_enabled or not self.settings.points_enabled:
            return None
        
        user_points = self.get_user_points(user_id)
        
        # Apply streak bonus if applicable
        if self.settings.streaks_enabled and user_points.current_streak > 0:
            streak_multiplier = min(
                1 + (user_points.current_streak * 0.05),  # 5% per streak day
                float(self.settings.max_streak_multiplier)
            )
            points = int(points * streak_multiplier)
        
        # Create transaction
        transaction = PointsTransaction(
            user_id=user_id,
            tenant_id=self.tenant_id,
            transaction_type="earn",
            points=points,
            source=source,
            source_id=source_id,
            source_type=source_type,
            description=description,
            balance_before=user_points.available_points,
            balance_after=user_points.available_points + points,
            metadata=metadata,
            created_by=self.current_user_id
        )
        self.db.add(transaction)
        
        # Update user points
        user_points.available_points += points
        user_points.total_points_earned += points
        
        # Add experience
        self._add_experience(user_points, points)
        
        self.db.commit()
        self.db.refresh(transaction)
        
        logger.info(f"Awarded {points} points to user {user_id} for {source}")
        return transaction
    
    def deduct_points(
        self,
        user_id: str,
        points: int,
        source: str,
        description: str,
        source_id: Optional[str] = None
    ) -> Optional[PointsTransaction]:
        """Deduct points from a user (for redemptions)"""
        user_points = self.get_user_points(user_id)
        
        if user_points.available_points < points:
            return None  # Insufficient points
        
        transaction = PointsTransaction(
            user_id=user_id,
            tenant_id=self.tenant_id,
            transaction_type="redeem",
            points=-points,
            source=source,
            source_id=source_id,
            description=description,
            balance_before=user_points.available_points,
            balance_after=user_points.available_points - points,
            created_by=self.current_user_id
        )
        self.db.add(transaction)
        
        user_points.available_points -= points
        user_points.total_points_spent += points
        
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction
    
    def _add_experience(self, user_points: UserPoints, xp: int):
        """Add experience and handle level ups"""
        user_points.experience += xp
        
        # Check for level up
        while user_points.experience >= user_points.experience_to_next_level:
            user_points.experience -= user_points.experience_to_next_level
            user_points.level += 1
            user_points.experience_to_next_level = self._get_xp_for_level(user_points.level + 1)
            
            logger.info(f"User {user_points.user_id} leveled up to {user_points.level}")
    
    def _get_xp_for_level(self, level: int) -> int:
        """Calculate XP needed for a level"""
        if level in DEFAULT_LEVEL_XP:
            return DEFAULT_LEVEL_XP[level]
        
        # Formula for higher levels
        base = int(self.settings.base_xp_per_level)
        growth = float(self.settings.xp_growth_rate)
        return int(base * (growth ** (level - 1)))
    
    # ==================== Achievement Management ====================
    
    def get_achievements(self, include_hidden: bool = False) -> List[Achievement]:
        """Get all achievements for tenant"""
        query = self.db.query(Achievement).filter(
            Achievement.tenant_id == self.tenant_id,
            Achievement.is_active == True
        )
        
        if not include_hidden:
            query = query.filter(Achievement.is_hidden == False)
        
        return query.order_by(Achievement.display_order, Achievement.name).all()
    
    def get_user_achievements(self, user_id: str) -> List[Dict]:
        """Get user's achievement progress"""
        achievements = self.get_achievements(include_hidden=False)
        user_achievements = self.db.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.tenant_id == self.tenant_id
        ).all()
        
        ua_map = {str(ua.achievement_id): ua for ua in user_achievements}
        
        result = []
        for achievement in achievements:
            ua = ua_map.get(str(achievement.id))
            result.append({
                "achievement": achievement,
                "progress_current": ua.progress_current if ua else 0,
                "progress_target": ua.progress_target if ua else achievement.criteria_config.get("threshold", 1) if achievement.criteria_config else 1,
                "progress_percentage": float(ua.progress_percentage) if ua else 0,
                "is_earned": ua.is_earned if ua else False,
                "earned_at": ua.earned_at if ua else None,
                "is_claimed": ua.is_claimed if ua else False
            })
        
        return result
    
    def check_achievements(self, user_id: str, trigger: str, data: Dict) -> List[Achievement]:
        """Check and award any earned achievements"""
        if not self.settings.is_enabled or not self.settings.achievements_enabled:
            return []
        
        unlocked = []
        achievements = self.get_achievements(include_hidden=True)
        
        for achievement in achievements:
            if self._check_achievement_criteria(user_id, achievement, trigger, data):
                if self._unlock_achievement(user_id, achievement):
                    unlocked.append(achievement)
        
        return unlocked
    
    def _check_achievement_criteria(
        self, user_id: str, achievement: Achievement, trigger: str, data: Dict
    ) -> bool:
        """Check if user meets achievement criteria"""
        config = achievement.criteria_config or {}
        
        # Check if already earned
        existing = self.db.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement.id,
            UserAchievement.is_earned == True
        ).first()
        
        if existing:
            return False
        
        criteria_type = achievement.criteria_type
        
        if criteria_type == "count":
            metric = config.get("metric")
            threshold = config.get("threshold", 1)
            current = self._get_metric_value(user_id, metric)
            return current >= threshold
        
        elif criteria_type == "streak":
            streak_days = config.get("streak_days", 1)
            user_points = self.get_user_points(user_id)
            return user_points.current_streak >= streak_days
        
        elif criteria_type == "milestone":
            milestone = config.get("milestone")
            value = config.get("value")
            current = self._get_metric_value(user_id, milestone)
            return current >= value
        
        elif criteria_type == "first":
            # First time doing something
            metric = config.get("metric")
            return self._is_first_occurrence(user_id, metric, data)
        
        return False
    
    def _get_metric_value(self, user_id: str, metric: str) -> Decimal:
        """Get current value of a metric for a user"""
        # This would query relevant tables based on metric
        # For now, return from points transactions as proxy
        
        if metric == "total_sales":
            result = self.db.query(func.sum(PointsTransaction.points)).filter(
                PointsTransaction.user_id == user_id,
                PointsTransaction.tenant_id == self.tenant_id,
                PointsTransaction.source == "sale"
            ).scalar()
            return Decimal(result or 0)
        
        elif metric == "sales_count":
            result = self.db.query(func.count(PointsTransaction.id)).filter(
                PointsTransaction.user_id == user_id,
                PointsTransaction.tenant_id == self.tenant_id,
                PointsTransaction.source == "sale"
            ).scalar()
            return Decimal(result or 0)
        
        elif metric == "total_points":
            user_points = self.get_user_points(user_id)
            return Decimal(user_points.total_points_earned)
        
        elif metric == "level":
            user_points = self.get_user_points(user_id)
            return Decimal(user_points.level)
        
        elif metric == "achievements_count":
            result = self.db.query(func.count(UserAchievement.id)).filter(
                UserAchievement.user_id == user_id,
                UserAchievement.tenant_id == self.tenant_id,
                UserAchievement.is_earned == True
            ).scalar()
            return Decimal(result or 0)
        
        return Decimal(0)
    
    def _is_first_occurrence(self, user_id: str, metric: str, data: Dict) -> bool:
        """Check if this is the first occurrence of something"""
        if metric == "sale":
            count = self.db.query(func.count(PointsTransaction.id)).filter(
                PointsTransaction.user_id == user_id,
                PointsTransaction.tenant_id == self.tenant_id,
                PointsTransaction.source == "sale"
            ).scalar()
            return count == 1  # This is the first one
        
        return False
    
    def _unlock_achievement(self, user_id: str, achievement: Achievement) -> bool:
        """Unlock an achievement for a user"""
        # Check if already exists
        existing = self.db.query(UserAchievement).filter(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement.id
        ).first()
        
        if existing and existing.is_earned:
            return False
        
        if existing:
            existing.is_earned = True
            existing.earned_at = datetime.utcnow()
            existing.progress_current = existing.progress_target
            existing.progress_percentage = 100
        else:
            target = 1
            if achievement.criteria_config:
                target = achievement.criteria_config.get("threshold", 1)
            
            existing = UserAchievement(
                user_id=user_id,
                achievement_id=achievement.id,
                tenant_id=self.tenant_id,
                progress_current=target,
                progress_target=target,
                progress_percentage=100,
                is_earned=True,
                earned_at=datetime.utcnow()
            )
            self.db.add(existing)
        
        # Award points
        if achievement.points_reward > 0:
            self.award_points(
                user_id=user_id,
                points=achievement.points_reward,
                source="achievement",
                description=f"Unlocked achievement: {achievement.name}",
                source_id=str(achievement.id),
                source_type="Achievement"
            )
        
        # Update user stats
        user_points = self.get_user_points(user_id)
        user_points.achievements_earned += 1
        
        self.db.commit()
        logger.info(f"User {user_id} unlocked achievement: {achievement.name}")
        
        return True
    
    # ==================== Streak Management ====================
    
    def update_streak(self, user_id: str) -> int:
        """Update user's daily streak"""
        if not self.settings.is_enabled or not self.settings.streaks_enabled:
            return 0
        
        user_points = self.get_user_points(user_id)
        now = datetime.utcnow()
        
        if user_points.streak_last_updated:
            hours_since_update = (now - user_points.streak_last_updated).total_seconds() / 3600
            
            if hours_since_update < 24:
                # Already updated today
                return user_points.current_streak
            elif hours_since_update < 24 + self.settings.streak_grace_hours:
                # Within grace period, increment streak
                user_points.current_streak += 1
            else:
                # Streak broken
                user_points.current_streak = 1
        else:
            # First activity
            user_points.current_streak = 1
        
        user_points.streak_last_updated = now
        
        if user_points.current_streak > user_points.longest_streak:
            user_points.longest_streak = user_points.current_streak
        
        self.db.commit()
        
        # Check for streak achievements
        self.check_achievements(user_id, "streak", {"streak": user_points.current_streak})
        
        return user_points.current_streak
    
    # ==================== Challenge Management ====================
    
    def get_active_challenges(self) -> List[Challenge]:
        """Get active challenges for tenant"""
        if not self.settings.is_enabled or not self.settings.challenges_enabled:
            return []
        
        now = datetime.utcnow()
        return self.db.query(Challenge).filter(
            Challenge.tenant_id == self.tenant_id,
            Challenge.status == "active",
            Challenge.start_date <= now,
            Challenge.end_date >= now
        ).all()
    
    def get_user_challenges(self, user_id: str) -> List[Dict]:
        """Get challenges user is participating in"""
        participations = self.db.query(ChallengeParticipant).filter(
            ChallengeParticipant.user_id == user_id,
            ChallengeParticipant.tenant_id == self.tenant_id
        ).all()
        
        result = []
        for p in participations:
            challenge = self.db.query(Challenge).filter(
                Challenge.id == p.challenge_id
            ).first()
            
            if challenge:
                result.append({
                    "challenge": challenge,
                    "current_value": float(p.current_value),
                    "progress_percentage": float(p.progress_percentage),
                    "is_completed": p.is_completed,
                    "joined_at": p.joined_at
                })
        
        return result
    
    def join_challenge(self, user_id: str, challenge_id: str) -> Optional[ChallengeParticipant]:
        """Join a challenge"""
        challenge = self.db.query(Challenge).filter(
            Challenge.id == challenge_id,
            Challenge.tenant_id == self.tenant_id
        ).first()
        
        if not challenge or challenge.status != "active":
            return None
        
        # Check if already joined
        existing = self.db.query(ChallengeParticipant).filter(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user_id
        ).first()
        
        if existing:
            return existing
        
        # Check max participants
        if challenge.max_participants:
            current_count = self.db.query(func.count(ChallengeParticipant.id)).filter(
                ChallengeParticipant.challenge_id == challenge_id
            ).scalar()
            
            if current_count >= challenge.max_participants:
                return None
        
        participant = ChallengeParticipant(
            challenge_id=challenge_id,
            user_id=user_id,
            tenant_id=self.tenant_id
        )
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        
        return participant
    
    def update_challenge_progress(
        self, user_id: str, metric: str, value: Decimal
    ) -> List[Tuple[Challenge, bool]]:
        """Update progress for all relevant challenges"""
        if not self.settings.is_enabled or not self.settings.challenges_enabled:
            return []
        
        # Find challenges with this metric that user is participating in
        participations = self.db.query(ChallengeParticipant).join(Challenge).filter(
            ChallengeParticipant.user_id == user_id,
            ChallengeParticipant.tenant_id == self.tenant_id,
            Challenge.metric == metric,
            Challenge.status == "active",
            ChallengeParticipant.is_completed == False
        ).all()
        
        results = []
        for p in participations:
            challenge = self.db.query(Challenge).filter(
                Challenge.id == p.challenge_id
            ).first()
            
            p.current_value = Decimal(p.current_value or 0) + value
            p.progress_percentage = min(
                (p.current_value / challenge.target_value) * 100,
                Decimal(100)
            )
            
            completed = False
            if p.current_value >= challenge.target_value and not p.is_completed:
                p.is_completed = True
                p.completed_at = datetime.utcnow()
                completed = True
                
                # Award points
                if challenge.points_reward > 0:
                    self.award_points(
                        user_id=user_id,
                        points=challenge.points_reward,
                        source="challenge",
                        description=f"Completed challenge: {challenge.name}",
                        source_id=str(challenge.id),
                        source_type="Challenge"
                    )
                
                # Update user stats
                user_points = self.get_user_points(user_id)
                user_points.challenges_completed += 1
            
            results.append((challenge, completed))
        
        self.db.commit()
        return results
    
    # ==================== Leaderboard Management ====================
    
    def get_leaderboards(self) -> List[Leaderboard]:
        """Get all visible leaderboards"""
        if not self.settings.is_enabled or not self.settings.leaderboards_enabled:
            return []
        
        return self.db.query(Leaderboard).filter(
            Leaderboard.tenant_id == self.tenant_id,
            Leaderboard.is_visible == True
        ).all()
    
    def get_leaderboard_rankings(
        self, leaderboard_id: str, limit: Optional[int] = None
    ) -> List[Dict]:
        """Get current rankings for a leaderboard"""
        leaderboard = self.db.query(Leaderboard).filter(
            Leaderboard.id == leaderboard_id
        ).first()
        
        if not leaderboard:
            return []
        
        limit = limit or leaderboard.max_entries
        
        # Calculate based on metric
        if leaderboard.metric == "points":
            query = self.db.query(
                UserPoints.user_id,
                UserPoints.total_points_earned.label("score"),
                User.full_name
            ).join(User, User.id == UserPoints.user_id).filter(
                UserPoints.tenant_id == self.tenant_id
            ).order_by(desc(UserPoints.total_points_earned)).limit(limit)
        
        elif leaderboard.metric == "level":
            query = self.db.query(
                UserPoints.user_id,
                UserPoints.level.label("score"),
                User.full_name
            ).join(User, User.id == UserPoints.user_id).filter(
                UserPoints.tenant_id == self.tenant_id
            ).order_by(desc(UserPoints.level), desc(UserPoints.experience)).limit(limit)
        
        elif leaderboard.metric == "achievements":
            query = self.db.query(
                UserPoints.user_id,
                UserPoints.achievements_earned.label("score"),
                User.full_name
            ).join(User, User.id == UserPoints.user_id).filter(
                UserPoints.tenant_id == self.tenant_id
            ).order_by(desc(UserPoints.achievements_earned)).limit(limit)
        
        else:
            # Default to points
            query = self.db.query(
                UserPoints.user_id,
                UserPoints.total_points_earned.label("score"),
                User.full_name
            ).join(User, User.id == UserPoints.user_id).filter(
                UserPoints.tenant_id == self.tenant_id
            ).order_by(desc(UserPoints.total_points_earned)).limit(limit)
        
        results = query.all()
        
        rankings = []
        for rank, (user_id, score, name) in enumerate(results, 1):
            rankings.append({
                "rank": rank,
                "user_id": str(user_id),
                "user_name": name or "Unknown",
                "score": float(score) if score else 0,
                "rank_change": 0  # TODO: Calculate from previous period
            })
        
        return rankings
    
    def get_user_rank(self, user_id: str, leaderboard_id: str) -> Optional[Dict]:
        """Get user's rank in a leaderboard"""
        rankings = self.get_leaderboard_rankings(leaderboard_id, limit=None)
        
        for entry in rankings:
            if entry["user_id"] == str(user_id):
                return entry
        
        return None
    
    # ==================== Reward Management ====================
    
    def get_available_rewards(self, user_id: str) -> List[Dict]:
        """Get rewards available to user"""
        user_points = self.get_user_points(user_id)
        now = datetime.utcnow()
        
        rewards = self.db.query(Reward).filter(
            Reward.tenant_id == self.tenant_id,
            Reward.is_active == True,
            or_(Reward.valid_from == None, Reward.valid_from <= now),
            or_(Reward.valid_until == None, Reward.valid_until >= now),
            Reward.min_level <= user_points.level
        ).order_by(Reward.display_order, Reward.points_cost).all()
        
        result = []
        for reward in rewards:
            # Check quantity
            available = True
            if reward.quantity_available is not None:
                remaining = reward.quantity_available - reward.quantity_redeemed
                available = remaining > 0
            
            # Check if user has required achievement
            has_required_achievement = True
            if reward.required_achievement_id:
                ua = self.db.query(UserAchievement).filter(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == reward.required_achievement_id,
                    UserAchievement.is_earned == True
                ).first()
                has_required_achievement = ua is not None
            
            can_afford = user_points.available_points >= reward.points_cost
            
            result.append({
                "reward": reward,
                "available": available,
                "can_afford": can_afford,
                "has_required_achievement": has_required_achievement,
                "can_redeem": available and can_afford and has_required_achievement
            })
        
        return result
    
    def redeem_reward(self, user_id: str, reward_id: str) -> Optional[RewardRedemption]:
        """Redeem a reward"""
        reward = self.db.query(Reward).filter(
            Reward.id == reward_id,
            Reward.tenant_id == self.tenant_id,
            Reward.is_active == True
        ).first()
        
        if not reward:
            return None
        
        user_points = self.get_user_points(user_id)
        
        # Validate
        if user_points.available_points < reward.points_cost:
            return None
        
        if user_points.level < reward.min_level:
            return None
        
        if reward.quantity_available is not None:
            remaining = reward.quantity_available - reward.quantity_redeemed
            if remaining <= 0:
                return None
        
        # Deduct points
        transaction = self.deduct_points(
            user_id=user_id,
            points=reward.points_cost,
            source="reward",
            description=f"Redeemed reward: {reward.name}",
            source_id=str(reward.id)
        )
        
        if not transaction:
            return None
        
        # Create redemption
        redemption = RewardRedemption(
            reward_id=reward_id,
            user_id=user_id,
            tenant_id=self.tenant_id,
            points_transaction_id=transaction.id,
            points_spent=reward.points_cost,
            status="pending"
        )
        self.db.add(redemption)
        
        # Update reward quantity
        reward.quantity_redeemed += 1
        
        self.db.commit()
        self.db.refresh(redemption)
        
        return redemption
    
    # ==================== Event Handlers ====================
    
    def on_sale_completed(self, user_id: str, sale_data: Dict):
        """Process gamification when a sale is completed"""
        if not self.settings.is_enabled:
            return
        
        # Calculate points based on sale value
        sale_total = Decimal(str(sale_data.get("total", 0)))
        items_count = sale_data.get("items_count", 0)
        
        # Base points from sale value
        points_from_value = int(sale_total * self.settings.points_per_sale)
        
        # Bonus points from items
        points_from_items = items_count * self.settings.points_per_item
        
        total_points = points_from_value + points_from_items
        
        if total_points > 0:
            self.award_points(
                user_id=user_id,
                points=total_points,
                source="sale",
                description=f"Sale completed: {sale_data.get('invoice_number', 'N/A')}",
                source_id=sale_data.get("invoice_id"),
                source_type="POS Invoice",
                metadata={
                    "sale_total": float(sale_total),
                    "items_count": items_count,
                    "points_from_value": points_from_value,
                    "points_from_items": points_from_items
                }
            )
        
        # Update streak
        self.update_streak(user_id)
        
        # Check achievements
        self.check_achievements(user_id, "sale", sale_data)
        
        # Update challenge progress
        self.update_challenge_progress(user_id, "total_sales", sale_total)
        self.update_challenge_progress(user_id, "items_sold", Decimal(items_count))
    
    def on_new_customer(self, user_id: str, customer_data: Dict):
        """Process gamification when a new customer is added"""
        if not self.settings.is_enabled:
            return
        
        if self.settings.points_for_new_customer > 0:
            self.award_points(
                user_id=user_id,
                points=self.settings.points_for_new_customer,
                source="new_customer",
                description=f"Added new customer: {customer_data.get('customer_name', 'N/A')}",
                source_id=customer_data.get("customer_id"),
                source_type="Customer"
            )
        
        # Update challenge progress
        self.update_challenge_progress(user_id, "new_customers", Decimal(1))
    
    # ==================== Profile & Stats ====================
    
    def get_user_profile(self, user_id: str) -> Dict:
        """Get complete gamification profile for a user"""
        user_points = self.get_user_points(user_id)
        
        return {
            "points": {
                "available": user_points.available_points,
                "total_earned": user_points.total_points_earned,
                "total_spent": user_points.total_points_spent
            },
            "level": {
                "current": user_points.level,
                "experience": user_points.experience,
                "experience_to_next": user_points.experience_to_next_level,
                "progress_percentage": round(
                    (user_points.experience / user_points.experience_to_next_level) * 100, 1
                ) if user_points.experience_to_next_level > 0 else 100
            },
            "streak": {
                "current": user_points.current_streak,
                "longest": user_points.longest_streak
            },
            "stats": {
                "achievements_earned": user_points.achievements_earned,
                "challenges_completed": user_points.challenges_completed,
                "challenges_won": user_points.challenges_won
            }
        }
    
    # ==================== Seed Data ====================
    
    def seed_default_achievements(self):
        """Create default achievements for a tenant"""
        defaults = [
            {
                "code": "first_sale",
                "name": "First Sale!",
                "description": "Complete your first sale",
                "icon": "🎉",
                "category": "sales",
                "criteria_type": "first",
                "criteria_config": {"metric": "sale"},
                "points_reward": 100,
                "badge_tier": "bronze"
            },
            {
                "code": "sales_10",
                "name": "Getting Started",
                "description": "Complete 10 sales",
                "icon": "⭐",
                "category": "sales",
                "criteria_type": "count",
                "criteria_config": {"metric": "sales_count", "threshold": 10},
                "points_reward": 200,
                "badge_tier": "bronze"
            },
            {
                "code": "sales_50",
                "name": "Sales Pro",
                "description": "Complete 50 sales",
                "icon": "🌟",
                "category": "sales",
                "criteria_type": "count",
                "criteria_config": {"metric": "sales_count", "threshold": 50},
                "points_reward": 500,
                "badge_tier": "silver"
            },
            {
                "code": "sales_100",
                "name": "Sales Champion",
                "description": "Complete 100 sales",
                "icon": "🏆",
                "category": "sales",
                "criteria_type": "count",
                "criteria_config": {"metric": "sales_count", "threshold": 100},
                "points_reward": 1000,
                "badge_tier": "gold"
            },
            {
                "code": "streak_7",
                "name": "Week Warrior",
                "description": "Maintain a 7-day activity streak",
                "icon": "🔥",
                "category": "attendance",
                "criteria_type": "streak",
                "criteria_config": {"streak_days": 7},
                "points_reward": 300,
                "badge_tier": "bronze"
            },
            {
                "code": "streak_30",
                "name": "Monthly Master",
                "description": "Maintain a 30-day activity streak",
                "icon": "💪",
                "category": "attendance",
                "criteria_type": "streak",
                "criteria_config": {"streak_days": 30},
                "points_reward": 1000,
                "badge_tier": "gold"
            },
            {
                "code": "level_5",
                "name": "Rising Star",
                "description": "Reach level 5",
                "icon": "📈",
                "category": "general",
                "criteria_type": "milestone",
                "criteria_config": {"milestone": "level", "value": 5},
                "points_reward": 500,
                "badge_tier": "silver"
            },
            {
                "code": "level_10",
                "name": "Veteran",
                "description": "Reach level 10",
                "icon": "👑",
                "category": "general",
                "criteria_type": "milestone",
                "criteria_config": {"milestone": "level", "value": 10},
                "points_reward": 2000,
                "badge_tier": "platinum"
            }
        ]
        
        for data in defaults:
            existing = self.db.query(Achievement).filter(
                Achievement.tenant_id == self.tenant_id,
                Achievement.code == data["code"]
            ).first()
            
            if not existing:
                achievement = Achievement(
                    tenant_id=self.tenant_id,
                    **data
                )
                self.db.add(achievement)
        
        self.db.commit()
    
    def seed_default_leaderboards(self):
        """Create default leaderboards for a tenant"""
        defaults = [
            {
                "code": "monthly_points",
                "name": "Top Earners This Month",
                "description": "Users with most points this month",
                "metric": "points",
                "period": "monthly",
                "max_entries": 10
            },
            {
                "code": "all_time_points",
                "name": "All-Time Leaders",
                "description": "Users with most total points",
                "metric": "points",
                "period": "all_time",
                "max_entries": 10
            },
            {
                "code": "top_levels",
                "name": "Highest Levels",
                "description": "Users at the highest levels",
                "metric": "level",
                "period": "all_time",
                "max_entries": 10
            },
            {
                "code": "achievement_hunters",
                "name": "Achievement Hunters",
                "description": "Users with most achievements",
                "metric": "achievements",
                "period": "all_time",
                "max_entries": 10
            }
        ]
        
        for data in defaults:
            existing = self.db.query(Leaderboard).filter(
                Leaderboard.tenant_id == self.tenant_id,
                Leaderboard.code == data["code"]
            ).first()
            
            if not existing:
                leaderboard = Leaderboard(
                    tenant_id=self.tenant_id,
                    **data
                )
                self.db.add(leaderboard)
        
        self.db.commit()
