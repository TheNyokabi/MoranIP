"""
Loyalty Program Service for PoS
Manages customer points, rewards, and loyalty tiers
"""
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, List
from decimal import Decimal, ROUND_DOWN
import logging
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment_reference import PaymentReference

logger = logging.getLogger(__name__)


class LoyaltyService:
    """Service for managing customer loyalty programs"""

    def __init__(self, erpnext_adapter=None, tenant_id: str = None):
        """Initialize loyalty service"""
        self.erpnext_adapter = erpnext_adapter
        self.tenant_id = tenant_id

        # Default loyalty configuration
        self.config = {
            "points_per_shilling": 1,  # 1 point per KES spent
            "redemption_rate": 100,    # 100 points = KES 1
            "tiers": {
                "bronze": {"min_points": 0, "multiplier": 1.0, "benefits": ["Basic rewards"]},
                "silver": {"min_points": 1000, "multiplier": 1.2, "benefits": ["5% discount", "Birthday rewards"]},
                "gold": {"min_points": 5000, "multiplier": 1.5, "benefits": ["10% discount", "VIP treatment", "Free delivery"]}
            },
            "birthday_bonus": 500,  # Points for birthday
            "referral_bonus": 200,  # Points for successful referral
            "points_expiry_months": 24  # Points expire after 2 years
        }

    async def calculate_points(self, purchase_amount: Decimal, customer: str, is_birthday: bool = False) -> Dict[str, Any]:
        """
        Calculate loyalty points for a purchase

        Args:
            purchase_amount: Purchase amount
            customer: Customer identifier
            is_birthday: Whether it's customer's birthday

        Returns:
            Points calculation details
        """
        try:
            base_points = int(purchase_amount * self.config["points_per_shilling"])

            # Apply tier multiplier
            customer_tier = await self.get_customer_tier(customer)
            multiplier = self.config["tiers"][customer_tier]["multiplier"]
            total_points = int(base_points * multiplier)

            # Add birthday bonus
            birthday_points = self.config["birthday_bonus"] if is_birthday else 0

            result = {
                "base_points": base_points,
                "tier_multiplier": multiplier,
                "tier_points": total_points,
                "birthday_points": birthday_points,
                "total_points": total_points + birthday_points,
                "purchase_amount": float(purchase_amount),
                "customer_tier": customer_tier,
                "redemption_value": float(total_points / self.config["redemption_rate"])
            }

            return result

        except Exception as e:
            logger.error(f"Failed to calculate points for customer {customer}: {e}")
            return {
                "base_points": 0,
                "tier_multiplier": 1.0,
                "tier_points": 0,
                "birthday_points": 0,
                "total_points": 0,
                "purchase_amount": float(purchase_amount),
                "customer_tier": "bronze",
                "redemption_value": 0.0,
                "error": str(e)
            }

    async def calculate_points_earned(self, purchase_amount: float, customer: str, is_birthday: bool = False) -> Dict[str, Any]:
        """Compatibility wrapper for router: calculate points from raw float input."""
        amount = Decimal(str(purchase_amount))
        return await self.calculate_points(amount, customer, is_birthday)

    async def check_birthday_month(self, customer: str) -> bool:
        """Return True if current month matches customer DOB month, else False."""
        if not self.erpnext_adapter:
            return False
        try:
            customer_data = await self.erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=f"resource/Customer/{customer}",
                method="GET"
            )
            customer_doc = customer_data.get("data") if isinstance(customer_data, dict) else customer_data
            if not isinstance(customer_doc, dict):
                return False
            birthday = customer_doc.get("date_of_birth") or customer_doc.get("birthday")
            if not birthday:
                return False
            try:
                dob = datetime.fromisoformat(str(birthday).replace('Z', '+00:00'))
            except ValueError:
                return False
            now = datetime.now()
            return dob.month == now.month
        except Exception as e:
            logger.warning(f"Birthday check failed for customer {customer}: {e}")
            return False

    async def award_points(self, customer: str, points: int, reason: str, invoice_id: str = None) -> bool:
        """
        Award points to customer

        Args:
            customer: Customer identifier
            points: Number of points to award
            reason: Reason for awarding points
            invoice_id: Associated invoice ID

        Returns:
            Success status
        """
        try:
            # In a real implementation, this would update a customer loyalty record
            # For now, we'll store in ERPNext as a custom field or separate doctype

            points_data = {
                "customer": customer,
                "points": points,
                "reason": reason,
                "invoice_id": invoice_id,
                "awarded_date": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(days=self.config["points_expiry_months"] * 30)).isoformat()
            }

            # Store in ERPNext (this would be a custom doctype or customer field)
            if self.erpnext_adapter:
                await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LoyaltyPoints",
                    method="POST",
                    json_data=points_data
                )

            logger.info(f"Awarded {points} points to customer {customer} for: {reason}")
            return True

        except Exception as e:
            logger.error(f"Failed to award points to customer {customer}: {e}")
            return False

    async def redeem_points(self, customer: str, points_to_redeem: int, invoice_id: str = None) -> Dict[str, Any]:
        """
        Redeem customer points for discount

        Args:
            customer: Customer identifier
            points_to_redeem: Points to redeem
            invoice_id: Associated invoice ID

        Returns:
            Redemption details
        """
        try:
            # Check customer's available points
            available_points = await self.get_customer_points(customer)

            if available_points < points_to_redeem:
                return {
                    "success": False,
                    "error": "Insufficient points",
                    "available_points": available_points,
                    "requested_points": points_to_redeem
                }

            # Calculate redemption value
            redemption_value = Decimal(points_to_redeem) / self.config["redemption_rate"]

            # Process redemption
            redemption_data = {
                "customer": customer,
                "points_redeemed": points_to_redeem,
                "redemption_value": float(redemption_value),
                "invoice_id": invoice_id,
                "redemption_date": datetime.now().isoformat()
            }

            # Store redemption record
            if self.erpnext_adapter:
                await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LoyaltyRedemption",
                    method="POST",
                    json_data=redemption_data
                )

            return {
                "success": True,
                "points_redeemed": points_to_redeem,
                "redemption_value": float(redemption_value),
                "remaining_points": available_points - points_to_redeem
            }

        except Exception as e:
            logger.error(f"Failed to redeem points for customer {customer}: {e}")
            return {
                "success": False,
                "error": str(e),
                "points_redeemed": 0,
                "redemption_value": 0.0
            }

    async def get_customer_points(self, customer: str) -> int:
        """
        Get customer's current points balance

        Args:
            customer: Customer identifier

        Returns:
            Current points balance
        """
        try:
            # In a real implementation, this would query the loyalty database
            # For now, return a mock value based on customer
            if self.erpnext_adapter:
                # Query customer's points from ERPNext
                points_data = await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LoyaltyPoints",
                    method="GET",
                    params={
                        "filters": json.dumps([["customer", "=", customer]]),
                        "fields": '["points", "expires_at"]'
                    }
                )

                total_points = 0
                now = datetime.now()

                if points_data and points_data.get("data"):
                    for record in points_data["data"]:
                        expires_at = record.get("expires_at")
                        if expires_at and datetime.fromisoformat(expires_at.replace('Z', '+00:00')) > now:
                            total_points += record.get("points", 0)

                return total_points

            # Fallback: return mock data
            return 150  # Mock points balance

        except Exception as e:
            logger.error(f"Failed to get points for customer {customer}: {e}")
            return 0

    async def get_customer_tier(self, customer: str) -> str:
        """
        Get customer's current loyalty tier

        Args:
            customer: Customer identifier

        Returns:
            Loyalty tier (bronze, silver, gold)
        """
        try:
            points = await self.get_customer_points(customer)

            tiers = self.config["tiers"]
            current_tier = "bronze"

            for tier_name, tier_config in tiers.items():
                if points >= tier_config["min_points"]:
                    current_tier = tier_name

            return current_tier

        except Exception as e:
            logger.error(f"Failed to get tier for customer {customer}: {e}")
            return "bronze"

    async def get_tier_benefits(self, tier: str) -> List[str]:
        """
        Get benefits for a loyalty tier

        Args:
            tier: Loyalty tier name

        Returns:
            List of benefits
        """
        return self.config["tiers"].get(tier, {}).get("benefits", [])

    async def award_birthday_points(self, customer: str) -> bool:
        """
        Award birthday bonus points

        Args:
            customer: Customer identifier

        Returns:
            Success status
        """
        try:
            points = self.config["birthday_bonus"]
            return await self.award_points(
                customer=customer,
                points=points,
                reason="Birthday bonus"
            )
        except Exception as e:
            logger.error(f"Failed to award birthday points to customer {customer}: {e}")
            return False

    async def award_referral_points(self, referrer: str, referee: str) -> Dict[str, bool]:
        """
        Award referral bonus points

        Args:
            referrer: Customer who made the referral
            referee: New customer who was referred

        Returns:
            Success status for both awards
        """
        try:
            points = self.config["referral_bonus"]

            referrer_success = await self.award_points(
                customer=referrer,
                points=points,
                reason=f"Referral bonus for {referee}"
            )

            referee_success = await self.award_points(
                customer=referee,
                points=points,
                reason=f"Welcome bonus from {referrer}"
            )

            return {
                "referrer_awarded": referrer_success,
                "referee_awarded": referee_success,
                "points_awarded": points
            }

        except Exception as e:
            logger.error(f"Failed to award referral points: {e}")
            return {
                "referrer_awarded": False,
                "referee_awarded": False,
                "points_awarded": 0,
                "error": str(e)
            }

    async def get_points_history(self, customer: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get customer's points transaction history

        Args:
            customer: Customer identifier
            limit: Maximum number of records to return

        Returns:
            List of points transactions
        """
        try:
            if self.erpnext_adapter:
                # Query points history from ERPNext
                history_data = await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LoyaltyPoints",
                    method="GET",
                    params={
                        "filters": json.dumps([["customer", "=", customer]]),
                        "fields": '["points", "reason", "awarded_date", "expires_at"]',
                        "order_by": "awarded_date desc",
                        "limit_page_length": limit
                    }
                )

                if history_data and history_data.get("data"):
                    return [
                        {
                            "points": record.get("points", 0),
                            "reason": record.get("reason", ""),
                            "awarded_date": record.get("awarded_date"),
                            "expires_at": record.get("expires_at"),
                            "type": "earned"
                        }
                        for record in history_data["data"]
                    ]

            # Fallback: return mock data
            return [
                {
                    "points": 100,
                    "reason": "Purchase at Main Store",
                    "awarded_date": datetime.now().isoformat(),
                    "expires_at": (datetime.now() + timedelta(days=365)).isoformat(),
                    "type": "earned"
                }
            ]

        except Exception as e:
            logger.error(f"Failed to get points history for customer {customer}: {e}")
            return []

    def get_loyalty_config(self) -> Dict[str, Any]:
        """
        Get current loyalty program configuration

        Returns:
            Loyalty configuration
        """
        return self.config.copy()

    def update_loyalty_config(self, new_config: Dict[str, Any]):
        """
        Update loyalty program configuration

        Args:
            new_config: New configuration values
        """
        self.config.update(new_config)
        logger.info("Loyalty configuration updated")