"""add_pos_permissions

Add POS permissions to RBAC system.
Includes permissions for: POS Profiles, Sessions, Orders, Payments, Receipts, Loyalty, Layaway, Sync, and Analytics.

Revision ID: f7a8b9c0d1e2
Revises: fc75fd1695eb
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid

# revision identifiers, used by Alembic.
revision = 'f7a8b9c0d1e2'
down_revision = 'fc75fd1695eb'  # Latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add POS permissions to RBAC system.
    Includes permissions for POS Profiles, Sessions, Orders, Payments, Receipts, Loyalty, Layaway, Sync, and Analytics.
    """
    conn = op.get_bind()
    
    # POS permissions
    pos_permissions = [
        # POS Profiles (PRM-POS-001 to PRM-POS-004)
        ('PRM-POS-001', 'pos:profiles:view', 'pos', 'profiles', 'view', 
         'View POS profiles', 'LOW'),
        ('PRM-POS-002', 'pos:profiles:create', 'pos', 'profiles', 'create', 
         'Create POS profiles', 'MEDIUM'),
        ('PRM-POS-003', 'pos:profiles:edit', 'pos', 'profiles', 'edit', 
         'Edit POS profiles', 'MEDIUM'),
        ('PRM-POS-004', 'pos:profiles:delete', 'pos', 'profiles', 'delete', 
         'Delete POS profiles', 'HIGH'),
        
        # POS Sessions (PRM-POS-005 to PRM-POS-008)
        ('PRM-POS-005', 'pos:sessions:view', 'pos', 'sessions', 'view', 
         'View POS sessions', 'LOW'),
        ('PRM-POS-006', 'pos:sessions:create', 'pos', 'sessions', 'create', 
         'Open POS sessions', 'MEDIUM'),
        ('PRM-POS-007', 'pos:sessions:close', 'pos', 'sessions', 'close', 
         'Close POS sessions', 'MEDIUM'),
        ('PRM-POS-008', 'pos:sessions:read', 'pos', 'sessions', 'read', 
         'Read POS session details', 'LOW'),
        
        # POS Orders/Invoices (PRM-POS-009 to PRM-POS-012)
        ('PRM-POS-009', 'pos:orders:view', 'pos', 'orders', 'view', 
         'View POS orders', 'LOW'),
        ('PRM-POS-010', 'pos:orders:create', 'pos', 'orders', 'create', 
         'Create POS orders/invoices', 'MEDIUM'),
        ('PRM-POS-011', 'pos:orders:edit', 'pos', 'orders', 'edit', 
         'Edit POS orders', 'MEDIUM'),
        ('PRM-POS-012', 'pos:orders:cancel', 'pos', 'orders', 'cancel', 
         'Cancel POS orders', 'HIGH'),
        
        # POS Payments (PRM-POS-013 to PRM-POS-016)
        ('PRM-POS-013', 'pos:payments:view', 'pos', 'payments', 'view', 
         'View POS payments', 'LOW'),
        ('PRM-POS-014', 'pos:payments:process', 'pos', 'payments', 'process', 
         'Process POS payments', 'HIGH'),
        ('PRM-POS-015', 'pos:payments:refund', 'pos', 'payments', 'refund', 
         'Process refunds', 'HIGH'),
        ('PRM-POS-016', 'pos:payments:mpesa', 'pos', 'payments', 'mpesa', 
         'Process M-Pesa payments', 'HIGH'),
        
        # POS Receipts (PRM-POS-017 to PRM-POS-020)
        ('PRM-POS-017', 'pos:receipts:view', 'pos', 'receipts', 'view', 
         'View POS receipts', 'LOW'),
        ('PRM-POS-018', 'pos:receipts:generate', 'pos', 'receipts', 'generate', 
         'Generate POS receipts', 'LOW'),
        ('PRM-POS-019', 'pos:receipts:print', 'pos', 'receipts', 'print', 
         'Print POS receipts', 'LOW'),
        ('PRM-POS-020', 'pos:receipts:email', 'pos', 'receipts', 'email', 
         'Email POS receipts', 'LOW'),
        
        # POS Loyalty (PRM-POS-021 to PRM-POS-024)
        ('PRM-POS-021', 'pos:loyalty:view', 'pos', 'loyalty', 'view', 
         'View loyalty programs', 'LOW'),
        ('PRM-POS-022', 'pos:loyalty:manage', 'pos', 'loyalty', 'manage', 
         'Manage loyalty programs', 'MEDIUM'),
        ('PRM-POS-023', 'pos:loyalty:points', 'pos', 'loyalty', 'points', 
         'Manage loyalty points', 'MEDIUM'),
        ('PRM-POS-024', 'pos:loyalty:redeem', 'pos', 'loyalty', 'redeem', 
         'Redeem loyalty points', 'MEDIUM'),
        
        # POS Layaway (PRM-POS-025 to PRM-POS-028)
        ('PRM-POS-025', 'pos:layaway:view', 'pos', 'layaway', 'view', 
         'View layaway orders', 'LOW'),
        ('PRM-POS-026', 'pos:layaway:create', 'pos', 'layaway', 'create', 
         'Create layaway orders', 'MEDIUM'),
        ('PRM-POS-027', 'pos:layaway:payments', 'pos', 'layaway', 'payments', 
         'Process layaway payments', 'MEDIUM'),
        ('PRM-POS-028', 'pos:layaway:complete', 'pos', 'layaway', 'complete', 
         'Complete layaway orders', 'MEDIUM'),
        
        # POS Sync (PRM-POS-029 to PRM-POS-032)
        ('PRM-POS-029', 'pos:sync:view', 'pos', 'sync', 'view', 
         'View sync status', 'LOW'),
        ('PRM-POS-030', 'pos:sync:sync', 'pos', 'sync', 'sync', 
         'Sync offline transactions', 'MEDIUM'),
        ('PRM-POS-031', 'pos:sync:resolve', 'pos', 'sync', 'resolve', 
         'Resolve sync conflicts', 'MEDIUM'),
        ('PRM-POS-032', 'pos:sync:status', 'pos', 'sync', 'status', 
         'Check sync status', 'LOW'),
        
        # POS Analytics (PRM-POS-033 to PRM-POS-036)
        ('PRM-POS-033', 'pos:analytics:view', 'pos', 'analytics', 'view', 
         'View POS analytics', 'LOW'),
        ('PRM-POS-034', 'pos:analytics:dashboard', 'pos', 'analytics', 'dashboard', 
         'View POS dashboard', 'LOW'),
        ('PRM-POS-035', 'pos:analytics:reports', 'pos', 'analytics', 'reports', 
         'View POS reports', 'LOW'),
        ('PRM-POS-036', 'pos:analytics:export', 'pos', 'analytics', 'export', 
         'Export POS analytics', 'MEDIUM'),
        
        # POS Quick Actions (PRM-POS-037 to PRM-POS-040)
        ('PRM-POS-037', 'pos:quick_actions:view', 'pos', 'quick_actions', 'view', 
         'View quick actions', 'LOW'),
        ('PRM-POS-038', 'pos:quick_actions:use', 'pos', 'quick_actions', 'use', 
         'Use quick actions', 'LOW'),
        ('PRM-POS-039', 'pos:quick_actions:manage', 'pos', 'quick_actions', 'manage', 
         'Manage quick actions', 'MEDIUM'),
        ('PRM-POS-040', 'pos:quick_actions:presets', 'pos', 'quick_actions', 'presets', 
         'Manage quick sale presets', 'MEDIUM'),
    ]
    
    # Insert permissions
    for perm_code, code, module, resource, action, description, risk_level in pos_permissions:
        perm_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO permissions (id, permission_code, code, module, resource, action, description, risk_level)
            SELECT :id, :perm_code, :code, :module, :resource, :action, :description, :risk_level
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = :code)
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
    
    # Assign POS permissions to roles
    # SUPER_ADMIN and OWNER get all POS permissions
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
              AND p.code LIKE 'pos:%'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp 
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
        """), {'role_code': role_code})
    
    # ADMIN gets all POS permissions except delete
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'ADMIN'
          AND p.code LIKE 'pos:%'
          AND p.action != 'delete'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # MANAGER gets view, create, edit for POS operations
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'MANAGER'
          AND p.code LIKE 'pos:%'
          AND p.action IN ('view', 'create', 'edit', 'read', 'process', 'generate', 'print', 'email', 'sync', 'use')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))
    
    # STAFF gets view and basic operations (create orders, process payments, generate receipts)
    conn.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id)
        SELECT 
            gen_random_uuid(),
            r.id,
            p.id
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.code = 'STAFF'
          AND p.code LIKE 'pos:%'
          AND p.action IN ('view', 'create', 'read', 'process', 'generate', 'print', 'email', 'use', 'sync', 'status')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp 
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
    """))


def downgrade() -> None:
    """
    Remove POS permissions from RBAC system.
    """
    conn = op.get_bind()
    
    # Remove role-permission mappings for POS permissions
    conn.execute(text("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions WHERE code LIKE 'pos:%'
        )
    """))
    
    # Remove POS permissions
    conn.execute(text("""
        DELETE FROM permissions WHERE code LIKE 'pos:%'
    """))
