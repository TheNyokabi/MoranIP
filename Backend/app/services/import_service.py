
import csv
import io
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.iam import User, Membership, Tenant, TenantSettings
from app.services.auth_service import auth_service
from app.services.erpnext_client import erpnext_adapter
from app.utils.codes import generate_entity_code, PREFIX_USER

class ImportService:
    def parse_csv(self, file_content: bytes) -> List[Dict[str, Any]]:
        """Parses a CSV file content into a list of dictionaries."""
        try:
            decoded = file_content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(decoded))
            return list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    def validate_users(self, data: List[Dict[str, Any]], db: Session) -> List[str]:
        """Validates user data."""
        errors = []
        emails = set()
        for i, row in enumerate(data):
            row_num = i + 1
            if not row.get('email'):
                errors.append(f"Row {row_num}: Missing email")
            elif row['email'] in emails:
                 errors.append(f"Row {row_num}: Duplicate email in file '{row['email']}'")
            else:
                emails.add(row['email'])
                # Check DB for existence
                existing = db.execute(select(User).where(User.email == row['email'])).scalar_one_or_none()
                if existing:
                    errors.append(f"Row {row_num}: Email '{row['email']}' already exists in system")
            
            if not row.get('full_name'):
                errors.append(f"Row {row_num}: Missing full_name")
            
            # Optional: role validation
            role = row.get('role', 'STAFF').upper()
            valid_roles = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER', 'CASHIER', 'ACCOUNTANT', 'INVENTORY_MANAGER', 'SALES_REP']
            if role not in valid_roles:
                 errors.append(f"Row {row_num}: Invalid role '{role}'. Must be one of {valid_roles}")

        return errors

    def import_users(self, data: List[Dict[str, Any]], tenant_id: str, db: Session) -> Dict[str, Any]:
        """Creates users and memberships."""
        created_count = 0
        
        # Resolve Tenant
        tenant = db.execute(select(Tenant).where(Tenant.id == tenant_id)).scalar_one_or_none()
        if not tenant:
             raise HTTPException(status_code=404, detail="Tenant not found")

        for row in data:
            email = row['email']
            full_name = row['full_name']
            phone = row.get('phone')
            password = row.get('password', 'ChangeMe123!') # Default password
            role = row.get('role', 'STAFF').upper()
            
            # 1. Create User
            user_code = generate_entity_code(PREFIX_USER, tenant.country_code)
            
            # Check if user exists (double check to be safe)
            user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
            if not user:
                user = User(
                    id=uuid.uuid4(),
                    user_code=user_code,
                    email=email,
                    phone=phone,
                    full_name=full_name,
                    password_hash=auth_service.get_password_hash(password),
                    kyc_tier='KYC-T0',
                    is_active=True
                )
                db.add(user)
                db.flush() # Flush to get ID if needed, though we set it manually
            
            # 2. Create Membership
            # Check if membership exists
            membership = db.execute(select(Membership).where(
                Membership.user_id == user.id,
                Membership.tenant_id == tenant_id
            )).scalar_one_or_none()
            
            if not membership:
                membership = Membership(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    tenant_id=tenant_id,
                    role=role,
                    status='ACTIVE', # Auto-activate imported users
                    joined_at=datetime.utcnow() 
                )
                db.add(membership)
                created_count += 1
        
        db.commit()
        return {"processed": len(data), "created": created_count}

    def validate_erp_entity(self, data: List[Dict[str, Any]], required_fields: List[str]) -> List[str]:
        errors = []
        for i, row in enumerate(data):
            for field in required_fields:
                if not row.get(field):
                    errors.append(f"Row {i+1}: Missing required field '{field}'")
        return errors

    def _resolve_company_name(self, tenant_id: str, db: Session) -> str:
        """Resolve company name from tenant settings (priority) or tenant name (fallback)."""
        tenant = db.execute(select(Tenant).where(Tenant.id == tenant_id)).scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Get company from tenant settings (priority) or fallback to tenant name
        if tenant.tenant_settings and tenant.tenant_settings.company_name:
            return tenant.tenant_settings.company_name
        return tenant.name

    def import_inventory(self, data: List[Dict[str, Any]], tenant_id: str, db: Session) -> Dict[str, Any]:
        """Imports products to ERPNext."""
        # Mapping CSV headers to ERPNext fields
        # ERPNext Item fields: item_code, item_name, item_group, standard_rate, valuation_rate, stock_uom
        
        # Validating
        errors = self.validate_erp_entity(data, ['name'])
        if errors:
             raise HTTPException(status_code=400, detail={"errors": errors})

        success_count = 0
        for row in data:
            item_data = {
                'item_code': row.get('item_code') or row.get('sku', '') or row.get('name', '')[:10].upper(),
                'item_name': row.get('item_name') or row.get('name'),
                'item_group': row.get('item_group', 'Products'),
                'stock_uom': row.get('stock_uom', 'Nos'),
                'standard_rate': float(row.get('standard_rate') or row.get('sale_price', 0.0)),
                'valuation_rate': float(row.get('valuation_rate') or row.get('cost_price', 0.0)),
                'description': row.get('description', '')
                # Removed hardcoded default_warehouse - let ERPNext handle or set via tenant settings
            }
            
            # Only add default_warehouse if explicitly provided in CSV
            if row.get('default_warehouse'):
                item_data['default_warehouse'] = row.get('default_warehouse')
            
            try:
                erpnext_adapter.create_resource('Item', item_data, tenant_id)
                success_count += 1
            except Exception as e:
                print(f"Failed to import item {row.get('item_name')}: {e}")
                # Continue or abort? For bulk, maybe verify existing? 
        
        return {"processed": len(data), "created": success_count}

    def import_warehouses(self, data: List[Dict[str, Any]], tenant_id: str, db: Session) -> Dict[str, Any]:
        """Imports warehouses to ERPNext. Company is auto-resolved from tenant settings."""
        errors = self.validate_erp_entity(data, ['name', 'code'])
        if errors:
             raise HTTPException(status_code=400, detail={"errors": errors})
        
        # Resolve company name once for all warehouses
        company_name = self._resolve_company_name(tenant_id, db)
        
        success_count = 0
        for row in data:
            wh_data = {
                'warehouse_name': row['name'],
                'name': row['name'],
                'warehouse_code': row['code'],
                'company': company_name,  # Auto-resolved from tenant context
                'is_group': False
            }
            try:
                erpnext_adapter.create_resource('Warehouse', wh_data, tenant_id)
                success_count += 1
            except Exception as e:
                print(f"Failed to import warehouse {row.get('name')}: {e}")
        
        return {"processed": len(data), "created": success_count}
    
    def import_storefronts(self, data: List[Dict[str, Any]], tenant_id: str, db: Session) -> Dict[str, Any]:
        """Imports Storefronts (as Mode of Payments or Warehouses in ERPNext context)."""
        # Note: Storefront concept maps loosely in ERPNext. Mapping to Warehouse for now if not defined differently.
        # Or if strictly POS Config, ERPNext has 'POS Profile'.
        
        errors = self.validate_erp_entity(data, ['name'])
        if errors:
             raise HTTPException(status_code=400, detail={"errors": errors})
        
        # Resolve company name once for all storefronts
        company_name = self._resolve_company_name(tenant_id, db)
            
        success_count = 0
        for row in data:
            # Treating Storefront as a Warehouse for stock location purposes in simple setup
            # Or dedicated POS Profile
             wh_data = {
                'warehouse_name': row['name'],
                'name': row['name'],
                'warehouse_code': row.get('code', row['name'][:3].upper()),
                'company': company_name  # Auto-resolved from tenant context
            }
             try:
                erpnext_adapter.create_resource('Warehouse', wh_data, tenant_id)
                success_count += 1
             except Exception as e:
                print(f"Failed to import storefront {row.get('name')}: {e}")
        
        return {"processed": len(data), "created": success_count}

import_service = ImportService()
