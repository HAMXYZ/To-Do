"""allow one saved weekly review per account and ISO week

Revision ID: 0004_weekly_review_unique
Revises: 0003_task_use_case_fields
Create Date: 2026-11-01
"""
from alembic import op


revision = "0004_weekly_review_unique"
down_revision = "0003_task_use_case_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep the most recently saved review if older data contains duplicates.
    op.execute(
        """
        DELETE FROM weekly_reviews AS older
        USING weekly_reviews AS newer
        WHERE older.user_id = newer.user_id
          AND older.year = newer.year
          AND older.week_number = newer.week_number
          AND older.id < newer.id
        """
    )
    op.create_unique_constraint(
        "uq_weekly_reviews_user_year_week",
        "weekly_reviews",
        ["user_id", "year", "week_number"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_weekly_reviews_user_year_week", "weekly_reviews", type_="unique"
    )
