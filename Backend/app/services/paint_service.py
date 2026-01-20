"""
Paint Service
Handles paint-related business logic including color codes, formulas, and inventory calculations
"""
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class PaintService:
    """Service for paint management operations."""

    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    async def get_color_codes(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Get color codes with optional filtering."""
        from app.models.paint import ColorCode

        query = self.db.query(ColorCode).filter(ColorCode.tenant_id == self.tenant_id)

        if filters:
            if filters.get("status"):
                query = query.filter(ColorCode.status == filters["status"])
            if filters.get("color_system"):
                query = query.filter(ColorCode.color_system == filters["color_system"])

        color_codes = query.all()

        return [{
            "id": cc.id,
            "name": cc.name,
            "color_system": cc.color_system,
            "hex_code": cc.hex_code,
            "rgb_values": cc.rgb_values,
            "status": cc.status
        } for cc in color_codes]

    async def create_color_code(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new color code."""
        from app.models.paint import ColorCode
        import uuid

        color_code = ColorCode(
            id=data["id"],
            name=data.get("name"),
            color_system=data["color_system"],
            hex_code=data.get("hex_code"),
            rgb_values=data.get("rgb_values"),
            tenant_id=self.tenant_id
        )

        self.db.add(color_code)
        self.db.commit()
        self.db.refresh(color_code)

        return {
            "id": color_code.id,
            "name": color_code.name,
            "color_system": color_code.color_system
        }

    async def get_tint_formula(self, color_code: str, quantity_liters: float) -> Optional[Dict[str, Any]]:
        """Get the active tint formula for a color code and calculate scaled quantities."""
        from app.models.paint import TintFormula, TintFormulaComponent

        # Get active formula
        formula = self.db.query(TintFormula).filter(
            TintFormula.color_code_id == color_code,
            TintFormula.tenant_id == self.tenant_id,
            TintFormula.is_active == True
        ).first()

        if not formula:
            return None

        # Get components
        components = self.db.query(TintFormulaComponent).filter(
            TintFormulaComponent.formula_id == formula.id
        ).all()

        # Calculate scaling factor
        scale_factor = quantity_liters * 1000 / formula.output_volume_ml  # Convert liters to ml

        formula_data = {
            "id": formula.id,
            "color_code": formula.color_code_id,
            "base_paint_item": formula.base_paint_item,
            "base_paint_quantity": quantity_liters,
            "components": [],
            "scale_factor": scale_factor
        }

        for component in components:
            scaled_quantity = component.quantity_per_unit * scale_factor
            formula_data["components"].append({
                "tint_item_code": component.tint_item_code,
                "quantity_per_unit": component.quantity_per_unit,
                "scaled_quantity": scaled_quantity,
                "unit_of_measure": component.unit_of_measure
            })

        return formula_data

    async def validate_inventory(self, formula_data: Dict[str, Any]) -> Dict[str, bool]:
        """Validate that all required materials are in stock."""
        from app.services.erpnext_client import erpnext_adapter

        results = {
            "base_paint_available": False,
            "tints_available": [],
            "all_available": False
        }

        # Check base paint
        try:
            base_stock = erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=f"resource/Item/{formula_data['base_paint_item']}",
                method="GET"
            )
            if isinstance(base_stock, dict) and base_stock.get("data"):
                # For now, assume base paint is available (would need warehouse-specific stock check)
                results["base_paint_available"] = True
        except:
            pass

        # Check tints
        all_tints_available = True
        for component in formula_data["components"]:
            try:
                tint_stock = erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/Item/{component['tint_item_code']}",
                    method="GET"
                )
                if isinstance(tint_stock, dict) and tint_stock.get("data"):
                    results["tints_available"].append({
                        "item_code": component["tint_item_code"],
                        "available": True  # Simplified check
                    })
                else:
                    results["tints_available"].append({
                        "item_code": component["tint_item_code"],
                        "available": False
                    })
                    all_tints_available = False
            except:
                results["tints_available"].append({
                    "item_code": component["tint_item_code"],
                    "available": False
                })
                all_tints_available = False

        results["all_available"] = results["base_paint_available"] and all_tints_available
        return results

    async def calculate_costs(self, formula_data: Dict[str, Any]) -> Dict[str, float]:
        """Calculate the total cost of materials for a paint formula."""
        from app.services.erpnext_client import erpnext_adapter

        total_cost = 0

        # Base paint cost
        try:
            base_item = erpnext_adapter.proxy_request(
                tenant_id=self.tenant_id,
                path=f"resource/Item/{formula_data['base_paint_item']}",
                method="GET"
            )
            if isinstance(base_item, dict) and base_item.get("data"):
                item_data = base_item["data"]
                unit_cost = item_data.get("valuation_rate", item_data.get("standard_rate", 0))
                base_cost = unit_cost * formula_data["base_paint_quantity"]
                total_cost += base_cost
        except Exception as e:
            logger.warning(f"Failed to get base paint cost: {e}")

        # Tint costs
        for component in formula_data["components"]:
            try:
                tint_item = erpnext_adapter.proxy_request(
                    tenant_id=self.tenant_id,
                    path=f"resource/Item/{component['tint_item_code']}",
                    method="GET"
                )
                if isinstance(tint_item, dict) and tint_item.get("data"):
                    item_data = tint_item["data"]
                    unit_cost = item_data.get("valuation_rate", item_data.get("standard_rate", 0))
                    # Convert scaled quantity to cost (assuming ml pricing)
                    tint_cost = unit_cost * (component["scaled_quantity"] / 1000)  # Convert ml to liters
                    total_cost += tint_cost
            except Exception as e:
                logger.warning(f"Failed to get tint cost for {component['tint_item_code']}: {e}")

        return {
            "total_cost": round(total_cost, 2),
            "base_paint_cost": base_cost if 'base_cost' in locals() else 0,
            "tints_cost": total_cost - (base_cost if 'base_cost' in locals() else 0)
        }