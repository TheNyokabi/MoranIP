"""add_membership_invitation_columns

Revision ID: 6d2a4f8c9b01
Revises: 5f2c2c2c652d
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "6d2a4f8c9b01"
down_revision = "5f2c2c2c652d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    invitation_exists = conn.execute(sa.text("SELECT to_regclass('public.memberships')")).scalar()
    if not invitation_exists:
        return

    columns = {
        row[0]
        for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'memberships'"
            )
        )
    }

    if "invitation_code" not in columns:
        op.add_column("memberships", sa.Column("invitation_code", sa.String(length=64), nullable=True))
        op.create_unique_constraint("uq_memberships_invitation_code", "memberships", ["invitation_code"])
    if "invited_at" not in columns:
        op.add_column("memberships", sa.Column("invited_at", sa.TIMESTAMP(timezone=True), nullable=True))
    if "joined_at" not in columns:
        op.add_column("memberships", sa.Column("joined_at", sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    table_exists = conn.execute(sa.text("SELECT to_regclass('public.memberships')")).scalar()
    if not table_exists:
        return

    columns = {
        row[0]
        for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'memberships'"
            )
        )
    }

    if "joined_at" in columns:
        op.drop_column("memberships", "joined_at")
    if "invited_at" in columns:
        op.drop_column("memberships", "invited_at")
    if "invitation_code" in columns:
        op.drop_constraint("uq_memberships_invitation_code", "memberships", type_="unique")
        op.drop_column("memberships", "invitation_code")
