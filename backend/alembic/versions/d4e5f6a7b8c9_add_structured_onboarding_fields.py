"""add structured onboarding fields to consultant_profiles

Revision ID: d4e5f6a7b8c9
Revises: 8e4f4a6b12d1
Create Date: 2026-04-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "8e4f4a6b12d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make legacy NOT NULL columns nullable so step-by-step onboarding can
    # create a profile before these fields are populated.
    op.alter_column("consultant_profiles", "raw_inputs", nullable=True)
    op.alter_column("consultant_profiles", "service_offerings", nullable=True)
    op.alter_column("consultant_profiles", "ideal_client_profile", nullable=True)
    op.alter_column("consultant_profiles", "value_proposition", nullable=True)

    # Add new structured onboarding columns
    op.add_column("consultant_profiles", sa.Column("full_name", sa.String(255), nullable=True))
    op.add_column("consultant_profiles", sa.Column("professional_title", sa.String(255), nullable=True))
    op.add_column("consultant_profiles", sa.Column("years_of_experience", sa.Integer(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("professional_background", sa.Text(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("previous_employers", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("education", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("certifications", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("industries_of_expertise", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("industries_of_interest", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("consulting_areas", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("target_client_type", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("unique_value_proposition", sa.Text(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("past_engagement_types", sa.JSON(), nullable=True))
    op.add_column("consultant_profiles", sa.Column("typical_engagement_length", sa.String(100), nullable=True))
    op.add_column("consultant_profiles", sa.Column("rate_range", sa.String(100), nullable=True))
    op.add_column(
        "consultant_profiles",
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("consultant_profiles", "onboarding_completed")
    op.drop_column("consultant_profiles", "rate_range")
    op.drop_column("consultant_profiles", "typical_engagement_length")
    op.drop_column("consultant_profiles", "past_engagement_types")
    op.drop_column("consultant_profiles", "unique_value_proposition")
    op.drop_column("consultant_profiles", "target_client_type")
    op.drop_column("consultant_profiles", "consulting_areas")
    op.drop_column("consultant_profiles", "industries_of_interest")
    op.drop_column("consultant_profiles", "industries_of_expertise")
    op.drop_column("consultant_profiles", "certifications")
    op.drop_column("consultant_profiles", "education")
    op.drop_column("consultant_profiles", "previous_employers")
    op.drop_column("consultant_profiles", "professional_background")
    op.drop_column("consultant_profiles", "years_of_experience")
    op.drop_column("consultant_profiles", "professional_title")
    op.drop_column("consultant_profiles", "full_name")
    op.alter_column("consultant_profiles", "value_proposition", nullable=False)
    op.alter_column("consultant_profiles", "ideal_client_profile", nullable=False)
    op.alter_column("consultant_profiles", "service_offerings", nullable=False)
    op.alter_column("consultant_profiles", "raw_inputs", nullable=False)
