"""add pipeline fields to leads

Revision ID: 41d335b66fd2
Revises: 2dc936807817
Create Date: 2026-03-31 01:34:01.019078

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41d335b66fd2'
down_revision: Union[str, Sequence[str], None] = '2dc936807817'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "leads",
        sa.Column(
            "pipeline_stage",
            sa.String(length=50),
            nullable=False,
            server_default="Identified",
        ),
    )
    op.add_column("leads", sa.Column("deal_value", sa.Float(), nullable=True))
    op.add_column("leads", sa.Column("expected_close_date", sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("leads", "expected_close_date")
    op.drop_column("leads", "deal_value")
    op.drop_column("leads", "pipeline_stage")
