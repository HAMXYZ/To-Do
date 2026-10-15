"""add habits.created_at

Revision ID: 0002_habit_created_at
Revises: 0001_initial
Create Date: 2026-10-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_habit_created_at"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Habit đã có sẵn sẽ lấy thời điểm chạy migration làm ngày tạo
    op.add_column(
        "habits",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("habits", "created_at")
