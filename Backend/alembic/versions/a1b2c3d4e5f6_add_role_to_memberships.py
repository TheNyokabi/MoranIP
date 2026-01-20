"""add role to memberships

Revision ID: a1b2c3d4e5f6
Revises: fc75fd1695eb
Create Date: 2026-01-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0928f53cdc52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add role column with default 'CASHIER'
    op.add_column('memberships', sa.Column('role', sa.String(30), nullable=True))
    
    # Set existing memberships to ADMIN (since they were likely creators)
    op.execute("UPDATE memberships SET role = 'ADMIN' WHERE role IS NULL")
    
    # Make column not nullable after setting defaults
    op.alter_column('memberships', 'role', nullable=False, server_default='CASHIER')


def downgrade() -> None:
    op.drop_column('memberships', 'role')
