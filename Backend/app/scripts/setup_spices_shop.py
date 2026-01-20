import sys
import os
import csv
import io
# Add Backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.import_service import import_service

# Mock tenant ID for the case study
TENANT_ID = "tenant-spices-shop-001" 

# Data
WAREHOUSES_CSV = """name,code
Thika Warehouse,WH-THK
Nairobi Warehouse,WH-NBO
Ruiru Warehouse,WH-RUR
"""

INVENTORY_CSV = """item_code,item_name,item_group,stock_uom,standard_rate,valuation_rate,description
SPICE-CIN-BULK,Cinnamon (Bulk 5kg),Raw Material,Kg,5000,4000,Bulk 5kg bag of Cinnamon
SPICE-CIN-100G,Cinnamon - 100g Pack,Spices,Nos,150,80,100g Retail Pack
SPICE-CIN-250G,Cinnamon - 250g Pack,Spices,Nos,350,200,250g Retail Pack
SPICE-CIN-500G,Cinnamon - 500g Pack,Spices,Nos,650,400,500g Retail Pack
SPICE-CIN-1KG,Cinnamon - 1kg Pack,Spices,Nos,1200,800,1kg Retail Pack
HERB-BAS-BULK,Basil (Bulk 5kg),Raw Material,Kg,4000,3000,Bulk 5kg bag of Basil
HERB-BAS-100G,Basil - 100g Pack,Herbs,Nos,120,60,100g Retail Pack
"""

USERS_CSV = """full_name,email,phone,password,role
Thika Cashier,cashier.thika@spicesshop.com,+254700000001,Pass123!,CASHIER
Nairobi Cashier,cashier.nbo@spicesshop.com,+254700000002,Pass123!,CASHIER
Ruiru Cashier,cashier.rur@spicesshop.com,+254700000003,Pass123!,CASHIER
Procurement Officer,procurement@spicesshop.com,+254700000004,Pass123!,MANAGER
"""

def parse_csv(csv_str):
    reader = csv.DictReader(io.StringIO(csv_str))
    return list(reader)

def setup_tenant(db: Session):
    # Ensure our fake tenant exists in DB for foreign key constraints (Membership)
    from app.models.iam import Tenant
    from sqlalchemy import select
    import uuid
    
    tenant = db.execute(select(Tenant).where(Tenant.id == uuid.UUID("3fa85f64-5717-4562-b3fc-2c963f66afa6"))).scalar_one_or_none()
    if not tenant:
        # Create a dummy tenant if relying on strict UUIDs, 
        # but for this script we might just assume the 'default' tenant exists or create one.
        # Let's use a dynamic one or finding an existing one.
        tenant = db.execute(select(Tenant)).first()
        if tenant:
             return str(tenant[0].id)
    return str(tenant.id) if tenant else None

def main():
    print("Starting Spices Shop Setup...")
    
    # 1. Warehouses
    print("\n>>> Importing Warehouses to ERPNext...")
    wh_data = parse_csv(WAREHOUSES_CSV)
    try:
        res = import_service.import_warehouses(wh_data, TENANT_ID)
        print(f"Success: {res}")
    except Exception as e:
        print(f"Error importing warehouses: {e}")

    # 2. Inventory
    print("\n>>> Importing Inventory to ERPNext...")
    inv_data = parse_csv(INVENTORY_CSV)
    try:
        res = import_service.import_inventory(inv_data, TENANT_ID)
        print(f"Success: {res}")
    except Exception as e:
        print(f"Error importing inventory: {e}")

    # 3. Users
    print("\n>>> Importing Users to Postgres...")
    db = SessionLocal()
    try:
        # Get a valid Tenant ID from DB
        real_tenant_id = setup_tenant(db)
        if not real_tenant_id:
             print("Skipping User Import: No Tenant found in DB to link users to.")
        else:
            print(f"Using Tenant ID: {real_tenant_id}")
            user_data = parse_csv(USERS_CSV)
            try:
                # Note: validation usually happens before import in the API flow.
                # import_users validates largely by trying to insert.
                res = import_service.import_users(user_data, real_tenant_id, db)
                print(f"Success: {res}")
            except Exception as e:
                print(f"Error importing users: {e}")
    finally:
        db.close()

    print("\nSetup Complete!")

if __name__ == "__main__":
    main()
