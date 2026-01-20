"""
GL Entry Distribution Service for PoS Invoices
Handles mapping of payments, VAT, and income to correct GL accounts
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
import logging

logger = logging.getLogger(__name__)


class GLDistributionService:
    """Service for building and validating GL entries for POS invoices"""

    def __init__(self, vat_service):
        """
        Initialize GL Distribution Service

        Args:
            vat_service: VAT service instance for account resolution
        """
        self.vat_service = vat_service

    def build_gl_entries(
        self,
        invoice_data: Dict[str, Any],
        payment_accounts: Dict[str, str],
        vat_account: str,
        company: str,
        customer: str,
        cost_center: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Build GL entries for a POS invoice

        Args:
            invoice_data: Invoice data with items, payments, totals
            payment_accounts: Mapping of payment modes to GL accounts
            vat_account: VAT account name
            company: Company name
            customer: Customer name
            cost_center: Optional cost center

        Returns:
            List of GL entry dictionaries
        """
        gl_entries = []
        items = invoice_data.get('items', [])
        payments = invoice_data.get('payments', [])
        total_vat = invoice_data.get('total_vat', 0)
        grand_total = invoice_data.get('grand_total', 0)

        # Default cost center
        default_cost_center = cost_center or f"Main - {company}"
        
        # Derive fallback company suffix from known accounts
        fallback_suffix = None
        if payment_accounts:
            first_account = next(iter(payment_accounts.values()))
            if isinstance(first_account, str) and " - " in first_account:
                fallback_suffix = first_account.split(" - ", 1)[1]
        if not fallback_suffix and isinstance(vat_account, str) and " - " in vat_account:
            fallback_suffix = vat_account.split(" - ", 1)[1]
        fallback_income_account = f"Sales - {fallback_suffix}" if fallback_suffix else None

        # 1. Income entries (Credit) - one per item
        for item in items:
            income_account = self._get_income_account(item) or fallback_income_account
            if income_account:
                gl_entries.append({
                    "account": income_account,
                    "debit": 0.0,
                    "credit": round(item.get('net_amount', 0), 2),
                    "against": customer,
                    "party_type": "Customer",
                    "cost_center": default_cost_center,
                    "voucher_type": "Sales Invoice"
                })

        # 2. VAT entry (Credit) - if VAT applies
        if total_vat > 0:
            gl_entries.append({
                "account": vat_account,
                "debit": 0.0,
                "credit": round(total_vat, 2),
                "against": customer,
                "party_type": "Customer",
                "cost_center": default_cost_center,
                "voucher_type": "Sales Invoice"
            })

        # 3. Payment entries (Debit) - one per payment mode
        for payment in payments:
            mode_of_payment = payment.get('mode_of_payment')
            amount = payment.get('amount', 0)

            account = payment_accounts.get(mode_of_payment)
            if account:
                gl_entries.append({
                    "account": account,
                    "debit": round(amount, 2),
                    "credit": 0.0,
                    "against": customer,
                    "party_type": "Customer",
                    "cost_center": default_cost_center,
                    "voucher_type": "Sales Invoice"
                })
            else:
                logger.warning(f"No account mapping found for payment mode: {mode_of_payment}")

        return gl_entries

    def validate_gl_entries(self, gl_entries: List[Dict[str, Any]], expected_total: Decimal) -> bool:
        """
        Validate that GL entries balance (debits = credits)

        Args:
            gl_entries: List of GL entry dictionaries
            expected_total: Expected grand total

        Returns:
            True if entries balance

        Raises:
            ValueError: If entries don't balance
        """
        total_debits = Decimal('0')
        total_credits = Decimal('0')

        for entry in gl_entries:
            debit = Decimal(str(entry.get('debit', 0)))
            credit = Decimal(str(entry.get('credit', 0)))

            total_debits += debit
            total_credits += credit

        # Check if debits equal credits
        if total_debits != total_credits:
            raise ValueError(
                f"GL entries do not balance. Debits: {total_debits}, Credits: {total_credits}, "
                f"Difference: {abs(total_debits - total_credits)}"
            )

        # Check if total matches expected grand total
        if abs(total_debits - expected_total) > Decimal('0.01'):
            raise ValueError(
                f"GL entries total ({total_debits}) does not match expected total ({expected_total})"
            )

        return True

    def _get_income_account(self, item: Dict[str, Any]) -> Optional[str]:
        """
        Get income account for an item

        Args:
            item: Item data dictionary

        Returns:
            Income account name or None
        """
        # Priority: item-specific account > default income account
        return (
            item.get('income_account') or
            item.get('default_income_account')
        )

    def _get_customer_account(self, customer: str, company: str) -> str:
        """
        Get customer account name

        Args:
            customer: Customer name
            company: Company name

        Returns:
            Customer account name
        """
        # Standard ERPNext customer account naming
        return f"{customer} - {company}"

    def build_payment_gl_entries(
        self,
        payments: List[Dict[str, Any]],
        payment_accounts: Dict[str, str],
        customer: str,
        cost_center: str
    ) -> List[Dict[str, Any]]:
        """
        Build GL entries specifically for payments

        Args:
            payments: List of payment dictionaries
            payment_accounts: Payment mode to account mapping
            customer: Customer name
            cost_center: Cost center name

        Returns:
            List of payment GL entries
        """
        gl_entries = []

        for payment in payments:
            mode_of_payment = payment.get('mode_of_payment')
            amount = payment.get('amount', 0)

            account = payment_accounts.get(mode_of_payment)
            if account:
                gl_entries.append({
                    "account": account,
                    "debit": 0.0,
                    "credit": round(amount, 2),
                    "against": customer,
                    "party_type": "Customer",
                    "cost_center": cost_center,
                    "voucher_type": "Sales Invoice"
                })

        return gl_entries

    def build_income_gl_entries(
        self,
        items: List[Dict[str, Any]],
        customer: str,
        cost_center: str
    ) -> List[Dict[str, Any]]:
        """
        Build GL entries for income recognition

        Args:
            items: List of item dictionaries with amounts
            customer: Customer name
            cost_center: Cost center name

        Returns:
            List of income GL entries
        """
        gl_entries = []

        for item in items:
            income_account = self._get_income_account(item)
            net_amount = item.get('net_amount', 0)

            if income_account and net_amount > 0:
                gl_entries.append({
                    "account": income_account,
                    "debit": round(net_amount, 2),
                    "credit": 0.0,
                    "against": customer,
                    "party_type": "Customer",
                    "cost_center": cost_center,
                    "voucher_type": "Sales Invoice"
                })

        return gl_entries

    def build_vat_gl_entries(
        self,
        total_vat: float,
        vat_account: str,
        customer: str,
        cost_center: str
    ) -> List[Dict[str, Any]]:
        """
        Build GL entries for VAT

        Args:
            total_vat: Total VAT amount
            vat_account: VAT account name
            customer: Customer name
            cost_center: Cost center name

        Returns:
            List of VAT GL entries
        """
        if total_vat <= 0:
            return []

        return [{
            "account": vat_account,
            "debit": round(total_vat, 2),
            "credit": 0.0,
            "against": customer,
            "party_type": "Customer",
            "cost_center": cost_center,
            "voucher_type": "Sales Invoice"
        }]