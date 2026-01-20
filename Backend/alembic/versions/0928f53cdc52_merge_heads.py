"""merge_heads

Revision ID: 0928f53cdc52
Revises: 794ec45f5bf5, c8f9e2a1b5d4
Create Date: 2026-01-06 10:35:22.803692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0928f53cdc52'
down_revision: Union[str, None] = ('794ec45f5bf5', 'c8f9e2a1b5d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
