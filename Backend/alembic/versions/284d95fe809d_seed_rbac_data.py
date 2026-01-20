"""seed_rbac_data

Revision ID: 284d95fe809d
Revises: 10cd5ff2d3c3
Create Date: 2026-01-06 06:03:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import String, UUID, Boolean, Text, TIMESTAMP
import uuid

# revision identifiers, used by Alembic.
revision: str = '284d95fe809d'
down_revision: Union[str, None] = '10cd5ff2d3c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Define table references for bulk insert
    roles_table = table('roles',
        column('id', UUID),
        column('role_code', String),
        column('code', String),
        column('name', String),
        column('description', Text),
        column('level', String),
        column('scope', String),
        column('is_system', Boolean),
        column('tenant_id', UUID)
    )
    
    permissions_table = table('permissions',
        column('id', UUID),
        column('permission_code', String),
        column('code', String),
        column('module', String),
        column('resource', String),
        column('action', String),
        column('description', Text),
        column('risk_level', String)
    )
    
    role_permissions_table = table('role_permissions',
        column('id', UUID),
        column('role_id', UUID),
        column('permission_id', UUID)
    )
    
    # ==================== SEED ROLES ====================
    
    # System Roles
    super_admin_id = uuid.uuid4()
    
    # Tenant Roles
    owner_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    manager_id = uuid.uuid4()
    staff_id = uuid.uuid4()
    viewer_id = uuid.uuid4()
    accountant_id = uuid.uuid4()
    inventory_manager_id = uuid.uuid4()
    sales_rep_id = uuid.uuid4()
    
    roles_data = [
        # System Role
        {
            'id': super_admin_id,
            'role_code': 'ROL-SYS-001',
            'code': 'SUPER_ADMIN',
            'name': 'Super Administrator',
            'description': 'Platform administrator with full system access',
            'level': 'SYSTEM',
            'scope': 'SYSTEM',
            'is_system': True,
            'tenant_id': None
        },
        # Tenant Roles
        {
            'id': owner_id,
            'role_code': 'ROL-TEN-001',
            'code': 'OWNER',
            'name': 'Owner',
            'description': 'Tenant owner with full control including billing',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': admin_id,
            'role_code': 'ROL-TEN-002',
            'code': 'ADMIN',
            'name': 'Administrator',
            'description': 'Tenant administrator with full access except billing',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': manager_id,
            'role_code': 'ROL-TEN-003',
            'code': 'MANAGER',
            'name': 'Manager',
            'description': 'Department or module manager with approval authority',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': staff_id,
            'role_code': 'ROL-TEN-004',
            'code': 'STAFF',
            'name': 'Staff',
            'description': 'Regular employee with basic access',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': viewer_id,
            'role_code': 'ROL-TEN-005',
            'code': 'VIEWER',
            'name': 'Viewer',
            'description': 'Read-only access to assigned modules',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': accountant_id,
            'role_code': 'ROL-TEN-006',
            'code': 'ACCOUNTANT',
            'name': 'Accountant',
            'description': 'Financial specialist with accounting module access',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': inventory_manager_id,
            'role_code': 'ROL-TEN-007',
            'code': 'INVENTORY_MANAGER',
            'name': 'Inventory Manager',
            'description': 'Inventory and warehouse management specialist',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        },
        {
            'id': sales_rep_id,
            'role_code': 'ROL-TEN-008',
            'code': 'SALES_REP',
            'name': 'Sales Representative',
            'description': 'Sales specialist with CRM and sales access',
            'level': 'TENANT',
            'scope': 'TENANT',
            'is_system': True,
            'tenant_id': None
        }
    ]
    
    op.bulk_insert(roles_table, roles_data)
    
    # ==================== SEED PERMISSIONS ====================
    
    permissions_data = []
    permission_ids = {}
    
    # Helper function to create permission
    def add_permission(code, module, resource, action, description, risk='LOW'):
        perm_id = uuid.uuid4()
        module_abbr = {
            'iam': 'IAM', 'crm': 'CRM', 'inventory': 'INV', 'manufacturing': 'MFG',
            'accounting': 'ACC', 'hr': 'HRM', 'sales': 'SAL', 'purchasing': 'PUR',
            'chama': 'CHM', 'ledger': 'LDG', 'tenant': 'TNT', 'dashboard': 'DSH'
        }.get(module, module[:3].upper())
        
        perm_code = f"PRM-{module_abbr}-{len([p for p in permissions_data if p['module'] == module]) + 1:03d}"
        
        permissions_data.append({
            'id': perm_id,
            'permission_code': perm_code,
            'code': code,
            'module': module,
            'resource': resource,
            'action': action,
            'description': description,
            'risk_level': risk
        })
        permission_ids[code] = perm_id
        return perm_id
    
    # IAM Permissions (15)
    add_permission('iam:users:view', 'iam', 'users', 'view', 'View users')
    add_permission('iam:users:create', 'iam', 'users', 'create', 'Create new users', 'MEDIUM')
    add_permission('iam:users:edit', 'iam', 'users', 'edit', 'Edit user details', 'MEDIUM')
    add_permission('iam:users:delete', 'iam', 'users', 'delete', 'Delete users', 'CRITICAL')
    add_permission('iam:users:assign_role', 'iam', 'users', 'assign_role', 'Assign roles to users', 'HIGH')
    add_permission('iam:users:revoke_role', 'iam', 'users', 'revoke_role', 'Revoke roles from users', 'HIGH')
    add_permission('iam:users:grant_permission', 'iam', 'users', 'grant_permission', 'Grant specific permissions', 'HIGH')
    add_permission('iam:users:revoke_permission', 'iam', 'users', 'revoke_permission', 'Revoke specific permissions', 'HIGH')
    add_permission('iam:roles:view', 'iam', 'roles', 'view', 'View roles')
    add_permission('iam:roles:create', 'iam', 'roles', 'create', 'Create custom roles', 'HIGH')
    add_permission('iam:roles:edit', 'iam', 'roles', 'edit', 'Edit custom roles', 'HIGH')
    add_permission('iam:roles:delete', 'iam', 'roles', 'delete', 'Delete custom roles', 'HIGH')
    add_permission('iam:permissions:view', 'iam', 'permissions', 'view', 'View permissions')
    add_permission('iam:audit:view', 'iam', 'audit', 'view', 'View audit logs', 'MEDIUM')
    add_permission('iam:audit:export', 'iam', 'audit', 'export', 'Export audit logs', 'MEDIUM')
    
    # CRM Permissions (25)
    for resource in ['leads', 'contacts', 'opportunities', 'accounts', 'activities']:
        for action in ['view', 'create', 'edit', 'delete', 'export']:
            risk = 'MEDIUM' if action == 'delete' else 'LOW'
            add_permission(f'crm:{resource}:{action}', 'crm', resource, action, f'{action.title()} {resource}', risk)
    
    # Inventory Permissions (30)
    for resource in ['products', 'stock', 'warehouses', 'transfers', 'adjustments', 'categories']:
        for action in ['view', 'create', 'edit', 'delete', 'export']:
            risk = 'MEDIUM' if action == 'delete' else 'LOW'
            add_permission(f'inventory:{resource}:{action}', 'inventory', resource, action, f'{action.title()} {resource}', risk)
    
    # Manufacturing Permissions (35)
    for resource in ['bom', 'work_orders', 'production_orders', 'job_cards', 'material_requests', 'quality_checks', 'routing']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'HIGH' if action in ['delete', 'approve'] else 'MEDIUM'
            add_permission(f'manufacturing:{resource}:{action}', 'manufacturing', resource, action, f'{action.title()} {resource}', risk)
    
    # Accounting Permissions (40)
    for resource in ['invoices', 'payments', 'expenses', 'journal_entries', 'accounts', 'budgets', 'reports', 'reconciliation']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'CRITICAL' if action == 'delete' else 'HIGH' if action == 'approve' else 'MEDIUM'
            add_permission(f'accounting:{resource}:{action}', 'accounting', resource, action, f'{action.title()} {resource}', risk)
    
    # HR Permissions (25)
    for resource in ['employees', 'payroll', 'attendance', 'leaves', 'performance']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'HIGH' if resource == 'payroll' else 'MEDIUM'
            add_permission(f'hr:{resource}:{action}', 'hr', resource, action, f'{action.title()} {resource}', risk)
    
    # Sales Permissions (20)
    for resource in ['orders', 'quotes', 'customers', 'pricing']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'MEDIUM' if action in ['delete', 'approve'] else 'LOW'
            add_permission(f'sales:{resource}:{action}', 'sales', resource, action, f'{action.title()} {resource}', risk)
    
    # Purchasing Permissions (20)
    for resource in ['purchase_orders', 'suppliers', 'receiving', 'requisitions']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'MEDIUM' if action in ['delete', 'approve'] else 'LOW'
            add_permission(f'purchasing:{resource}:{action}', 'purchasing', resource, action, f'{action.title()} {resource}', risk)
    
    # Chama Permissions (15)
    for resource in ['groups', 'members', 'contributions']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'HIGH' if resource == 'contributions' and action in ['delete', 'approve'] else 'MEDIUM'
            add_permission(f'chama:{resource}:{action}', 'chama', resource, action, f'{action.title()} {resource}', risk)
    
    # Ledger Permissions (20)
    for resource in ['wallets', 'transactions', 'transfers', 'reconciliation']:
        for action in ['view', 'create', 'edit', 'delete', 'approve']:
            risk = 'CRITICAL' if action == 'delete' else 'HIGH'
            add_permission(f'ledger:{resource}:{action}', 'ledger', resource, action, f'{action.title()} {resource}', risk)
    
    # Tenant Permissions (10)
    add_permission('tenant:settings:view', 'tenant', 'settings', 'view', 'View tenant settings')
    add_permission('tenant:settings:edit', 'tenant', 'settings', 'edit', 'Edit tenant settings', 'HIGH')
    add_permission('tenant:settings:delete', 'tenant', 'settings', 'delete', 'Delete tenant', 'CRITICAL')
    add_permission('tenant:billing:view', 'tenant', 'billing', 'view', 'View billing information', 'MEDIUM')
    add_permission('tenant:billing:edit', 'tenant', 'billing', 'edit', 'Manage billing', 'CRITICAL')
    add_permission('tenant:integrations:view', 'tenant', 'integrations', 'view', 'View integrations')
    add_permission('tenant:integrations:manage', 'tenant', 'integrations', 'manage', 'Manage integrations', 'HIGH')
    add_permission('tenant:modules:view', 'tenant', 'modules', 'view', 'View enabled modules')
    add_permission('tenant:modules:manage', 'tenant', 'modules', 'manage', 'Enable/disable modules', 'HIGH')
    add_permission('tenant:data:export', 'tenant', 'data', 'export', 'Export tenant data', 'HIGH')
    
    # Dashboard Permissions (5)
    add_permission('dashboard:analytics:view', 'dashboard', 'analytics', 'view', 'View analytics dashboards')
    add_permission('dashboard:reports:view', 'dashboard', 'reports', 'view', 'View reports')
    add_permission('dashboard:reports:create', 'dashboard', 'reports', 'create', 'Create custom reports')
    add_permission('dashboard:reports:export', 'dashboard', 'reports', 'export', 'Export reports')
    add_permission('dashboard:kpis:manage', 'dashboard', 'kpis', 'manage', 'Manage KPIs', 'MEDIUM')
    
    op.bulk_insert(permissions_table, permissions_data)
    
    # ==================== ASSIGN PERMISSIONS TO ROLES ====================
    
    role_permission_mappings = []
    
    # SUPER_ADMIN gets ALL permissions
    for perm_code, perm_id in permission_ids.items():
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': super_admin_id,
            'permission_id': perm_id
        })
    
    # OWNER gets all permissions
    for perm_code, perm_id in permission_ids.items():
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': owner_id,
            'permission_id': perm_id
        })
    
    # ADMIN gets all except billing and tenant deletion
    for perm_code, perm_id in permission_ids.items():
        if perm_code not in ['tenant:billing:edit', 'tenant:settings:delete']:
            role_permission_mappings.append({
                'id': uuid.uuid4(),
                'role_id': admin_id,
                'permission_id': perm_id
            })
    
    # MANAGER gets full access to operational modules
    manager_permissions = [p for p in permission_ids.keys() if any(
        p.startswith(prefix) for prefix in [
            'crm:', 'inventory:', 'manufacturing:', 'sales:', 'purchasing:',
            'dashboard:', 'hr:employees:', 'hr:attendance:', 'hr:leaves:'
        ]
    )]
    for perm_code in manager_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': manager_id,
            'permission_id': permission_ids[perm_code]
        })
    
    # STAFF gets view and basic CRUD (no delete, no approve)
    staff_permissions = [p for p in permission_ids.keys() if 
        ':view' in p or ':create' in p or ':edit' in p and 
        not any(x in p for x in ['iam:', 'tenant:', 'audit:'])
    ]
    for perm_code in staff_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': staff_id,
            'permission_id': permission_ids[perm_code]
        })
    
    # VIEWER gets only view permissions
    viewer_permissions = [p for p in permission_ids.keys() if ':view' in p]
    for perm_code in viewer_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': viewer_id,
            'permission_id': permission_ids[perm_code]
        })
    
    # ACCOUNTANT gets full accounting + view others
    accountant_permissions = [p for p in permission_ids.keys() if 
        p.startswith('accounting:') or ':view' in p
    ]
    for perm_code in accountant_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': accountant_id,
            'permission_id': permission_ids[perm_code]
        })
    
    # INVENTORY_MANAGER gets full inventory + view others
    inventory_permissions = [p for p in permission_ids.keys() if 
        p.startswith('inventory:') or p.startswith('manufacturing:') or ':view' in p
    ]
    for perm_code in inventory_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': inventory_manager_id,
            'permission_id': permission_ids[perm_code]
        })
    
    # SALES_REP gets CRM + Sales + view inventory
    sales_permissions = [p for p in permission_ids.keys() if 
        p.startswith('crm:') or p.startswith('sales:') or 
        (p.startswith('inventory:') and ':view' in p)
    ]
    for perm_code in sales_permissions:
        role_permission_mappings.append({
            'id': uuid.uuid4(),
            'role_id': sales_rep_id,
            'permission_id': permission_ids[perm_code]
        })
    
    op.bulk_insert(role_permissions_table, role_permission_mappings)


def downgrade() -> None:
    # Delete all seeded data (cascading will handle role_permissions)
    op.execute("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = true)")
    op.execute("DELETE FROM permissions")
    op.execute("DELETE FROM roles WHERE is_system = true")
