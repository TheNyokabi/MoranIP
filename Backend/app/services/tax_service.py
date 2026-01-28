"""
Tax Service

Handles tax calculations, compliance, and reporting.

Author: MoranERP Team
"""

from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal, ROUND_HALF_UP, ROUND_UP, ROUND_DOWN
from datetime import datetime, date
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models.tax import (
    TaxType, TaxRate, ItemTaxTemplate, TaxTransaction,
    WithholdingTaxConfig, TaxSettings, TaxFilingPeriod
)

import logging

logger = logging.getLogger(__name__)


@dataclass
class TaxCalculation:
    """Result of tax calculation for a line item"""
    item_code: str
    base_amount: Decimal
    taxes: List[Dict[str, Any]]  # List of applied taxes
    total_tax: Decimal
    gross_amount: Decimal
    breakdown: Dict[str, Any]


@dataclass
class TaxSummary:
    """Summary of taxes for an invoice/transaction"""
    base_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    taxes_by_type: Dict[str, Decimal]
    line_items: List[TaxCalculation]


class TaxService:
    """
    Central tax calculation and management service.
    """
    
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id
        self._settings: Optional[TaxSettings] = None
        self._tax_cache: Dict[str, Any] = {}
    
    @property
    def settings(self) -> TaxSettings:
        """Get or create tax settings for tenant"""
        if self._settings is None:
            self._settings = self.db.query(TaxSettings).filter(
                TaxSettings.tenant_id == self.tenant_id
            ).first()
            
            if not self._settings:
                self._settings = TaxSettings(tenant_id=self.tenant_id)
                self.db.add(self._settings)
                self.db.commit()
                self.db.refresh(self._settings)
        
        return self._settings
    
    # ==================== TAX CALCULATION ====================
    
    def calculate_item_taxes(
        self,
        item_code: str,
        amount: Decimal,
        quantity: Decimal = Decimal(1),
        item_tax_template_id: Optional[str] = None,
        is_purchase: bool = False,
        prices_include_tax: Optional[bool] = None,
    ) -> TaxCalculation:
        """
        Calculate taxes for a single item.
        
        Args:
            item_code: Item identifier
            amount: Total amount (price * quantity or line total)
            quantity: Quantity (for fixed-rate taxes)
            item_tax_template_id: Override tax template
            is_purchase: True if this is a purchase (affects tax direction)
            prices_include_tax: Override settings for tax-inclusive pricing
        """
        include_tax = prices_include_tax if prices_include_tax is not None else self.settings.prices_include_tax
        
        # Get applicable tax rates
        tax_rates = self._get_applicable_tax_rates(item_code, item_tax_template_id)
        
        if not tax_rates:
            # No taxes applicable
            return TaxCalculation(
                item_code=item_code,
                base_amount=amount,
                taxes=[],
                total_tax=Decimal(0),
                gross_amount=amount,
                breakdown={"no_tax": True}
            )
        
        # Calculate based on whether prices include tax
        if include_tax:
            return self._calculate_tax_inclusive(item_code, amount, quantity, tax_rates)
        else:
            return self._calculate_tax_exclusive(item_code, amount, quantity, tax_rates)
    
    def _calculate_tax_exclusive(
        self,
        item_code: str,
        base_amount: Decimal,
        quantity: Decimal,
        tax_rates: List[Dict]
    ) -> TaxCalculation:
        """Calculate taxes when prices don't include tax (add tax on top)"""
        taxes = []
        total_tax = Decimal(0)
        
        # Sort by priority if specified
        sorted_rates = sorted(tax_rates, key=lambda x: x.get("priority", 0))
        
        taxable_amount = base_amount
        
        for rate_info in sorted_rates:
            tax_type = rate_info["tax_type"]
            tax_rate = rate_info["tax_rate"]
            
            if tax_type.is_compound:
                # Compound tax: apply on (base + previous taxes)
                taxable_amount = base_amount + total_tax
            
            if rate_info.get("rate_type") == "fixed":
                tax_amount = rate_info["fixed_amount"] * quantity
            else:
                tax_amount = taxable_amount * (tax_rate.rate_percentage / 100)
            
            tax_amount = self._round_tax(tax_amount)
            total_tax += tax_amount
            
            taxes.append({
                "tax_type_id": str(tax_type.id),
                "tax_type_code": tax_type.code,
                "tax_type_name": tax_type.name,
                "tax_rate_id": str(tax_rate.id),
                "rate": float(tax_rate.rate_percentage),
                "taxable_amount": float(taxable_amount),
                "tax_amount": float(tax_amount),
                "account_id": tax_type.output_account_id,
            })
        
        return TaxCalculation(
            item_code=item_code,
            base_amount=base_amount,
            taxes=taxes,
            total_tax=total_tax,
            gross_amount=base_amount + total_tax,
            breakdown={
                "method": "exclusive",
                "original_amount": float(base_amount),
            }
        )
    
    def _calculate_tax_inclusive(
        self,
        item_code: str,
        gross_amount: Decimal,
        quantity: Decimal,
        tax_rates: List[Dict]
    ) -> TaxCalculation:
        """Calculate taxes when prices include tax (extract tax from total)"""
        taxes = []
        
        # Calculate total tax rate
        total_rate = sum(
            Decimal(str(r["tax_rate"].rate_percentage))
            for r in tax_rates
            if r.get("rate_type") != "fixed"
        )
        
        # Calculate base amount
        # For tax-inclusive: base = gross / (1 + rate/100)
        if total_rate > 0:
            divisor = 1 + (total_rate / 100)
            base_amount = gross_amount / divisor
        else:
            base_amount = gross_amount
        
        base_amount = self._round_tax(base_amount)
        total_tax = gross_amount - base_amount
        
        # Allocate tax to each type
        sorted_rates = sorted(tax_rates, key=lambda x: x.get("priority", 0))
        
        for rate_info in sorted_rates:
            tax_type = rate_info["tax_type"]
            tax_rate = rate_info["tax_rate"]
            
            if rate_info.get("rate_type") == "fixed":
                tax_amount = rate_info["fixed_amount"] * quantity
            else:
                # Proportional allocation of extracted tax
                rate_proportion = tax_rate.rate_percentage / total_rate if total_rate > 0 else 0
                tax_amount = total_tax * rate_proportion
            
            tax_amount = self._round_tax(tax_amount)
            
            taxes.append({
                "tax_type_id": str(tax_type.id),
                "tax_type_code": tax_type.code,
                "tax_type_name": tax_type.name,
                "tax_rate_id": str(tax_rate.id),
                "rate": float(tax_rate.rate_percentage),
                "taxable_amount": float(base_amount),
                "tax_amount": float(tax_amount),
                "account_id": tax_type.output_account_id,
            })
        
        return TaxCalculation(
            item_code=item_code,
            base_amount=base_amount,
            taxes=taxes,
            total_tax=total_tax,
            gross_amount=gross_amount,
            breakdown={
                "method": "inclusive",
                "original_amount": float(gross_amount),
            }
        )
    
    def calculate_invoice_taxes(
        self,
        line_items: List[Dict[str, Any]],
        is_purchase: bool = False,
    ) -> TaxSummary:
        """
        Calculate taxes for an entire invoice.
        
        Args:
            line_items: List of items with {item_code, amount, quantity, tax_template_id}
            is_purchase: True for purchase invoices
        """
        calculations = []
        base_total = Decimal(0)
        tax_total = Decimal(0)
        taxes_by_type: Dict[str, Decimal] = {}
        
        for item in line_items:
            calc = self.calculate_item_taxes(
                item_code=item.get("item_code", ""),
                amount=Decimal(str(item.get("amount", 0))),
                quantity=Decimal(str(item.get("quantity", 1))),
                item_tax_template_id=item.get("tax_template_id"),
                is_purchase=is_purchase,
            )
            
            calculations.append(calc)
            base_total += calc.base_amount
            tax_total += calc.total_tax
            
            # Aggregate by tax type
            for tax in calc.taxes:
                code = tax["tax_type_code"]
                taxes_by_type[code] = taxes_by_type.get(code, Decimal(0)) + Decimal(str(tax["tax_amount"]))
        
        return TaxSummary(
            base_total=base_total,
            tax_total=tax_total,
            grand_total=base_total + tax_total,
            taxes_by_type={k: v for k, v in taxes_by_type.items()},
            line_items=calculations
        )
    
    def _get_applicable_tax_rates(
        self,
        item_code: str,
        tax_template_id: Optional[str] = None
    ) -> List[Dict]:
        """Get applicable tax rates for an item"""
        
        # Check cache
        cache_key = f"{item_code}:{tax_template_id or 'default'}"
        if cache_key in self._tax_cache:
            return self._tax_cache[cache_key]
        
        result = []
        
        # Get template
        template = None
        if tax_template_id:
            template = self.db.query(ItemTaxTemplate).filter(
                ItemTaxTemplate.id == tax_template_id,
                ItemTaxTemplate.tenant_id == self.tenant_id,
                ItemTaxTemplate.is_active == True
            ).first()
        
        if not template and self.settings.default_item_tax_template_id:
            template = self.db.query(ItemTaxTemplate).filter(
                ItemTaxTemplate.id == self.settings.default_item_tax_template_id,
                ItemTaxTemplate.tenant_id == self.tenant_id,
                ItemTaxTemplate.is_active == True
            ).first()
        
        if template and template.tax_rates:
            # Use template rates
            for rate_config in template.tax_rates:
                tax_type = self.db.query(TaxType).filter(
                    TaxType.id == rate_config.get("tax_type_id"),
                    TaxType.tenant_id == self.tenant_id
                ).first()
                
                tax_rate = self.db.query(TaxRate).filter(
                    TaxRate.id == rate_config.get("tax_rate_id"),
                    TaxRate.tenant_id == self.tenant_id
                ).first()
                
                if tax_type and tax_rate and tax_rate.is_active:
                    result.append({
                        "tax_type": tax_type,
                        "tax_rate": tax_rate,
                        "priority": rate_config.get("priority", 0),
                        "rate_type": tax_rate.rate_type,
                        "fixed_amount": tax_rate.fixed_amount,
                    })
        else:
            # Use default rates
            default_rates = self.db.query(TaxRate).filter(
                TaxRate.tenant_id == self.tenant_id,
                TaxRate.is_default == True,
                TaxRate.is_active == True
            ).all()
            
            for rate in default_rates:
                tax_type = rate.tax_type
                if tax_type and tax_type.is_active:
                    result.append({
                        "tax_type": tax_type,
                        "tax_rate": rate,
                        "priority": 0,
                        "rate_type": rate.rate_type,
                        "fixed_amount": rate.fixed_amount,
                    })
        
        self._tax_cache[cache_key] = result
        return result
    
    def _round_tax(self, amount: Decimal) -> Decimal:
        """Round tax amount according to settings"""
        precision = Decimal(10) ** -self.settings.tax_rounding_precision
        method = self.settings.tax_rounding_method
        
        if method == "floor":
            return amount.quantize(precision, rounding=ROUND_DOWN)
        elif method == "ceil":
            return amount.quantize(precision, rounding=ROUND_UP)
        else:  # round
            return amount.quantize(precision, rounding=ROUND_HALF_UP)
    
    # ==================== WITHHOLDING TAX ====================
    
    def calculate_withholding_tax(
        self,
        category: str,
        amount: Decimal,
        party_is_resident: bool = True,
    ) -> Dict[str, Any]:
        """Calculate withholding tax for a payment category"""
        
        config = self.db.query(WithholdingTaxConfig).filter(
            WithholdingTaxConfig.tenant_id == self.tenant_id,
            WithholdingTaxConfig.category == category,
            WithholdingTaxConfig.is_active == True
        ).first()
        
        if not config:
            return {
                "applicable": False,
                "wht_amount": 0,
                "net_amount": float(amount),
            }
        
        # Check threshold
        if config.threshold_amount and amount < config.threshold_amount:
            return {
                "applicable": False,
                "wht_amount": 0,
                "net_amount": float(amount),
                "reason": "Below threshold"
            }
        
        # Get applicable rate
        if party_is_resident and config.resident_rate:
            rate = config.resident_rate
        elif not party_is_resident and config.non_resident_rate:
            rate = config.non_resident_rate
        else:
            rate = config.rate_percentage
        
        wht_amount = amount * (rate / 100)
        wht_amount = self._round_tax(wht_amount)
        
        return {
            "applicable": True,
            "category": category,
            "rate": float(rate),
            "wht_amount": float(wht_amount),
            "net_amount": float(amount - wht_amount),
            "payable_account": config.payable_account_id,
        }
    
    # ==================== TAX TRANSACTIONS ====================
    
    def record_tax_transaction(
        self,
        tax_type_id: str,
        tax_rate_id: str,
        transaction_type: str,  # "output" or "input"
        document_type: str,
        document_id: str,
        document_date: datetime,
        base_amount: Decimal,
        tax_amount: Decimal,
        party_type: Optional[str] = None,
        party_id: Optional[str] = None,
        party_name: Optional[str] = None,
        party_tax_id: Optional[str] = None,
    ) -> TaxTransaction:
        """Record a tax transaction for reporting"""
        
        # Determine filing period
        period = document_date.strftime("%Y-%m")
        fiscal_year = str(document_date.year)
        
        transaction = TaxTransaction(
            tenant_id=self.tenant_id,
            tax_type_id=tax_type_id,
            tax_rate_id=tax_rate_id,
            transaction_type=transaction_type,
            document_type=document_type,
            document_id=document_id,
            document_date=document_date,
            base_amount=base_amount,
            tax_amount=tax_amount,
            party_type=party_type,
            party_id=party_id,
            party_name=party_name,
            party_tax_id=party_tax_id,
            fiscal_year=fiscal_year,
            period=period,
        )
        
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction
    
    # ==================== REPORTING ====================
    
    def get_tax_summary_for_period(
        self,
        tax_type_code: str,
        period: str,  # "2024-01"
    ) -> Dict[str, Any]:
        """Get tax summary for a period (for filing)"""
        
        tax_type = self.db.query(TaxType).filter(
            TaxType.tenant_id == self.tenant_id,
            TaxType.code == tax_type_code
        ).first()
        
        if not tax_type:
            raise ValueError(f"Tax type {tax_type_code} not found")
        
        # Get output tax (sales)
        output_result = self.db.query(
            func.sum(TaxTransaction.base_amount),
            func.sum(TaxTransaction.tax_amount),
            func.count(TaxTransaction.id)
        ).filter(
            TaxTransaction.tenant_id == self.tenant_id,
            TaxTransaction.tax_type_id == tax_type.id,
            TaxTransaction.transaction_type == "output",
            TaxTransaction.period == period
        ).first()
        
        # Get input tax (purchases)
        input_result = self.db.query(
            func.sum(TaxTransaction.base_amount),
            func.sum(TaxTransaction.tax_amount),
            func.count(TaxTransaction.id)
        ).filter(
            TaxTransaction.tenant_id == self.tenant_id,
            TaxTransaction.tax_type_id == tax_type.id,
            TaxTransaction.transaction_type == "input",
            TaxTransaction.period == period
        ).first()
        
        output_base = output_result[0] or Decimal(0)
        output_tax = output_result[1] or Decimal(0)
        output_count = output_result[2] or 0
        
        input_base = input_result[0] or Decimal(0)
        input_tax = input_result[1] or Decimal(0)
        input_count = input_result[2] or 0
        
        net_tax = output_tax - input_tax
        
        return {
            "tax_type": {
                "code": tax_type.code,
                "name": tax_type.name,
            },
            "period": period,
            "output_tax": {
                "base_amount": float(output_base),
                "tax_amount": float(output_tax),
                "transaction_count": output_count,
            },
            "input_tax": {
                "base_amount": float(input_base),
                "tax_amount": float(input_tax),
                "transaction_count": input_count,
            },
            "net_tax": {
                "amount": float(net_tax),
                "is_payable": net_tax > 0,
                "is_refundable": net_tax < 0,
            },
            "gl_accounts": {
                "output_account": tax_type.output_account_id,
                "input_account": tax_type.input_account_id,
            }
        }
    
    def get_vat_return_data(self, period: str) -> Dict[str, Any]:
        """Get data formatted for VAT return filing"""
        
        # Get VAT tax type
        vat_type = self.db.query(TaxType).filter(
            TaxType.tenant_id == self.tenant_id,
            TaxType.code == "VAT"
        ).first()
        
        if not vat_type:
            return {"error": "VAT tax type not configured"}
        
        summary = self.get_tax_summary_for_period("VAT", period)
        
        # Get breakdown by rate
        rate_breakdown = self.db.query(
            TaxRate.code,
            TaxRate.name,
            TaxRate.rate_percentage,
            func.sum(TaxTransaction.base_amount),
            func.sum(TaxTransaction.tax_amount)
        ).join(TaxTransaction, TaxTransaction.tax_rate_id == TaxRate.id).filter(
            TaxTransaction.tenant_id == self.tenant_id,
            TaxTransaction.period == period,
            TaxTransaction.transaction_type == "output"
        ).group_by(TaxRate.code, TaxRate.name, TaxRate.rate_percentage).all()
        
        return {
            "period": period,
            "company_tax_id": self.settings.tax_id,
            "vat_registration": self.settings.vat_registration_number,
            "summary": summary,
            "sales_breakdown": [
                {
                    "rate_code": row[0],
                    "rate_name": row[1],
                    "rate_percentage": float(row[2]),
                    "taxable_amount": float(row[3] or 0),
                    "vat_amount": float(row[4] or 0),
                }
                for row in rate_breakdown
            ],
            "filing_due_date": self._get_filing_due_date(vat_type, period),
        }
    
    def _get_filing_due_date(self, tax_type: TaxType, period: str) -> str:
        """Calculate filing due date for a period"""
        year, month = map(int, period.split("-"))
        
        if tax_type.filing_frequency == "monthly":
            # Due on nth day of next month
            if month == 12:
                due_month = 1
                due_year = year + 1
            else:
                due_month = month + 1
                due_year = year
            
            due_day = tax_type.filing_due_day or 20
            due_date = date(due_year, due_month, min(due_day, 28))
        else:
            # Quarterly/Annual - simplified
            due_date = date(year, month, 20)
        
        return due_date.isoformat()
