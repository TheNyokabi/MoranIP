"""migrate_existing_users_to_rbac

Revision ID: dbd206ea3325
Revises: 284d95fe809d
Create Date: 2026-01-06 06:04:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import UUID, TIMESTAMP, select
import uuid

# revision identifiers, used by Alembic.
revision: str = 'dbd206ea3325'
down_revision: Union[str, None] = '284d95fe809d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Migrate existing users to RBAC system:
    1. Find tenant creators and assign OWNER role
    2. Assign ADMIN role to existing active memberships (temporary)
    3. Create audit log entries for automatic assignments
    """
    
    # Get database connection
    conn = op.get_bind()
    
    # Define table references
    tenants_table = table('tenants',
        column('id', UUID),
        column('created_at', TIMESTAMP)
    )
    
    memberships_table = table('memberships',
        column('id', UUID),
        column('user_id', UUID),
        column('tenant_id', UUID),
        column('status', sa.String),
        column('primary_role_id', UUID)
    )
    
    user_roles_table = table('user_roles',
        column('id', UUID),
        column('user_id', UUID),
        column('tenant_id', UUID),
        column('role_id', UUID),
        column('assigned_by', UUID),
        column('is_active', sa.Boolean)
    )
    
    role_audit_log_table = table('role_audit_log',
        column('id', UUID),
        column('user_id', UUID),
        column('tenant_id', UUID),
        column('action', sa.String),
        column('target_user_id', UUID),
        column('role_id', UUID),
        column('metadata', sa.JSON)
    )
    
    # Get OWNER and ADMIN role IDs
    owner_role = conn.execute(sa.text("SELECT id FROM roles WHERE code = 'OWNER'")).fetchone()
    admin_role = conn.execute(sa.text("SELECT id FROM roles WHERE code = 'ADMIN'")).fetchone()
    
    if not owner_role or not admin_role:
        print("Warning: OWNER or ADMIN role not found. Skipping user migration.")
        return
    
    owner_role_id = owner_role[0]
    admin_role_id = admin_role[0]
    
    # Find all tenants and their first membership (likely the creator)
    tenants_query = sa.text("""
        SELECT DISTINCT ON (t.id) 
            t.id as tenant_id, 
            m.user_id as creator_user_id,
            m.id as membership_id
        FROM tenants t
        LEFT JOIN memberships m ON m.tenant_id = t.id
        WHERE m.status = 'ACTIVE'
        ORDER BY t.id, m.joined_at ASC NULLS LAST, m.id ASC
    """)
    
    tenants_with_creators = conn.execute(tenants_query).fetchall()
    
    user_role_assignments = []
    audit_log_entries = []
    membership_updates = []
    
    for tenant_id, creator_user_id, membership_id in tenants_with_creators:
        if creator_user_id:
            # Assign OWNER role to tenant creator
            user_role_id = uuid.uuid4()
            user_role_assignments.append({
                'id': user_role_id,
                'user_id': creator_user_id,
                'tenant_id': tenant_id,
                'role_id': owner_role_id,
                'assigned_by': creator_user_id,  # Self-assigned
                'is_active': True
            })
            
            # Update membership primary_role_id
            membership_updates.append({
                'membership_id': membership_id,
                'primary_role_id': owner_role_id
            })
            
            # Create audit log entry
            audit_log_entries.append({
                'id': uuid.uuid4(),
                'user_id': creator_user_id,
                'tenant_id': tenant_id,
                'action': 'ROLE_ASSIGNED',
                'target_user_id': creator_user_id,
                'role_id': owner_role_id,
                'metadata': sa.text("'{\"reason\": \"Automatic migration - tenant creator\", \"migration\": true}'::jsonb")
            })
    
    # Find all other active memberships and assign ADMIN role
    other_memberships_query = sa.text("""
        SELECT m.id as membership_id, m.user_id, m.tenant_id
        FROM memberships m
        WHERE m.status = 'ACTIVE'
        AND m.id NOT IN :creator_membership_ids
    """)
    
    creator_membership_ids = tuple([m['membership_id'] for m in membership_updates]) if membership_updates else (None,)
    other_memberships = conn.execute(other_memberships_query, {'creator_membership_ids': creator_membership_ids}).fetchall()
    
    for membership_id, user_id, tenant_id in other_memberships:
        # Assign ADMIN role to other active members
        user_role_id = uuid.uuid4()
        user_role_assignments.append({
            'id': user_role_id,
            'user_id': user_id,
            'tenant_id': tenant_id,
            'role_id': admin_role_id,
            'assigned_by': None,  # System assigned
            'is_active': True
        })
        
        # Update membership primary_role_id
        membership_updates.append({
            'membership_id': membership_id,
            'primary_role_id': admin_role_id
        })
        
        # Create audit log entry
        audit_log_entries.append({
            'id': uuid.uuid4(),
            'user_id': None,  # System action
            'tenant_id': tenant_id,
            'action': 'ROLE_ASSIGNED',
            'target_user_id': user_id,
            'role_id': admin_role_id,
            'metadata': sa.text("'{\"reason\": \"Automatic migration - existing member\", \"migration\": true}'::jsonb")
        })
    
    # Bulk insert user role assignments
    if user_role_assignments:
        op.bulk_insert(user_roles_table, user_role_assignments)
    
    # Update memberships with primary_role_id
    for update in membership_updates:
        conn.execute(
            sa.text("UPDATE memberships SET primary_role_id = :role_id WHERE id = :membership_id"),
            {'role_id': update['primary_role_id'], 'membership_id': update['membership_id']}
        )
    
    # Bulk insert audit log entries
    if audit_log_entries:
        op.bulk_insert(role_audit_log_table, audit_log_entries)
    
    print(f"Migration complete: Assigned OWNER to {len([a for a in user_role_assignments if a['role_id'] == owner_role_id])} users")
    print(f"Migration complete: Assigned ADMIN to {len([a for a in user_role_assignments if a['role_id'] == admin_role_id])} users")


def downgrade() -> None:
    """
    Remove automatically assigned roles and audit logs
    """
    # Remove audit logs from migration
    op.execute("DELETE FROM role_audit_log WHERE metadata->>'migration' = 'true'")
    
    # Remove user role assignments (keep manual assignments)
    op.execute("""
        DELETE FROM user_roles 
        WHERE id IN (
            SELECT ur.id FROM user_roles ur
            JOIN role_audit_log ral ON ral.target_user_id = ur.user_id 
                AND ral.role_id = ur.role_id 
                AND ral.tenant_id = ur.tenant_id
            WHERE ral.metadata->>'migration' = 'true'
        )
    """)
    
    # Clear primary_role_id from memberships
    op.execute("UPDATE memberships SET primary_role_id = NULL")
