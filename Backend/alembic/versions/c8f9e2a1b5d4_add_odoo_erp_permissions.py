"""add_odoo_erp_permissions

Revision ID: c8f9e2a1b5d4
Revises: b4dab048844d
Create Date: 2026-01-06 12:37:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid

# revision identifiers, used by Alembic.
revision = 'c8f9e2a1b5d4'
down_revision = 'b4dab048844d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add Odoo and ERP permissions to RBAC system.
    """
    conn = op.get_bind()
    
    # Odoo and ERP permissions
    new_permissions = [
        # Odoo Engine Permissions (PRM-ODO-001 to PRM-ODO-002)
        ('PRM-ODO-001', 'odoo:system:auth', 'odoo', 'system', 'auth', 
         'Authenticate with Odoo engine', 'MEDIUM'),
        ('PRM-ODO-002', 'odoo:*:admin', 'odoo', '*', 'admin', 
         'Full Odoo admin access (direct engine access)', 'CRITICAL'),
        
        # ERP Domain Permissions (PRM-ERP-033 to PRM-ERP-036)
        ('PRM-ERP-033', 'erp:partners:view', 'erp', 'partners', 'view', 
         'View business partners', 'LOW'),
        ('PRM-ERP-034', 'erp:partners:create', 'erp', 'partners', 'create', 
         'Create business partners', 'MEDIUM'),
        ('PRM-ERP-035', 'erp:partners:edit', 'erp', 'partners', 'edit', 
         'Edit business partners', 'MEDIUM'),
        ('PRM-ERP-036', 'erp:partners:delete', 'erp', 'partners', 'delete', 
         'Delete business partners', 'HIGH'),
    ]
    
    # Insert permissions
    for perm_code, code, module, resource, action, description, risk_level in new_permissions:
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
    
    # Assign Odoo permissions
    # SUPER_ADMIN gets all Odoo permissions
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'SUPER_ADMIN'
          AND p.code LIKE 'odoo:%'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # ADMIN gets odoo:system:auth only (not full admin access)
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'ADMIN'
          AND p.code = 'odoo:system:auth'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # Assign ERP partner permissions to roles
    # SUPER_ADMIN, OWNER, ADMIN get all ERP partner permissions
    for role_code in ['SUPER_ADMIN', 'OWNER', 'ADMIN']:
        conn.execute(text("""
            INSERT INTO role_permissions (id, role_id, permission_id)
            SELECT 
                gen_random_uuid(),
                r.id,
                p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.code = :role_code
              AND p.code LIKE 'erp:partners:%'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp 
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
        """), {'role_code': role_code})
    
    # MANAGER gets view, create, edit
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'MANAGER'
          AND p.code LIKE 'erp:partners:%'
          AND p.action IN ('view', 'create', 'edit')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # STAFF and SALES_REP get view and create
    for role_code in ['STAFF', 'SALES_REP']:
        conn.execute(text("""
            INSERT INTO role_permissions (id, role_id, permission_id)
            SELECT 
                gen_random_uuid(),
                r.id,
                p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.code = :role_code
              AND p.code LIKE 'erp:partners:%'
              AND p.action IN ('view', 'create')
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp 
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
        """), {'role_code': role_code})
    
    # VIEWER gets view only
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'VIEWER'
          AND p.code = 'erp:partners:view'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    print("✅ Added 6 Odoo/ERP permissions to RBAC system")
    print("✅ Assigned permissions to roles")


def downgrade() -> None:
    """
    Remove Odoo and ERP permissions from RBAC system.
    """
    conn = op.get_bind()
    
    # Remove role-permission assignments
    conn.execute(text("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions WHERE code LIKE 'odoo:%' OR code LIKE 'erp:partners:%'
        )
    """))
    
    # Remove permissions
    conn.execute(text("""
        DELETE FROM permissions WHERE code LIKE 'odoo:%' OR code LIKE 'erp:partners:%'
    """))
    
    print("✅ Removed Odoo/ERP permissions from RBAC system")
