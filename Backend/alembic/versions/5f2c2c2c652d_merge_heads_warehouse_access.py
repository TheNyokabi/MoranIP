"""merge_heads_warehouse_access

Revision ID: 5f2c2c2c652d
Revises: add_pos_permissions, add_user_preferences, test_user_seed, c5f57ad6e1a2
Create Date: 2026-01-21 11:57:06.290642

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f2c2c2c652d'
down_revision: Union[str, None] = ('add_pos_permissions', 'add_user_preferences', 'test_user_seed', 'c5f57ad6e1a2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
