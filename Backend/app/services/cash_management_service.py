"""
Cash Management Service

Handles cash session lifecycle, transaction recording, and discrepancy management.

Author: MoranERP Team
"""

from typing import Dict, Any, Optional, List
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models.cash_management import (
    CashSession, CashTransaction, CashDiscrepancy,
    CashSettings, CashDenomination
)

import logging

logger = logging.getLogger(__name__)


class CashManagementService:
    """
    Service for managing POS cash sessions and transactions.
    """
    
    def __init__(self, db: Session, tenant_id: str, current_user_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.current_user_id = current_user_id
        self._settings: Optional[CashSettings] = None
    
    @property
    def settings(self) -> CashSettings:
        """Get or create cash settings for tenant"""
        if self._settings is None:
            self._settings = self.db.query(CashSettings).filter(
                CashSettings.tenant_id == self.tenant_id
            ).first()
            
            if not self._settings:
                self._settings = CashSettings(tenant_id=self.tenant_id)
                self.db.add(self._settings)
                self.db.commit()
                self.db.refresh(self._settings)
        
        return self._settings
    
    # ==================== SESSION MANAGEMENT ====================
    
    def open_session(
        self,
        cashier_id: str,
        opening_balance: Decimal,
        pos_profile_id: Optional[str] = None,
        pos_terminal_id: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        opening_notes: Optional[str] = None,
        denominations: Optional[Dict[str, int]] = None,
    ) -> CashSession:
        """
        Open a new cash session for a cashier.
        
        Validates:
        - No other open session for this cashier (unless allowed)
        - Opening balance within allowed range
        """
        # Check for existing open session
        if not self.settings.allow_multiple_open_sessions:
            existing = self.db.query(CashSession).filter(
                CashSession.tenant_id == self.tenant_id,
                CashSession.cashier_id == cashier_id,
                CashSession.status == "open"
            ).first()
            
            if existing:
                raise ValueError(f"Cashier already has an open session: {existing.session_number}")
        
        # Validate opening balance
        if opening_balance < (self.settings.minimum_float_amount or 0):
            raise ValueError(f"Opening balance below minimum: {self.settings.minimum_float_amount}")
        
        if self.settings.maximum_float_amount and opening_balance > self.settings.maximum_float_amount:
            raise ValueError(f"Opening balance above maximum: {self.settings.maximum_float_amount}")
        
        # Generate session number
        session_number = self._generate_session_number()
        
        # Create session
        session = CashSession(
            tenant_id=self.tenant_id,
            session_number=session_number,
            pos_profile_id=pos_profile_id,
            pos_terminal_id=pos_terminal_id,
            warehouse_id=warehouse_id,
            cashier_id=cashier_id,
            opening_balance=opening_balance,
            opening_notes=opening_notes,
            opening_denominations=denominations,
            status="open",
            opened_at=datetime.utcnow()
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(f"Opened cash session {session_number} for cashier {cashier_id}")
        
        return session
    
    def close_session(
        self,
        session_id: str,
        closing_balance: Decimal,
        closing_notes: Optional[str] = None,
        denominations: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        """
        Close a cash session and calculate discrepancy.
        
        Returns session details including discrepancy information.
        """
        session = self.db.query(CashSession).filter(
            CashSession.id == session_id,
            CashSession.tenant_id == self.tenant_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "open":
            raise ValueError(f"Session is not open (status: {session.status})")
        
        # Calculate expected cash
        expected_cash = self._calculate_expected_cash(session)
        
        # Calculate discrepancy
        discrepancy_amount = closing_balance - expected_cash
        has_discrepancy = abs(discrepancy_amount) > (self.settings.tolerance_amount or 0)
        discrepancy_type = None
        
        if has_discrepancy:
            discrepancy_type = "short" if discrepancy_amount < 0 else "over"
        
        # Update session
        session.closing_balance = closing_balance
        session.expected_cash = expected_cash
        session.closing_notes = closing_notes
        session.closing_denominations = denominations
        session.closed_at = datetime.utcnow()
        session.has_discrepancy = has_discrepancy
        session.discrepancy_amount = abs(discrepancy_amount) if has_discrepancy else Decimal(0)
        session.discrepancy_type = discrepancy_type
        session.status = "closing" if self.settings.require_closing_verification else "closed"
        
        # Create discrepancy record if significant
        discrepancy_record = None
        if has_discrepancy and abs(discrepancy_amount) > (self.settings.tolerance_amount or 0):
            discrepancy_record = self._create_discrepancy(session, expected_cash, closing_balance)
        
        self.db.commit()
        
        logger.info(f"Closed cash session {session.session_number}, discrepancy: {discrepancy_amount}")
        
        return {
            "session_id": str(session.id),
            "session_number": session.session_number,
            "opening_balance": float(session.opening_balance),
            "expected_cash": float(expected_cash),
            "closing_balance": float(closing_balance),
            "has_discrepancy": has_discrepancy,
            "discrepancy_amount": float(abs(discrepancy_amount)) if has_discrepancy else 0,
            "discrepancy_type": discrepancy_type,
            "discrepancy_id": str(discrepancy_record.id) if discrepancy_record else None,
            "status": session.status,
            "requires_explanation": has_discrepancy and abs(discrepancy_amount) > (self.settings.require_explanation_above or 0),
        }
    
    def verify_session_close(
        self,
        session_id: str,
        verifier_id: str,
        approved: bool,
        notes: Optional[str] = None
    ) -> CashSession:
        """
        Verify and finalize a session closure (manager approval).
        """
        session = self.db.query(CashSession).filter(
            CashSession.id == session_id,
            CashSession.tenant_id == self.tenant_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        if session.status != "closing":
            raise ValueError(f"Session is not in closing state (status: {session.status})")
        
        if approved:
            session.status = "closed"
            session.closing_verified_by = verifier_id
            session.reconciliation_notes = notes
        else:
            # Reopen session if not approved
            session.status = "open"
            session.closing_balance = None
            session.expected_cash = None
            session.closed_at = None
        
        self.db.commit()
        self.db.refresh(session)
        
        return session
    
    def _calculate_expected_cash(self, session: CashSession) -> Decimal:
        """
        Calculate expected cash in drawer based on transactions.
        
        Expected = Opening + Cash Sales - Cash Refunds - Cash Payouts + Cash Payins
        """
        expected = session.opening_balance or Decimal(0)
        expected += session.total_cash_sales or Decimal(0)
        expected -= session.total_refunds or Decimal(0)
        expected -= session.total_payouts or Decimal(0)
        expected += session.total_payins or Decimal(0)
        
        return expected
    
    def _generate_session_number(self) -> str:
        """Generate unique session number"""
        today = datetime.utcnow().strftime("%Y%m%d")
        
        # Count sessions today
        count = self.db.query(func.count(CashSession.id)).filter(
            CashSession.tenant_id == self.tenant_id,
            CashSession.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).scalar()
        
        return f"CASH-{today}-{(count or 0) + 1:04d}"
    
    # ==================== TRANSACTION RECORDING ====================
    
    def record_transaction(
        self,
        session_id: str,
        transaction_type: str,
        amount: Decimal,
        direction: str,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> CashTransaction:
        """
        Record a cash transaction in the session.
        
        Updates session totals accordingly.
        """
        session = self.db.query(CashSession).filter(
            CashSession.id == session_id,
            CashSession.tenant_id == self.tenant_id,
            CashSession.status == "open"
        ).first()
        
        if not session:
            raise ValueError("No open session found")
        
        # Calculate running balance
        previous_balance = self._get_running_balance(session)
        running_balance = previous_balance + amount if direction == "in" else previous_balance - amount
        
        # Generate transaction number
        transaction_number = self._generate_transaction_number()
        
        # Create transaction
        transaction = CashTransaction(
            tenant_id=self.tenant_id,
            session_id=session_id,
            transaction_number=transaction_number,
            transaction_type=transaction_type,
            amount=amount,
            direction=direction,
            running_balance=running_balance,
            reference_type=reference_type,
            reference_id=reference_id,
            customer_id=customer_id,
            customer_name=customer_name,
            performed_by=self.current_user_id,
            notes=notes,
        )
        
        self.db.add(transaction)
        
        # Update session totals
        self._update_session_totals(session, transaction_type, amount, direction)
        
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction
    
    def _update_session_totals(
        self,
        session: CashSession,
        transaction_type: str,
        amount: Decimal,
        direction: str
    ):
        """Update session totals based on transaction"""
        
        if transaction_type == "sale_cash":
            session.total_cash_sales = (session.total_cash_sales or Decimal(0)) + amount
            session.invoice_count = (session.invoice_count or 0) + 1
        elif transaction_type == "sale_card":
            session.total_card_sales = (session.total_card_sales or Decimal(0)) + amount
            session.invoice_count = (session.invoice_count or 0) + 1
        elif transaction_type == "sale_mpesa":
            session.total_mpesa_sales = (session.total_mpesa_sales or Decimal(0)) + amount
            session.invoice_count = (session.invoice_count or 0) + 1
        elif transaction_type == "sale_credit":
            session.total_credit_sales = (session.total_credit_sales or Decimal(0)) + amount
            session.invoice_count = (session.invoice_count or 0) + 1
        elif transaction_type in ["refund_cash", "refund"]:
            session.total_refunds = (session.total_refunds or Decimal(0)) + amount
        elif transaction_type == "payout":
            session.total_payouts = (session.total_payouts or Decimal(0)) + amount
        elif transaction_type in ["payin", "float_add"]:
            session.total_payins = (session.total_payins or Decimal(0)) + amount
        elif transaction_type == "float_remove":
            session.total_payouts = (session.total_payouts or Decimal(0)) + amount
        
        session.updated_at = datetime.utcnow()
    
    def _get_running_balance(self, session: CashSession) -> Decimal:
        """Get current running balance for session"""
        last_transaction = self.db.query(CashTransaction).filter(
            CashTransaction.session_id == session.id
        ).order_by(CashTransaction.created_at.desc()).first()
        
        if last_transaction and last_transaction.running_balance:
            return last_transaction.running_balance
        
        return session.opening_balance or Decimal(0)
    
    def _generate_transaction_number(self) -> str:
        """Generate unique transaction number"""
        today = datetime.utcnow().strftime("%Y%m%d")
        count = self.db.query(func.count(CashTransaction.id)).filter(
            CashTransaction.tenant_id == self.tenant_id,
            CashTransaction.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).scalar()
        
        return f"TXN-{today}-{(count or 0) + 1:06d}"
    
    # ==================== DISCREPANCY MANAGEMENT ====================
    
    def _create_discrepancy(
        self,
        session: CashSession,
        expected: Decimal,
        actual: Decimal
    ) -> CashDiscrepancy:
        """Create a discrepancy record for accountability"""
        
        amount = abs(actual - expected)
        discrepancy_type = "short" if actual < expected else "over"
        
        discrepancy = CashDiscrepancy(
            tenant_id=self.tenant_id,
            session_id=session.id,
            discrepancy_number=self._generate_discrepancy_number(),
            discrepancy_type=discrepancy_type,
            amount=amount,
            expected_amount=expected,
            actual_amount=actual,
            employee_id=session.cashier_id,
            employee_name=session.cashier_name,
            status="pending",
        )
        
        self.db.add(discrepancy)
        
        return discrepancy
    
    def _generate_discrepancy_number(self) -> str:
        """Generate unique discrepancy number"""
        today = datetime.utcnow().strftime("%Y%m%d")
        count = self.db.query(func.count(CashDiscrepancy.id)).filter(
            CashDiscrepancy.tenant_id == self.tenant_id,
            CashDiscrepancy.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).scalar()
        
        return f"DISC-{today}-{(count or 0) + 1:04d}"
    
    def acknowledge_discrepancy(
        self,
        discrepancy_id: str,
        employee_explanation: Optional[str] = None
    ) -> CashDiscrepancy:
        """Employee acknowledges the discrepancy"""
        
        discrepancy = self.db.query(CashDiscrepancy).filter(
            CashDiscrepancy.id == discrepancy_id,
            CashDiscrepancy.tenant_id == self.tenant_id
        ).first()
        
        if not discrepancy:
            raise ValueError("Discrepancy not found")
        
        discrepancy.status = "acknowledged"
        discrepancy.acknowledged_at = datetime.utcnow()
        discrepancy.employee_explanation = employee_explanation
        
        self.db.commit()
        self.db.refresh(discrepancy)
        
        return discrepancy
    
    def resolve_discrepancy(
        self,
        discrepancy_id: str,
        resolution_type: str,
        resolution_notes: Optional[str] = None,
        deduction_amount: Optional[Decimal] = None,
        deduction_date: Optional[datetime] = None,
        disciplinary_action: Optional[str] = None,
    ) -> CashDiscrepancy:
        """
        Resolve a discrepancy.
        
        Resolution types: repayment, payroll_deduction, waived, error_found, fraud_confirmed
        """
        discrepancy = self.db.query(CashDiscrepancy).filter(
            CashDiscrepancy.id == discrepancy_id,
            CashDiscrepancy.tenant_id == self.tenant_id
        ).first()
        
        if not discrepancy:
            raise ValueError("Discrepancy not found")
        
        discrepancy.resolution_type = resolution_type
        discrepancy.resolution_notes = resolution_notes
        discrepancy.resolved_at = datetime.utcnow()
        discrepancy.resolved_by = self.current_user_id
        discrepancy.disciplinary_action = disciplinary_action
        
        if resolution_type == "payroll_deduction":
            discrepancy.deduction_amount = deduction_amount or discrepancy.amount
            discrepancy.deduction_scheduled_date = deduction_date
            discrepancy.status = "payroll_deduction"
        elif resolution_type == "waived":
            discrepancy.status = "waived"
        else:
            discrepancy.status = "resolved"
        
        # Update session
        session = discrepancy.session
        if session:
            session.status = "reconciled"
            session.reconciled_at = datetime.utcnow()
            session.reconciled_by = self.current_user_id
            session.reconciliation_notes = resolution_notes
        
        self.db.commit()
        self.db.refresh(discrepancy)
        
        return discrepancy
    
    # ==================== REPORTING ====================
    
    def get_session_summary(self, session_id: str) -> Dict[str, Any]:
        """Get detailed summary of a cash session"""
        
        session = self.db.query(CashSession).filter(
            CashSession.id == session_id,
            CashSession.tenant_id == self.tenant_id
        ).first()
        
        if not session:
            raise ValueError("Session not found")
        
        # Get transactions
        transactions = self.db.query(CashTransaction).filter(
            CashTransaction.session_id == session_id
        ).order_by(CashTransaction.created_at.desc()).all()
        
        # Get discrepancies
        discrepancies = self.db.query(CashDiscrepancy).filter(
            CashDiscrepancy.session_id == session_id
        ).all()
        
        return {
            "session": {
                "id": str(session.id),
                "session_number": session.session_number,
                "status": session.status,
                "cashier_id": str(session.cashier_id) if session.cashier_id else None,
                "cashier_name": session.cashier_name,
                "pos_profile_id": session.pos_profile_id,
                "opened_at": session.opened_at.isoformat() if session.opened_at else None,
                "closed_at": session.closed_at.isoformat() if session.closed_at else None,
            },
            "balances": {
                "opening": float(session.opening_balance or 0),
                "expected": float(session.expected_cash or 0) if session.expected_cash else float(self._calculate_expected_cash(session)),
                "closing": float(session.closing_balance or 0) if session.closing_balance else None,
            },
            "totals": {
                "cash_sales": float(session.total_cash_sales or 0),
                "card_sales": float(session.total_card_sales or 0),
                "mpesa_sales": float(session.total_mpesa_sales or 0),
                "credit_sales": float(session.total_credit_sales or 0),
                "total_sales": float(
                    (session.total_cash_sales or 0) + 
                    (session.total_card_sales or 0) + 
                    (session.total_mpesa_sales or 0) + 
                    (session.total_credit_sales or 0)
                ),
                "refunds": float(session.total_refunds or 0),
                "payouts": float(session.total_payouts or 0),
                "payins": float(session.total_payins or 0),
                "invoice_count": session.invoice_count or 0,
            },
            "discrepancy": {
                "has_discrepancy": session.has_discrepancy,
                "amount": float(session.discrepancy_amount or 0),
                "type": session.discrepancy_type,
            } if session.has_discrepancy else None,
            "transactions_count": len(transactions),
            "discrepancies_count": len(discrepancies),
        }
    
    def get_employee_discrepancy_history(
        self,
        employee_id: str,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get discrepancy history for an employee"""
        
        query = self.db.query(CashDiscrepancy).filter(
            CashDiscrepancy.tenant_id == self.tenant_id,
            CashDiscrepancy.employee_id == employee_id
        )
        
        if from_date:
            query = query.filter(CashDiscrepancy.created_at >= from_date)
        if to_date:
            query = query.filter(CashDiscrepancy.created_at <= to_date)
        
        discrepancies = query.order_by(CashDiscrepancy.created_at.desc()).limit(limit).all()
        
        # Calculate totals
        total_short = sum(d.amount for d in discrepancies if d.discrepancy_type == "short")
        total_over = sum(d.amount for d in discrepancies if d.discrepancy_type == "over")
        
        return {
            "employee_id": employee_id,
            "total_discrepancies": len(discrepancies),
            "total_short_amount": float(total_short),
            "total_over_amount": float(total_over),
            "net_discrepancy": float(total_over - total_short),
            "pending_count": sum(1 for d in discrepancies if d.status == "pending"),
            "discrepancies": [
                {
                    "id": str(d.id),
                    "discrepancy_number": d.discrepancy_number,
                    "type": d.discrepancy_type,
                    "amount": float(d.amount),
                    "status": d.status,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                    "resolution_type": d.resolution_type,
                }
                for d in discrepancies
            ]
        }
