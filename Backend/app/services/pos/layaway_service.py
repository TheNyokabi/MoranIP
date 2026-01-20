"""
Layaway Service for PoS
Manages installment plans and partial payments for customers
"""
import json
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, List
from decimal import Decimal, ROUND_DOWN
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class LayawayService:
    """Service for managing customer layaway/installment plans"""

    def __init__(self, erpnext_adapter=None, tenant_id: str = None):
        """Initialize layaway service"""
        self.erpnext_adapter = erpnext_adapter
        self.tenant_id = tenant_id

        # Default layaway configuration
        self.config = {
            "min_deposit_percentage": 20,  # Minimum 20% deposit
            "max_installments": 12,       # Maximum 12 months
            "interest_rate": 0,           # No interest for now
            "late_payment_fee": 100,      # KES 100 late fee
            "grace_period_days": 7,       # 7 days grace period
            "allowed_frequencies": ["weekly", "biweekly", "monthly"],
            "default_frequency": "monthly"
        }

    async def create_layaway(
        self,
        customer: str,
        items: List[Dict[str, Any]],
        deposit_amount: Decimal,
        total_amount: Decimal,
        installments: int = 3,
        frequency: str = "monthly",
        start_date: date = None
    ) -> Dict[str, Any]:
        """
        Create a new layaway plan

        Args:
            customer: Customer identifier
            items: List of items being purchased
            deposit_amount: Initial deposit amount
            total_amount: Total purchase amount
            installments: Number of installments
            frequency: Payment frequency (weekly, biweekly, monthly)
            start_date: When installments begin

        Returns:
            Layaway plan details
        """
        try:
            if frequency not in self.config["allowed_frequencies"]:
                raise ValueError(f"Invalid frequency: {frequency}")

            if installments > self.config["max_installments"]:
                raise ValueError(f"Maximum installments exceeded: {installments}")

            min_deposit = total_amount * (self.config["min_deposit_percentage"] / 100)
            if deposit_amount < min_deposit:
                raise ValueError(f"Deposit too low. Minimum required: {min_deposit}")

            # Calculate installment amounts
            remaining_amount = total_amount - deposit_amount
            installment_amount = remaining_amount / installments

            # Generate payment schedule
            schedule = self._generate_payment_schedule(
                start_date or date.today(),
                installments,
                installment_amount,
                frequency
            )

            layaway_data = {
                "customer": customer,
                "items": items,
                "total_amount": float(total_amount),
                "deposit_amount": float(deposit_amount),
                "remaining_amount": float(remaining_amount),
                "installments": installments,
                "frequency": frequency,
                "installment_amount": float(installment_amount),
                "payment_schedule": schedule,
                "status": "active",
                "created_date": datetime.now().isoformat(),
                "next_payment_date": schedule[0]["due_date"] if schedule else None
            }

            # Store in ERPNext (would be a custom doctype)
            if self.erpnext_adapter:
                result = await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LayawayPlan",
                    method="POST",
                    json_data=layaway_data
                )

                if result and result.get("data"):
                    layaway_data["id"] = result["data"]["name"]

            logger.info(f"Created layaway plan for customer {customer}, amount: {total_amount}")
            return layaway_data

        except Exception as e:
            logger.error(f"Failed to create layaway for customer {customer}: {e}")
            return {
                "success": False,
                "error": str(e),
                "customer": customer
            }

    def _generate_payment_schedule(
        self,
        start_date: date,
        installments: int,
        amount: Decimal,
        frequency: str
    ) -> List[Dict[str, Any]]:
        """
        Generate payment schedule for layaway plan

        Args:
            start_date: When payments begin
            installments: Number of payments
            amount: Amount per installment
            frequency: Payment frequency

        Returns:
            List of payment schedule items
        """
        schedule = []
        current_date = start_date

        for i in range(installments):
            schedule.append({
                "installment_number": i + 1,
                "amount": float(amount),
                "due_date": current_date.isoformat(),
                "status": "pending"
            })

            # Calculate next payment date
            if frequency == "weekly":
                current_date += timedelta(days=7)
            elif frequency == "biweekly":
                current_date += timedelta(days=14)
            elif frequency == "monthly":
                # Add one month (approximately)
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, current_date.day)
                else:
                    current_date = date(current_date.year, current_date.month + 1, current_date.day)

        return schedule

    async def record_layaway_payment(
        self,
        layaway_id: str,
        payment_amount: Decimal,
        payment_date: date = None
    ) -> Dict[str, Any]:
        """
        Record a payment towards layaway plan

        Args:
            layaway_id: Layaway plan identifier
            payment_amount: Amount being paid
            payment_date: Date of payment

        Returns:
            Payment recording result
        """
        try:
            payment_date = payment_date or date.today()

            # Get layaway details
            layaway_data = await self.get_layaway_status(layaway_id)
            if not layaway_data:
                return {
                    "success": False,
                    "error": "Layaway plan not found"
                }

            # Find next pending payment
            schedule = layaway_data.get("payment_schedule", [])
            next_payment = None

            for payment in schedule:
                if payment["status"] == "pending":
                    next_payment = payment
                    break

            if not next_payment:
                return {
                    "success": False,
                    "error": "No pending payments found"
                }

            # Check if payment covers the installment
            installment_amount = next_payment["amount"]
            if payment_amount >= installment_amount:
                # Mark as paid
                next_payment["status"] = "paid"
                next_payment["paid_date"] = payment_date.isoformat()
                next_payment["paid_amount"] = installment_amount

                # Update next payment date
                layaway_data["next_payment_date"] = self._get_next_payment_date(schedule)

                # Check if layaway is complete
                if self._is_layaway_complete(schedule):
                    layaway_data["status"] = "completed"
                    layaway_data["completed_date"] = payment_date.isoformat()
            else:
                return {
                    "success": False,
                    "error": f"Payment amount {payment_amount} is less than installment amount {installment_amount}"
                }

            # Update in ERPNext
            if self.erpnext_adapter:
                await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/LayawayPlan/{layaway_id}",
                    method="PUT",
                    json_data={"payment_schedule": schedule, "status": layaway_data["status"]}
                )

            return {
                "success": True,
                "layaway_id": layaway_id,
                "payment_recorded": installment_amount,
                "remaining_balance": self._calculate_remaining_balance(schedule),
                "next_payment_date": layaway_data.get("next_payment_date"),
                "status": layaway_data["status"]
            }

        except Exception as e:
            logger.error(f"Failed to record layaway payment for {layaway_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_layaway_status(self, layaway_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current status of layaway plan

        Args:
            layaway_id: Layaway plan identifier

        Returns:
            Layaway plan details or None
        """
        try:
            if self.erpnext_adapter:
                result = await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/LayawayPlan/{layaway_id}",
                    method="GET"
                )

                if result and result.get("data"):
                    return result["data"]

            # Fallback: return mock data
            return {
                "id": layaway_id,
                "customer": "CUST001",
                "total_amount": 15000.0,
                "deposit_amount": 3000.0,
                "remaining_amount": 12000.0,
                "installments": 4,
                "frequency": "monthly",
                "installment_amount": 3000.0,
                "status": "active",
                "payment_schedule": [
                    {"installment_number": 1, "amount": 3000.0, "due_date": "2024-02-01", "status": "paid"},
                    {"installment_number": 2, "amount": 3000.0, "due_date": "2024-03-01", "status": "paid"},
                    {"installment_number": 3, "amount": 3000.0, "due_date": "2024-04-01", "status": "pending"},
                    {"installment_number": 4, "amount": 3000.0, "due_date": "2024-05-01", "status": "pending"}
                ],
                "next_payment_date": "2024-04-01"
            }

        except Exception as e:
            logger.error(f"Failed to get layaway status for {layaway_id}: {e}")
            return None

    def _get_next_payment_date(self, schedule: List[Dict[str, Any]]) -> Optional[str]:
        """Get next pending payment date from schedule"""
        for payment in schedule:
            if payment["status"] == "pending":
                return payment["due_date"]
        return None

    def _is_layaway_complete(self, schedule: List[Dict[str, Any]]) -> bool:
        """Check if all payments in layaway are complete"""
        return all(payment["status"] == "paid" for payment in schedule)

    def _calculate_remaining_balance(self, schedule: List[Dict[str, Any]]) -> float:
        """Calculate remaining balance from payment schedule"""
        return sum(payment["amount"] for payment in schedule if payment["status"] == "pending")

    async def complete_layaway(self, layaway_id: str) -> Dict[str, Any]:
        """
        Mark layaway as completed (early payoff)

        Args:
            layaway_id: Layaway plan identifier

        Returns:
            Completion result
        """
        try:
            layaway_data = await self.get_layaway_status(layaway_id)
            if not layaway_data:
                return {
                    "success": False,
                    "error": "Layaway plan not found"
                }

            # Mark all pending payments as paid
            schedule = layaway_data.get("payment_schedule", [])
            for payment in schedule:
                if payment["status"] == "pending":
                    payment["status"] = "paid"
                    payment["paid_date"] = datetime.now().isoformat()

            layaway_data["status"] = "completed"
            layaway_data["completed_date"] = datetime.now().isoformat()

            # Update in ERPNext
            if self.erpnext_adapter:
                await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/LayawayPlan/{layaway_id}",
                    method="PUT",
                    json_data={
                        "payment_schedule": schedule,
                        "status": "completed",
                        "completed_date": datetime.now().isoformat()
                    }
                )

            return {
                "success": True,
                "layaway_id": layaway_id,
                "status": "completed",
                "completion_date": datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to complete layaway {layaway_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def cancel_layaway(self, layaway_id: str, refund_policy: str = "partial") -> Dict[str, Any]:
        """
        Cancel layaway plan

        Args:
            layaway_id: Layaway plan identifier
            refund_policy: Refund policy (full, partial, none)

        Returns:
            Cancellation result
        """
        try:
            layaway_data = await self.get_layaway_status(layaway_id)
            if not layaway_data:
                return {
                    "success": False,
                    "error": "Layaway plan not found"
                }

            # Calculate refund amount based on policy
            refund_amount = 0.0
            if refund_policy == "full":
                # Refund all paid amounts minus fees
                paid_amounts = sum(
                    payment.get("paid_amount", payment["amount"])
                    for payment in layaway_data.get("payment_schedule", [])
                    if payment.get("paid_date")
                )
                refund_amount = paid_amounts - self.config["late_payment_fee"]
            elif refund_policy == "partial":
                # Refund deposit only
                refund_amount = layaway_data.get("deposit_amount", 0)

            layaway_data["status"] = "cancelled"
            layaway_data["cancelled_date"] = datetime.now().isoformat()
            layaway_data["refund_amount"] = refund_amount
            layaway_data["refund_policy"] = refund_policy

            # Update in ERPNext
            if self.erpnext_adapter:
                await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/LayawayPlan/{layaway_id}",
                    method="PUT",
                    json_data=layaway_data
                )

            return {
                "success": True,
                "layaway_id": layaway_id,
                "status": "cancelled",
                "refund_amount": refund_amount,
                "refund_policy": refund_policy
            }

        except Exception as e:
            logger.error(f"Failed to cancel layaway {layaway_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_customer_layaways(self, customer: str) -> List[Dict[str, Any]]:
        """
        Get all layaway plans for a customer

        Args:
            customer: Customer identifier

        Returns:
            List of customer's layaway plans
        """
        try:
            if self.erpnext_adapter:
                result = await self.erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path="resource/LayawayPlan",
                    method="GET",
                    params={
                        "filters": json.dumps([["customer", "=", customer]]),
                        "fields": '["name", "total_amount", "remaining_amount", "status", "next_payment_date"]'
                    }
                )

                if result and result.get("data"):
                    return result["data"]

            # Fallback: return mock data
            return [
                {
                    "id": "LAY001",
                    "total_amount": 15000.0,
                    "remaining_amount": 6000.0,
                    "status": "active",
                    "next_payment_date": "2024-04-01"
                }
            ]

        except Exception as e:
            logger.error(f"Failed to get layaways for customer {customer}: {e}")
            return []

    def get_layaway_config(self) -> Dict[str, Any]:
        """
        Get current layaway configuration

        Returns:
            Layaway configuration
        """
        return self.config.copy()

    def update_layaway_config(self, new_config: Dict[str, Any]):
        """
        Update layaway configuration

        Args:
            new_config: New configuration values
        """
        self.config.update(new_config)
        logger.info("Layaway configuration updated")