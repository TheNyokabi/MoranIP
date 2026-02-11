from sqlalchemy.orm import Session
from Engine.Collections.Accounting.models import Account


def create_account(db: Session, data):
    account = Account(**data.dict())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def get_accounts(db: Session, workspace_id: str):
    return (
        db.query(Account)
        .filter(
            Account.workspace_id == workspace_id,
            Account.is_active.is_(True),
        )
        .order_by(Account.code)
        .all()
    )
    
class JournalValidationError(Exception):
    pass

def validate_journal_entry(
    db: Session,
    workspace_id: str,
    lines: list[dict],
):
    if len(lines) < 2:
        raise JournalValidationError("Journal entry must have at least 2 lines")

    debit_total = 0
    credit_total = 0

    for line in lines:
        amount = line["amount"]

        if amount <= 0:
            raise JournalValidationError("Journal line amount must be positive")

        account = (
            db.query(Account)
            .filter(
                Account.workspace_id == workspace_id,
                Account.code == line["account_code"],
                Account.is_active.is_(True),
            )
            .first()
        )

        if not account:
            raise JournalValidationError(
                f"Invalid account code: {line['account_code']}"
            )

        if line["is_debit"]:
            debit_total += amount
        else:
            credit_total += amount

    if round(debit_total, 2) != round(credit_total, 2):
        raise JournalValidationError(
            f"Debits ({debit_total}) do not equal credits ({credit_total})"
        )  
