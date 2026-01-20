"""
VAT Calculation Service for PoS Invoices
Handles VAT calculation, account resolution, and tax distribution
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)


class VATService:
    """Service for VAT calculation and account management"""

    def __init__(self, default_vat_rate: float = 16.0):
        """
        Initialize VAT Service

        Args:
            default_vat_rate: Default VAT rate as percentage (e.g., 16.0 for 16%)
        """
        self.default_vat_rate = default_vat_rate

    def calculate_vat_for_items(self, items: List[Dict[str, Any]], is_vatable: bool = True) -> Dict[str, Any]:
        """
        Calculate VAT for a list of items

        Args:
            items: List of items with amount, is_vatable flag, etc.
            is_vatable: Whether the entire invoice is subject to VAT

        Returns:
            Dict with total_amount, total_vat, items breakdown
        """
        if not is_vatable:
            # Non-VATable invoice - return zero VAT
            total_amount = sum(item.get('amount', 0) for item in items)
            items_breakdown = [
                {
                    **item,
                    'vat_amount': 0.0,
                    'net_amount': round(item.get('amount', 0), 2),
                    'vat_rate': 0.0
                }
                for item in items
            ]
            return {
                'total_amount': round(total_amount, 2),
                'total_base': round(total_amount, 2),
                'total_vat': 0.0,
                'items': items_breakdown,
                'vat_breakdown': [
                    {
                        "item_code": i.get("item_code"),
                        "net_amount": i.get("net_amount"),
                        "vat_amount": i.get("vat_amount"),
                        "vat_rate": i.get("vat_rate")
                    }
                    for i in items_breakdown
                ]
            }

        total_amount = 0.0
        total_vat = 0.0
        processed_items = []

        for item in items:
            amount = item.get('amount', 0)
            item_vat_rate = (item.get('vat_rate') or self.default_vat_rate) / 100  # Convert percentage to decimal

            # Calculate VAT for this item
            vat_amount = amount * item_vat_rate
            net_amount = amount  # Net amount is the full amount before VAT
            total_amount += net_amount + vat_amount
            total_vat += vat_amount

            processed_items.append({
                **item,
                'vat_amount': round(vat_amount, 2),
                'net_amount': round(net_amount, 2),
                'vat_rate': item_vat_rate * 100  # Store as percentage
            })

        total_base = sum(item.get('net_amount', 0) for item in processed_items)
        return {
            'total_amount': round(total_amount, 2),
            'total_base': round(total_base, 2),
            'total_vat': round(total_vat, 2),
            'items': processed_items,
            'vat_breakdown': [
                {
                    "item_code": i.get("item_code"),
                    "net_amount": i.get("net_amount"),
                    "vat_amount": i.get("vat_amount"),
                    "vat_rate": i.get("vat_rate")
                }
                for i in processed_items
            ]
        }

    def get_vat_account(self, company: str, vat_type: Optional[str] = None) -> str:
        """
        Get VAT account for a company

        Args:
            company: Company name
            vat_type: Type of VAT account ('output' for sales, 'input' for purchases)

        Returns:
            VAT account name
        """
        # Standard ERPNext VAT account naming convention
        vat_type = vat_type or "output"  # Default to output if not specified
        if vat_type.lower() == "output":
            return f"VAT Output - {company}"
        elif vat_type.lower() == "input":
            return f"VAT Input - {company}"
        else:
            return f"VAT - {company}"

    def validate_vat_account_exists(self, vat_account: str, company: str, erpnext_adapter) -> bool:
        """
        Validate that VAT account exists in ERPNext

        Args:
            vat_account: VAT account name
            company: Company name
            erpnext_adapter: ERPNext adapter instance

        Returns:
            True if account exists
        """
        try:
            # Query ERPNext for the account
            result = erpnext_adapter.proxy_request(
                tenant_id=None,  # Will be resolved from context
                path=f"resource/Account/{vat_account}",
                method="GET"
            )
            return bool(result)
        except Exception as e:
            logger.error(f"VAT account validation failed for {vat_account}: {str(e)}")
            return False

    def calculate_vat_amount(self, amount: float, vat_rate: Optional[float] = None) -> Dict[str, float]:
        """
        Calculate VAT for a single amount

        Args:
            amount: Base amount
            vat_rate: VAT rate as percentage (defaults to default_vat_rate)

        Returns:
            Dict with base_amount, vat_amount, total_amount
        """
        rate = vat_rate if vat_rate is not None else self.default_vat_rate
        vat_rate_decimal = rate / 100

        vat_amount = amount * vat_rate_decimal
        total_amount = amount + vat_amount

        return {
            'base_amount': round(amount, 2),
            'vat_amount': round(vat_amount, 2),
            'total_amount': round(total_amount, 2)
        }