#!/usr/bin/env python3
"""
Seed POS permissions directly into the database.
This script can be run independently to add POS permissions if migrations have issues.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import get_db
from app.models.rbac import Role, Permission, RolePermission
import uuid

def seed_pos_permissions():
    """Seed POS permissions and assign them to roles"""
    db: Session = next(get_db())
    
    try:
        # POS permissions to create
        pos_permissions = [
            ('pos:profiles:view', 'pos', 'profiles', 'view', 'View POS profiles', 'LOW'),
            ('pos:profiles:create', 'pos', 'profiles', 'create', 'Create POS profiles', 'MEDIUM'),
            ('pos:profiles:edit', 'pos', 'profiles', 'edit', 'Edit POS profiles', 'MEDIUM'),
            ('pos:profiles:delete', 'pos', 'profiles', 'delete', 'Delete POS profiles', 'HIGH'),
            ('pos:sessions:view', 'pos', 'sessions', 'view', 'View POS sessions', 'LOW'),
            ('pos:sessions:create', 'pos', 'sessions', 'create', 'Open POS sessions', 'MEDIUM'),
            ('pos:sessions:close', 'pos', 'sessions', 'close', 'Close POS sessions', 'MEDIUM'),
            ('pos:sessions:read', 'pos', 'sessions', 'read', 'Read POS session details', 'LOW'),
            ('pos:orders:view', 'pos', 'orders', 'view', 'View POS orders', 'LOW'),
            ('pos:orders:create', 'pos', 'orders', 'create', 'Create POS orders/invoices', 'MEDIUM'),
            ('pos:orders:edit', 'pos', 'orders', 'edit', 'Edit POS orders', 'MEDIUM'),
            ('pos:orders:cancel', 'pos', 'orders', 'cancel', 'Cancel POS orders', 'HIGH'),
            ('pos:payments:view', 'pos', 'payments', 'view', 'View POS payments', 'LOW'),
            ('pos:payments:process', 'pos', 'payments', 'process', 'Process POS payments', 'HIGH'),
            ('pos:payments:refund', 'pos', 'payments', 'refund', 'Process refunds', 'HIGH'),
            ('pos:payments:mpesa', 'pos', 'payments', 'mpesa', 'Process M-Pesa payments', 'HIGH'),
            ('pos:receipts:view', 'pos', 'receipts', 'view', 'View POS receipts', 'LOW'),
            ('pos:receipts:generate', 'pos', 'receipts', 'generate', 'Generate POS receipts', 'LOW'),
            ('pos:receipts:print', 'pos', 'receipts', 'print', 'Print POS receipts', 'LOW'),
            ('pos:receipts:email', 'pos', 'receipts', 'email', 'Email POS receipts', 'LOW'),
            ('pos:loyalty:view', 'pos', 'loyalty', 'view', 'View loyalty programs', 'LOW'),
            ('pos:loyalty:manage', 'pos', 'loyalty', 'manage', 'Manage loyalty programs', 'MEDIUM'),
            ('pos:loyalty:points', 'pos', 'loyalty', 'points', 'Manage loyalty points', 'MEDIUM'),
            ('pos:loyalty:redeem', 'pos', 'loyalty', 'redeem', 'Redeem loyalty points', 'MEDIUM'),
            ('pos:layaway:view', 'pos', 'layaway', 'view', 'View layaway orders', 'LOW'),
            ('pos:layaway:create', 'pos', 'layaway', 'create', 'Create layaway orders', 'MEDIUM'),
            ('pos:layaway:payments', 'pos', 'layaway', 'payments', 'Process layaway payments', 'MEDIUM'),
            ('pos:layaway:complete', 'pos', 'layaway', 'complete', 'Complete layaway orders', 'MEDIUM'),
            ('pos:sync:view', 'pos', 'sync', 'view', 'View sync status', 'LOW'),
            ('pos:sync:sync', 'pos', 'sync', 'sync', 'Sync offline transactions', 'MEDIUM'),
            ('pos:sync:resolve', 'pos', 'sync', 'resolve', 'Resolve sync conflicts', 'MEDIUM'),
            ('pos:sync:status', 'pos', 'sync', 'status', 'Check sync status', 'LOW'),
            ('pos:analytics:view', 'pos', 'analytics', 'view', 'View POS analytics', 'LOW'),
            ('pos:analytics:dashboard', 'pos', 'analytics', 'dashboard', 'View POS dashboard', 'LOW'),
            ('pos:analytics:reports', 'pos', 'analytics', 'reports', 'View POS reports', 'LOW'),
            ('pos:analytics:export', 'pos', 'analytics', 'export', 'Export POS analytics', 'MEDIUM'),
            ('pos:quick_actions:view', 'pos', 'quick_actions', 'view', 'View quick actions', 'LOW'),
            ('pos:quick_actions:use', 'pos', 'quick_actions', 'use', 'Use quick actions', 'LOW'),
            ('pos:quick_actions:manage', 'pos', 'quick_actions', 'manage', 'Manage quick actions', 'MEDIUM'),
            ('pos:quick_actions:presets', 'pos', 'quick_actions', 'presets', 'Manage quick sale presets', 'MEDIUM'),
        ]
        
        # Create permissions
        permission_ids = {}
        for code, module, resource, action, description, risk_level in pos_permissions:
            # Check if permission already exists
            existing = db.query(Permission).filter(Permission.code == code).first()
            if existing:
                permission_ids[code] = existing.id
                print(f"  Permission {code} already exists")
            else:
                perm = Permission(
                    id=uuid.uuid4(),
                    permission_code=f"PRM-POS-{len(permission_ids)+1:03d}",
                    code=code,
                    module=module,
                    resource=resource,
                    action=action,
                    description=description,
                    risk_level=risk_level
                )
                db.add(perm)
                permission_ids[code] = perm.id
                print(f"  Created permission {code}")
        
        db.flush()
        
        # Get roles
        owner_role = db.query(Role).filter(Role.code == 'OWNER').first()
        admin_role = db.query(Role).filter(Role.code == 'ADMIN').first()
        manager_role = db.query(Role).filter(Role.code == 'MANAGER').first()
        staff_role = db.query(Role).filter(Role.code == 'STAFF').first()
        super_admin_role = db.query(Role).filter(Role.code == 'SUPER_ADMIN').first()
        
        # List all roles for debugging
        all_roles = db.query(Role).all()
        print(f"\nFound {len(all_roles)} roles:")
        for r in all_roles:
            print(f"  - {r.code} (id: {r.id})")
        
        # Assign permissions to SUPER_ADMIN (all POS permissions)
        # Note: OWNER role may not exist if RBAC migrations haven't run
        roles_to_assign = []
        if super_admin_role:
            roles_to_assign.append(super_admin_role)
        if owner_role:
            roles_to_assign.append(owner_role)
        
        if not roles_to_assign:
            print("WARNING: No roles found to assign permissions to!")
            print("  Permissions created but not assigned. Run RBAC migrations first.")
            db.commit()
            return
        
        # Assign permissions to roles
        for role in roles_to_assign:
            for code, perm_id in permission_ids.items():
                # Check if already assigned
                existing = db.query(RolePermission).filter(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm_id
                ).first()
                if not existing:
                    rp = RolePermission(
                        id=uuid.uuid4(),
                        role_id=role.id,
                        permission_id=perm_id
                    )
                    db.add(rp)
                    print(f"  Assigned {code} to {role.code}")
        
        # Assign to ADMIN (all except delete)
        if admin_role:
            for code, perm_id in permission_ids.items():
                if ':delete' not in code:
                    existing = db.query(RolePermission).filter(
                        RolePermission.role_id == admin_role.id,
                        RolePermission.permission_id == perm_id
                    ).first()
                    if not existing:
                        rp = RolePermission(
                            id=uuid.uuid4(),
                            role_id=admin_role.id,
                            permission_id=perm_id
                        )
                        db.add(rp)
        
        # Assign to MANAGER (view, create, edit, read, process, generate, print, email, sync, use)
        if manager_role:
            manager_actions = ['view', 'create', 'edit', 'read', 'process', 'generate', 'print', 'email', 'sync', 'use']
            for code, perm_id in permission_ids.items():
                action = code.split(':')[-1]
                if action in manager_actions:
                    existing = db.query(RolePermission).filter(
                        RolePermission.role_id == manager_role.id,
                        RolePermission.permission_id == perm_id
                    ).first()
                    if not existing:
                        rp = RolePermission(
                            id=uuid.uuid4(),
                            role_id=manager_role.id,
                            permission_id=perm_id
                        )
                        db.add(rp)
        
        # Assign to STAFF (view, create, read, process, generate, print, email, use, sync, status)
        if staff_role:
            staff_actions = ['view', 'create', 'read', 'process', 'generate', 'print', 'email', 'use', 'sync', 'status']
            for code, perm_id in permission_ids.items():
                action = code.split(':')[-1]
                if action in staff_actions:
                    existing = db.query(RolePermission).filter(
                        RolePermission.role_id == staff_role.id,
                        RolePermission.permission_id == perm_id
                    ).first()
                    if not existing:
                        rp = RolePermission(
                            id=uuid.uuid4(),
                            role_id=staff_role.id,
                            permission_id=perm_id
                        )
                        db.add(rp)
        
        db.commit()
        print("\n✓ POS permissions seeded successfully!")
        print(f"  Created/verified {len(permission_ids)} permissions")
        print(f"  Assigned to OWNER, SUPER_ADMIN, ADMIN, MANAGER, and STAFF roles")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error seeding POS permissions: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Seeding POS permissions...")
    seed_pos_permissions()
