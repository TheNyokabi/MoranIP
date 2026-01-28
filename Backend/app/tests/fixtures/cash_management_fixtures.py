"""
Cash Management Test Fixtures

Provides test data and fixtures for cash management tests.

Author: MoranERP Team
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4

from ...models.cash_management import (
    CashSession, CashTransaction, CashDiscrepancy,
    CashSettings, CashDenomination
)


@pytest.fixture
def sample_cash_settings():
    """Generate sample cash settings"""
    return {
        "require_opening_verification": True,
        "require_closing_verification": True,
        "require_denomination_count": False,
        "default_float_amount": Decimal("5000"),
        "minimum_float_amount": Decimal("1000"),
        "maximum_float_amount": Decimal("50000"),
        "auto_flag_discrepancy_above": Decimal("100"),
        "require_explanation_above": Decimal("50"),
        "tolerance_amount": Decimal("10"),
        "enable_auto_payroll_deduction": False,
        "max_auto_deduction_amount": Decimal("1000"),
        "deduction_requires_acknowledgment": True,
        "notify_manager_on_discrepancy": True,
        "manager_notification_threshold": Decimal("500"),
        "allow_multiple_open_sessions": False,
        "default_currency": "KES",
    }


@pytest.fixture
def sample_cash_session():
    """Generate sample cash session data"""
    return {
        "session_number": "CASH-20240115-0001",
        "pos_profile_id": "POS-001",
        "opening_balance": Decimal("5000"),
        "total_cash_sales": Decimal("25000"),
        "total_card_sales": Decimal("15000"),
        "total_mpesa_sales": Decimal("10000"),
        "total_credit_sales": Decimal("0"),
        "total_refunds": Decimal("500"),
        "total_payouts": Decimal("1000"),
        "total_payins": Decimal("2000"),
        "invoice_count": 45,
    }


@pytest.fixture
def sample_transactions():
    """Generate sample cash transactions"""
    base_time = datetime.utcnow() - timedelta(hours=8)
    
    return [
        {
            "transaction_type": "sale_cash",
            "amount": Decimal("1500"),
            "direction": "in",
            "reference_type": "POS Invoice",
            "reference_id": "INV-001",
            "created_at": base_time + timedelta(minutes=15),
        },
        {
            "transaction_type": "sale_mpesa",
            "amount": Decimal("2500"),
            "direction": "in",
            "reference_type": "POS Invoice",
            "reference_id": "INV-002",
            "created_at": base_time + timedelta(minutes=30),
        },
        {
            "transaction_type": "sale_cash",
            "amount": Decimal("800"),
            "direction": "in",
            "reference_type": "POS Invoice",
            "reference_id": "INV-003",
            "created_at": base_time + timedelta(minutes=45),
        },
        {
            "transaction_type": "refund_cash",
            "amount": Decimal("200"),
            "direction": "out",
            "reference_type": "Refund",
            "reference_id": "REF-001",
            "created_at": base_time + timedelta(hours=1),
        },
        {
            "transaction_type": "payout",
            "amount": Decimal("500"),
            "direction": "out",
            "notes": "Petty cash withdrawal",
            "created_at": base_time + timedelta(hours=2),
        },
        {
            "transaction_type": "payin",
            "amount": Decimal("1000"),
            "direction": "in",
            "notes": "Float top-up",
            "created_at": base_time + timedelta(hours=3),
        },
    ]


@pytest.fixture
def sample_discrepancy():
    """Generate sample discrepancy data"""
    return {
        "discrepancy_type": "short",
        "amount": Decimal("150"),
        "expected_amount": Decimal("30500"),
        "actual_amount": Decimal("30350"),
        "status": "pending",
    }


@pytest.fixture
def kenya_denominations():
    """Standard Kenya currency denominations"""
    return [
        {"denomination_type": "note", "value": Decimal("1000"), "name": "1000 Shilling Note"},
        {"denomination_type": "note", "value": Decimal("500"), "name": "500 Shilling Note"},
        {"denomination_type": "note", "value": Decimal("200"), "name": "200 Shilling Note"},
        {"denomination_type": "note", "value": Decimal("100"), "name": "100 Shilling Note"},
        {"denomination_type": "note", "value": Decimal("50"), "name": "50 Shilling Note"},
        {"denomination_type": "coin", "value": Decimal("40"), "name": "40 Shilling Coin"},
        {"denomination_type": "coin", "value": Decimal("20"), "name": "20 Shilling Coin"},
        {"denomination_type": "coin", "value": Decimal("10"), "name": "10 Shilling Coin"},
        {"denomination_type": "coin", "value": Decimal("5"), "name": "5 Shilling Coin"},
        {"denomination_type": "coin", "value": Decimal("1"), "name": "1 Shilling Coin"},
    ]


class CashManagementTestHelper:
    """Helper class for cash management tests"""
    
    @staticmethod
    def create_session(db, tenant_id, cashier_id, session_data):
        """Create a cash session in the database"""
        session = CashSession(
            id=uuid4(),
            tenant_id=tenant_id,
            cashier_id=cashier_id,
            status="open",
            opened_at=datetime.utcnow(),
            **session_data
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    
    @staticmethod
    def create_transaction(db, tenant_id, session_id, user_id, txn_data):
        """Create a cash transaction"""
        transaction = CashTransaction(
            id=uuid4(),
            tenant_id=tenant_id,
            session_id=session_id,
            transaction_number=f"TXN-{datetime.utcnow().strftime('%Y%m%d')}-{uuid4().hex[:6]}",
            performed_by=user_id,
            **txn_data
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction
    
    @staticmethod
    def create_discrepancy(db, tenant_id, session_id, employee_id, disc_data):
        """Create a cash discrepancy record"""
        discrepancy = CashDiscrepancy(
            id=uuid4(),
            tenant_id=tenant_id,
            session_id=session_id,
            discrepancy_number=f"DISC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid4().hex[:4]}",
            employee_id=employee_id,
            **disc_data
        )
        db.add(discrepancy)
        db.commit()
        db.refresh(discrepancy)
        return discrepancy
    
    @staticmethod
    def create_settings(db, tenant_id, settings_data):
        """Create cash settings"""
        settings = CashSettings(
            tenant_id=tenant_id,
            **settings_data
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings
    
    @staticmethod
    def calculate_expected_cash(session: CashSession) -> Decimal:
        """Calculate expected cash for a session"""
        expected = session.opening_balance or Decimal(0)
        expected += session.total_cash_sales or Decimal(0)
        expected -= session.total_refunds or Decimal(0)
        expected -= session.total_payouts or Decimal(0)
        expected += session.total_payins or Decimal(0)
        return expected
    
    @staticmethod
    def generate_denomination_count(total: Decimal, denominations: list) -> dict:
        """Generate a denomination count that sums to total"""
        remaining = total
        result = {}
        
        # Sort by value descending
        sorted_denoms = sorted(denominations, key=lambda x: x["value"], reverse=True)
        
        for denom in sorted_denoms:
            value = denom["value"]
            count = int(remaining // value)
            if count > 0:
                result[str(int(value))] = count
                remaining -= value * count
        
        return result


@pytest.fixture
def cash_test_helper():
    """Provide the cash management test helper"""
    return CashManagementTestHelper()


# Scenario generators
def generate_full_shift_scenario():
    """Generate a complete shift scenario with multiple transactions"""
    base_time = datetime.utcnow().replace(hour=9, minute=0, second=0)
    
    transactions = []
    running_balance = Decimal("5000")  # Opening
    
    # Morning rush - sales
    for i in range(10):
        amount = Decimal(str(500 + (i * 100)))
        transactions.append({
            "type": "sale_cash",
            "amount": amount,
            "time": base_time + timedelta(minutes=10 * i),
        })
        running_balance += amount
    
    # Lunch break - few sales
    for i in range(3):
        amount = Decimal(str(200 + (i * 50)))
        transactions.append({
            "type": "sale_mpesa",
            "amount": amount,
            "time": base_time + timedelta(hours=2, minutes=20 * i),
        })
    
    # Afternoon - mixed
    transactions.append({
        "type": "refund_cash",
        "amount": Decimal("300"),
        "time": base_time + timedelta(hours=3),
    })
    running_balance -= Decimal("300")
    
    transactions.append({
        "type": "payin",
        "amount": Decimal("2000"),
        "time": base_time + timedelta(hours=4),
        "notes": "Float top-up from safe",
    })
    running_balance += Decimal("2000")
    
    # Evening rush
    for i in range(8):
        amount = Decimal(str(800 + (i * 150)))
        transactions.append({
            "type": "sale_cash",
            "amount": amount,
            "time": base_time + timedelta(hours=5, minutes=15 * i),
        })
        running_balance += amount
    
    return {
        "opening_balance": Decimal("5000"),
        "transactions": transactions,
        "expected_closing": running_balance,
    }
