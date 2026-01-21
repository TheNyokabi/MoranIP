"""add_erpnext_permissions

Revision ID: b4dab048844d
Revises: dbd206ea3325
Create Date: 2026-01-06 12:32:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid

# revision identifiers, used by Alembic.
revision = 'b4dab048844d'
down_revision = 'dbd206ea3325'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add ERPNext permissions to RBAC system for paint shop PoS operations.
    Includes permissions for: Warehouse, Item, Stock Entry, Customer, Sales Person,
    Sales Invoice, and Payment Entry management.
    """
    conn = op.get_bind()
    
    # ERPNext permissions for paint shop PoS
    erpnext_permissions = [
        # Warehouse Management (PRM-ERP-001 to PRM-ERP-004)
        ('PRM-ERP-001', 'erpnext:warehouse:view', 'erpnext', 'warehouse', 'view', 
         'View warehouses in ERPNext', 'LOW'),
        ('PRM-ERP-002', 'erpnext:warehouse:create', 'erpnext', 'warehouse', 'create', 
         'Create warehouses in ERPNext', 'MEDIUM'),
        ('PRM-ERP-003', 'erpnext:warehouse:edit', 'erpnext', 'warehouse', 'edit', 
         'Edit warehouses in ERPNext', 'MEDIUM'),
        ('PRM-ERP-004', 'erpnext:warehouse:delete', 'erpnext', 'warehouse', 'delete', 
         'Delete warehouses in ERPNext', 'HIGH'),
        
        # Item Management (PRM-ERP-005 to PRM-ERP-008)
        ('PRM-ERP-005', 'erpnext:item:view', 'erpnext', 'item', 'view', 
         'View items in ERPNext', 'LOW'),
        ('PRM-ERP-006', 'erpnext:item:create', 'erpnext', 'item', 'create', 
         'Create items in ERPNext', 'MEDIUM'),
        ('PRM-ERP-007', 'erpnext:item:edit', 'erpnext', 'item', 'edit', 
         'Edit items in ERPNext', 'MEDIUM'),
        ('PRM-ERP-008', 'erpnext:item:delete', 'erpnext', 'item', 'delete', 
         'Delete items in ERPNext', 'HIGH'),
        
        # Stock Entry Management (PRM-ERP-009 to PRM-ERP-012)
        ('PRM-ERP-009', 'erpnext:stock entry:view', 'erpnext', 'stock entry', 'view', 
         'View stock entries in ERPNext', 'LOW'),
        ('PRM-ERP-010', 'erpnext:stock entry:create', 'erpnext', 'stock entry', 'create', 
         'Create stock entries in ERPNext', 'MEDIUM'),
        ('PRM-ERP-011', 'erpnext:stock entry:edit', 'erpnext', 'stock entry', 'edit', 
         'Edit stock entries in ERPNext', 'MEDIUM'),
        ('PRM-ERP-012', 'erpnext:stock entry:delete', 'erpnext', 'stock entry', 'delete', 
         'Delete stock entries in ERPNext', 'HIGH'),
        
        # Customer Management (PRM-ERP-013 to PRM-ERP-016)
        ('PRM-ERP-013', 'erpnext:customer:view', 'erpnext', 'customer', 'view', 
         'View customers in ERPNext', 'LOW'),
        ('PRM-ERP-014', 'erpnext:customer:create', 'erpnext', 'customer', 'create', 
         'Create customers in ERPNext', 'MEDIUM'),
        ('PRM-ERP-015', 'erpnext:customer:edit', 'erpnext', 'customer', 'edit', 
         'Edit customers in ERPNext', 'MEDIUM'),
        ('PRM-ERP-016', 'erpnext:customer:delete', 'erpnext', 'customer', 'delete', 
         'Delete customers in ERPNext', 'HIGH'),
        
        # Sales Person Management (PRM-ERP-017 to PRM-ERP-020)
        ('PRM-ERP-017', 'erpnext:sales person:view', 'erpnext', 'sales person', 'view', 
         'View sales persons in ERPNext', 'LOW'),
        ('PRM-ERP-018', 'erpnext:sales person:create', 'erpnext', 'sales person', 'create', 
         'Create sales persons in ERPNext', 'MEDIUM'),
        ('PRM-ERP-019', 'erpnext:sales person:edit', 'erpnext', 'sales person', 'edit', 
         'Edit sales persons in ERPNext', 'MEDIUM'),
        ('PRM-ERP-020', 'erpnext:sales person:delete', 'erpnext', 'sales person', 'delete', 
         'Delete sales persons in ERPNext', 'HIGH'),
        
        # Sales Invoice Management (PRM-ERP-021 to PRM-ERP-024)
        ('PRM-ERP-021', 'erpnext:sales invoice:view', 'erpnext', 'sales invoice', 'view', 
         'View sales invoices in ERPNext', 'LOW'),
        ('PRM-ERP-022', 'erpnext:sales invoice:create', 'erpnext', 'sales invoice', 'create', 
         'Create sales invoices in ERPNext', 'MEDIUM'),
        ('PRM-ERP-023', 'erpnext:sales invoice:edit', 'erpnext', 'sales invoice', 'edit', 
         'Edit sales invoices in ERPNext', 'MEDIUM'),
        ('PRM-ERP-024', 'erpnext:sales invoice:delete', 'erpnext', 'sales invoice', 'delete', 
         'Delete sales invoices in ERPNext', 'HIGH'),
        
        # Payment Entry Management (PRM-ERP-025 to PRM-ERP-028)
        ('PRM-ERP-025', 'erpnext:payment entry:view', 'erpnext', 'payment entry', 'view', 
         'View payment entries in ERPNext', 'LOW'),
        ('PRM-ERP-026', 'erpnext:payment entry:create', 'erpnext', 'payment entry', 'create', 
         'Create payment entries in ERPNext', 'MEDIUM'),
        ('PRM-ERP-027', 'erpnext:payment entry:edit', 'erpnext', 'payment entry', 'edit', 
         'Edit payment entries in ERPNext', 'MEDIUM'),
        ('PRM-ERP-028', 'erpnext:payment entry:delete', 'erpnext', 'payment entry', 'delete', 
         'Delete payment entries in ERPNext', 'HIGH'),
        
        # Wildcard Permissions (PRM-ERP-029 to PRM-ERP-032)
        ('PRM-ERP-029', 'erpnext:*:view', 'erpnext', '*', 'view', 
         'View all ERPNext resources', 'MEDIUM'),
        ('PRM-ERP-030', 'erpnext:*:create', 'erpnext', '*', 'create', 
         'Create all ERPNext resources', 'HIGH'),
        ('PRM-ERP-031', 'erpnext:*:edit', 'erpnext', '*', 'edit', 
         'Edit all ERPNext resources', 'HIGH'),
        ('PRM-ERP-032', 'erpnext:*:delete', 'erpnext', '*', 'delete', 
         'Delete all ERPNext resources', 'CRITICAL'),
    ]
    
    # Insert permissions
    for perm_code, code, module, resource, action, description, risk_level in erpnext_permissions:
        perm_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO permissions (id, permission_code, code, module, resource, action, description, risk_level)
            VALUES (:id, :perm_code, :code, :module, :resource, :action, :description, :risk_level)
        """), {
            'id': perm_id,
            'perm_code': perm_code,
            'code': code,
            'module': module,
            'resource': resource,
            'action': action,
            'description': description,
            'risk_level': risk_level
        })
    
    # Assign ERPNext permissions to roles
    # SUPER_ADMIN and OWNER get all ERPNext permissions
    for role_code in ['SUPER_ADMIN', 'OWNER']:
        conn.execute(text("""
            INSERT INTO role_permissions (id, role_id, permission_id)
            SELECT 
                gen_random_uuid(),
                r.id,
                p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.code = :role_code
              AND p.code LIKE 'erpnext:%'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp 
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
        """), {'role_code': role_code})
    
    # ADMIN gets all ERPNext permissions except wildcard delete
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'ADMIN'
          AND p.code LIKE 'erpnext:%'
          AND p.code != :exclude_code
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """), {"exclude_code": "erpnext:*:delete"})
    
    # MANAGER gets view and create permissions for all ERPNext resources
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'MANAGER'
          AND p.code LIKE 'erpnext:%'
          AND (p.action IN ('view', 'create', 'edit'))
          AND p.resource != '*'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # STAFF gets view and create permissions for basic resources
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'STAFF'
          AND p.code LIKE 'erpnext:%'
          AND p.action IN ('view', 'create')
          AND p.resource IN ('item', 'customer', 'sales invoice', 'payment entry')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # INVENTORY_MANAGER gets all warehouse, item, and stock entry permissions
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'INVENTORY_MANAGER'
          AND p.code LIKE 'erpnext:%'
          AND p.resource IN ('warehouse', 'item', 'stock entry')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # SALES_REP gets customer, sales person, and sales invoice permissions
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'SALES_REP'
          AND p.code LIKE 'erpnext:%'
          AND p.resource IN ('customer', 'sales person', 'sales invoice', 'payment entry')
          AND p.action IN ('view', 'create', 'edit')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # VIEWER gets view-only permissions for all ERPNext resources
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'VIEWER'
          AND p.code LIKE 'erpnext:%'
          AND p.action = 'view'
          AND p.resource != '*'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    print("✅ Added 32 ERPNext permissions to RBAC system")
    print("✅ Assigned permissions to 8 roles (SUPER_ADMIN, OWNER, ADMIN, MANAGER, STAFF, INVENTORY_MANAGER, SALES_REP, VIEWER)")


def downgrade() -> None:
    """
    Remove ERPNext permissions from RBAC system.
    """
    conn = op.get_bind()
    
    # Remove role-permission assignments for ERPNext permissions
    conn.execute(text("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions WHERE code LIKE 'erpnext:%'
        )
    """))
    
    # Remove ERPNext permissions
    conn.execute(text("""
        DELETE FROM permissions WHERE code LIKE 'erpnext:%'
    """))
    
    print("✅ Removed ERPNext permissions from RBAC system")
