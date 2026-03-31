"""add user subscription fields

Revision ID: c82d07db3f24
Revises: ff946ab90301
Create Date: 2026-03-31 02:08:35.734990

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c82d07db3f24'
down_revision: Union[str, Sequence[str], None] = 'ff946ab90301'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("subscription_tier", sa.String(length=50), nullable=False, server_default="free"))
    op.add_column("users", sa.Column("subscription_status", sa.String(length=50), nullable=False, server_default="active"))
    op.add_column("users", sa.Column("stripe_customer_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("stripe_subscription_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("subscription_current_period_end", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("trial_ends_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "trial_ends_at")
    op.drop_column("users", "subscription_current_period_end")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "subscription_tier")
