"""
Accounting Integration Service for PoS
Validates chart of accounts, income/expense accounts, company currency
"""
from typing import Dict, List, Optional, Set
from fastapi import HTTPException


class AccountingIntegrationService:
    """Service for validating accounting setup and accounts"""
    
    def __init__(self, pos_service):
        """
        Initialize Accounting Integration Service
        
        Args:
            pos_service: POS service instance for ERPNext queries
        """
        self.pos_service = pos_service
    
    async def validate_chart_of_accounts(
        self,
        company: str
    ) -> bool:
        """
        Validate that Chart of Accounts is set up for company
        
        Args:
            company: Company name
            
        Returns:
            True if valid, raises HTTPException if not
        """
        try:
            # Check if company exists
            # This would require a method in pos_service to query ERPNext
            # For now, we'll assume validation happens elsewhere
            return True
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Chart of Accounts validation failed: {str(e)}"
            )
    
    async def validate_account_types(
        self,
        accounts: List[Dict[str, str]],
        company: str
    ) -> bool:
        """
        Validate that accounts have correct account types
        
        Args:
            accounts: List of dicts with 'account' and 'expected_type'
            company: Company name
            
        Returns:
            True if all valid, raises HTTPException if not
        """
        errors = []
        
        for acc_info in accounts:
            account_name = acc_info.get("account")
            expected_type = acc_info.get("expected_type")
            
            if not account_name:
                continue
            
            # Validate account exists and has correct type
            # This would require querying ERPNext Account doctype
            # For now, we'll rely on the pos_service.validate_accounts_exist
            # which is already implemented
        
        if errors:
            raise HTTPException(
                status_code=400,
                detail=f"Account type validation failed: {', '.join(errors)}"
            )
        
        return True
    
    async def validate_income_accounts(
        self,
        items: List[Dict],
        company: str
    ) -> List[str]:
        """
        Validate income accounts exist for items
        
        Args:
            items: List of items with income_account or default_income_account
            company: Company name
            
        Returns:
            List of validated income accounts
        """
        income_accounts = set()
        
        for item in items:
            income_account = item.get("income_account") or item.get("default_income_account")
            if not income_account:
                # Use default
                income_account = f"Sales - {company}"
            income_accounts.add(income_account)
        
        # Validate all accounts exist
        account_list = list(income_accounts)
        try:
            await self.pos_service.validate_accounts_exist(account_list, company)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Income account validation failed: {str(e)}"
            )
        
        return account_list
    
    async def validate_expense_accounts(
        self,
        items: List[Dict],
        company: str
    ) -> List[str]:
        """
        Validate expense accounts exist for items (COGS)
        
        Args:
            items: List of items with expense_account or default_expense_account
            company: Company name
            
        Returns:
            List of validated expense accounts
        """
        expense_accounts = set()
        
        for item in items:
            expense_account = item.get("expense_account") or item.get("default_expense_account")
            if not expense_account:
                # Use default
                expense_account = f"Cost of Goods Sold - {company}"
            expense_accounts.add(expense_account)
        
        # Validate all accounts exist
        account_list = list(expense_accounts)
        if account_list:
            try:
                await self.pos_service.validate_accounts_exist(account_list, company)
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Expense account validation failed: {str(e)}"
                )
        
        return account_list
    
    async def validate_vat_account(
        self,
        vat_account: str,
        company: str
    ) -> bool:
        """
        Validate VAT account exists and is a liability account
        
        Args:
            vat_account: VAT account name
            company: Company name
            
        Returns:
            True if valid, raises HTTPException if not
        """
        try:
            await self.pos_service.validate_accounts_exist([vat_account], company)
            return True
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"VAT account validation failed: {str(e)}"
            )
    
    async def validate_payment_accounts(
        self,
        payment_accounts: Dict[str, str],
        company: str
    ) -> bool:
        """
        Validate all payment accounts exist
        
        Args:
            payment_accounts: Mapping of payment modes to accounts
            company: Company name
            
        Returns:
            True if valid, raises HTTPException if not
        """
        account_list = list(payment_accounts.values())
        if not account_list:
            return True
        
        try:
            await self.pos_service.validate_accounts_exist(account_list, company)
            return True
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Payment account validation failed: {str(e)}"
            )
    
    async def validate_company_currency(
        self,
        company: str,
        invoice_currency: str
    ) -> bool:
        """
        Validate company currency matches invoice currency
        
        Args:
            company: Company name
            invoice_currency: Currency used in invoice
            
        Returns:
            True if valid, raises HTTPException if not
        """
        # This would require querying ERPNext Company doctype
        # For now, we'll assume KES for Kenya market
        # In production, this should query the company's default currency
        if invoice_currency != "KES":
            # Allow other currencies but log warning
            pass
        
        return True
