from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from .models import Account, Charge, CollectionPlan, TaxRule
from .schemas import AccountSchema, ChargeSchema, CollectionPlanSchema, TaxRuleSchema

router = APIRouter(
    prefix="/config",
    tags=["Collections Config"]
)

@router.post("/accounts")
def create_account(payload: AccountSchema, db: Session = Depends(get_db)):
    account = Account(**payload.dict())
    db.add(account)
    db.commit()
    return {"message": "Account created", "account_code": account.account_code}

@router.post("/taxes")
def create_tax(payload: TaxRuleSchema, db: Session = Depends(get_db)):
    tax = TaxRule(**payload.dict())
    db.add(tax)
    db.commit()
    return {"message": "Tax rule created", "tax_code": tax.tax_code}

@router.post("/charges")
def create_charge(payload: ChargeSchema, db: Session = Depends(get_db)):
    charge = Charge(**payload.dict())
    db.add(charge)
    db.commit()
    return {"message": "Charge created", "charge_code": charge.charge_code}

@router.post("/collection-plans")
def create_plan(payload: CollectionPlanSchema, db: Session = Depends(get_db)):
    plan = CollectionPlan(
        plan_code=payload.plan_code,
        frequency=payload.frequency,
        due_after_days=payload.due_after_days
    )
    db.add(plan)
    db.commit()
    return {"message": "Collection plan created", "plan_code": plan.plan_code}