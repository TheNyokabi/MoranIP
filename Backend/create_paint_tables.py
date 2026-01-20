#!/usr/bin/env python3
"""
Script to create paint-related database tables using SQLAlchemy ORM
Run this inside the Docker container: docker exec -it moran-api python3 /app/create_paint_tables.py
"""
import sys
import os
sys.path.append('/app')

def create_paint_tables():
    """Create all paint-related tables and add sample data"""
    try:
        from app.database import engine
        from app.models.paint import (
            ColorCode, TintFormula, TintFormulaComponent, PaintSaleTransaction,
            Base
        )
        from sqlalchemy.orm import sessionmaker
        import uuid

        print("🔄 Creating paint tables...")

        # Create all tables
        Base.metadata.create_all(bind=engine, checkfirst=True)

        print("✅ Paint tables created successfully!")

        # Create session for sample data
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()

        try:
            # Check if sample data already exists
            existing_colors = db.query(ColorCode).count()
            if existing_colors > 0:
                print(f"ℹ️  Sample data already exists ({existing_colors} color codes)")
                db.close()
                return

            print("🔄 Adding sample data...")

            # Create sample color codes
            color_codes_data = [
                {
                    "id": "RAL-5015",
                    "name": "Sky Blue",
                    "color_system": "RAL",
                    "hex_code": "#4A90E2",
                    "tenant_id": "system"  # Will be updated per tenant
                },
                {
                    "id": "RAL-9005",
                    "name": "Jet Black",
                    "color_system": "RAL",
                    "hex_code": "#000000",
                    "tenant_id": "system"
                },
                {
                    "id": "CUSTOM-RED-001",
                    "name": "Crimson Red",
                    "color_system": "CUSTOM",
                    "hex_code": "#DC143C",
                    "tenant_id": "system"
                }
            ]

            colors = []
            for color_data in color_codes_data:
                color = ColorCode(**color_data)
                db.add(color)
                colors.append(color)

            db.flush()  # Get IDs

            # Create sample tint formulas
            formulas_data = [
                {
                    "color_code_id": "RAL-5015",
                    "name": "Standard Sky Blue Formula",
                    "base_paint_item": "BASE-A-WHITE",
                    "output_volume_ml": 1000,
                    "version": 1,
                    "is_active": True,
                    "tenant_id": "system",
                    "components": [
                        {"tint_item_code": "TINT-BLUE-001", "quantity_per_unit": 12.0, "unit_of_measure": "ml"},
                        {"tint_item_code": "TINT-BLACK-001", "quantity_per_unit": 1.0, "unit_of_measure": "ml"}
                    ]
                },
                {
                    "color_code_id": "RAL-9005",
                    "name": "Pure Black Formula",
                    "base_paint_item": "BASE-A-WHITE",
                    "output_volume_ml": 1000,
                    "version": 1,
                    "is_active": True,
                    "tenant_id": "system",
                    "components": [
                        {"tint_item_code": "TINT-BLACK-001", "quantity_per_unit": 50.0, "unit_of_measure": "ml"}
                    ]
                },
                {
                    "color_code_id": "CUSTOM-RED-001",
                    "name": "Crimson Red Formula",
                    "base_paint_item": "BASE-A-WHITE",
                    "output_volume_ml": 1000,
                    "version": 1,
                    "is_active": True,
                    "tenant_id": "system",
                    "components": [
                        {"tint_item_code": "TINT-RED-001", "quantity_per_unit": 25.0, "unit_of_measure": "ml"},
                        {"tint_item_code": "TINT-YELLOW-001", "quantity_per_unit": 2.0, "unit_of_measure": "ml"}
                    ]
                }
            ]

            for formula_data in formulas_data:
                components = formula_data.pop("components")
                formula = TintFormula(**formula_data)
                db.add(formula)
                db.flush()

                # Add components
                for comp_data in components:
                    component = TintFormulaComponent(
                        formula_id=formula.id,
                        **comp_data
                    )
                    db.add(component)

            db.commit()
            print("✅ Sample color codes and formulas created!")

        except Exception as e:
            db.rollback()
            print(f"❌ Error creating sample data: {e}")
            raise
        finally:
            db.close()

    except Exception as e:
        print(f"❌ Error creating paint tables: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    create_paint_tables()