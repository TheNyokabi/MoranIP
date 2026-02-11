from datetime import date
from decimal import Decimal

def next_billing_period(start: date) -> date:
    # Monthly billing
    if start.month == 12:
        return date(start.year + 1, 1, start.day)
    return date(start.year, start.month + 1, start.day)


def calculate_tax(amount: Decimal, tax_profile: dict) -> Decimal:
    rate = Decimal(tax_profile.get("rate", 0))
    return (amount * rate).quantize(Decimal("0.01"))


def calculate_total(lines: list) -> Decimal:
    total = Decimal("0.00")
    for line in lines:
        total += line["amount"] + line["tax"]
    return total