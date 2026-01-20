#!/usr/bin/env python3
"""
Initialize Database - Create all tables and seed initial data
"""
import sys
import os

# Add Backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy import create_engine
from app.database import engine, SessionLocal
from app.models.iam import Base as IAMBase
from app.models.rbac import Base as RBACBase
from app.models.onboarding import Base as OnboardingBase
from app.models.erp_modules import Base as ERPModulesBase
from app.scripts.seed_iam import seed_iam

def create_all_tables():
    """Create all database tables from SQLAlchemy models"""
    print("Creating database tables...")
    
    # Import all models to ensure they're registered with Base
    from app.models import iam, rbac, onboarding, erp_modules
    
    # All models use the same Base from iam.py
    # Create all tables
    IAMBase.metadata.create_all(bind=engine)
    
    print("✅ All tables created successfully")

def main():
    print("")
    print("═══════════════════════════════════════════════════════════════")
    print("  Initialize Database - Create Tables & Seed Data")
    print("═══════════════════════════════════════════════════════════════")
    print("")
    
    try:
        # Step 1: Create all tables
        create_all_tables()
        print("")
        
        # Step 2: Seed initial IAM data
        print("Seeding initial IAM data...")
        print("───────────────────────────────────────────────────────────────")
        seed_iam()
        print("")
        
        print("═══════════════════════════════════════════════════════════════")
        print("  ✅ Database Initialization Complete!")
        print("═══════════════════════════════════════════════════════════════")
        print("")
        print("Created:")
        print("  ✓ All database tables")
        print("  ✓ Admin user: admin@moran.com (password: password123)")
        print("  ✓ Moran HQ tenant")
        print("  ✓ Paint Shop Ltd tenant")
        print("")
        print("Next Steps:")
        print("  1. Set up 31Paints tenant")
        print("  2. Configure ERPNext integration")
        print("")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
