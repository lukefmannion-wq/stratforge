"""create pipeline_events table

Revision ID: ff946ab90301
Revises: 41d335b66fd2
Create Date: 2026-03-31 01:34:04.440774

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff946ab90301'
down_revision: Union[str, Sequence[str], None] = '41d335b66fd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "pipeline_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("from_stage", sa.String(length=50), nullable=True),
        sa.Column("to_stage", sa.String(length=50), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_pipeline_events_user_id", "pipeline_events", ["user_id"])
    op.create_index("ix_pipeline_events_lead_id", "pipeline_events", ["lead_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_pipeline_events_lead_id", table_name="pipeline_events")
    op.drop_index("ix_pipeline_events_user_id", table_name="pipeline_events")
    op.drop_table("pipeline_events")
