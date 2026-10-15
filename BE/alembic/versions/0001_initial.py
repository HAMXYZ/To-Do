"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reminder_time", sa.Time(), nullable=False, server_default=sa.text("'20:00:00'")),
        sa.Column("reminder_lead_minutes", sa.Integer(), nullable=True, server_default=sa.text("15")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "habits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column(
            "frequency",
            sa.Enum("daily", "weekdays", "custom", name="habit_frequency"),
            nullable=False,
        ),
        sa.Column("custom_days", sa.String(), nullable=True),
        sa.Column("preferred_time", sa.Time(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("auto_create_task", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_habits_user_id", "habits", ["user_id"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("due_time", sa.Time(), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_starred", sa.Boolean(), nullable=False),
        sa.Column("is_ai_generated", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("purged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "parent_task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("habit_id", sa.Integer(), sa.ForeignKey("habits.id"), nullable=True),
        sa.Column("habit_date", sa.Date(), nullable=True),
        sa.UniqueConstraint("habit_id", "habit_date", name="uq_tasks_habit_id_habit_date"),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_parent_task_id", "tasks", ["parent_task_id"])
    op.create_index("ix_tasks_habit_id", "tasks", ["habit_id"])
    op.create_index("ix_tasks_user_id_due_date", "tasks", ["user_id", "due_date"])

    op.create_table(
        "habit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("habit_id", sa.Integer(), sa.ForeignKey("habits.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_completed", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("habit_id", "date", name="uq_habit_logs_habit_id_date"),
    )
    op.create_index("ix_habit_logs_habit_id", "habit_logs", ["habit_id"])

    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column("completion_rate", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_weekly_reviews_user_id", "weekly_reviews", ["user_id"])


def downgrade() -> None:
    op.drop_table("weekly_reviews")
    op.drop_table("habit_logs")
    op.drop_table("tasks")
    op.drop_table("habits")
    op.drop_table("users")
    sa.Enum(name="habit_frequency").drop(op.get_bind(), checkfirst=True)
