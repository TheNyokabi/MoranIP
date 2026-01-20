"""merge_erp_modules_head

Revision ID: 5c7ba338aa55
Revises: a1b2c3d4e5f6, df7029d6841d
Create Date: 2026-01-06 11:55:23.622662

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c7ba338aa55'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'df7029d6841d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
