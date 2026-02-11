from typing import List
from Engine.Collections.Accounting.models import JournalLine


def invoice_generated_rules(event) -> List[JournalLine]:
    """
    Debit: Accounts Receivable
    Credit: Revenue
    """

    return [
        JournalLine(
            account_code="1100",  # Accounts Receivable
            debit=event.total_amount,
            credit=0.0,
            currency=event.currency,
        ),
        JournalLine(
            account_code="4000",  # Revenue
            debit=0.0,
            credit=event.total_amount,
            currency=event.currency,
        ),
    ]


RULES_REGISTRY = {
    "invoice.generated": invoice_generated_rules,
}
