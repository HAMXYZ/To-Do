"""add task creation fields, categories, and request idempotency

Revision ID: 0003_task_use_case_fields
Revises: 0002_habit_created_at
Create Date: 2026-11-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_task_use_case_fields"
down_revision = "0002_habit_created_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    task_priority_enum = postgresql.ENUM(
        "high", "medium", "low", name="task_priority"
    )
    task_priority_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("normalized_name", sa.String(length=100), nullable=False),
        sa.UniqueConstraint(
            "user_id", "normalized_name", name="uq_categories_user_normalized_name"
        ),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])

    op.add_column("tasks", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("tasks", sa.Column("estimated_minutes", sa.Integer(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column(
            "priority",
            postgresql.ENUM(
                "high", "medium", "low", name="task_priority", create_type=False
            ),
            nullable=False,
            server_default="medium",
        ),
    )
    op.add_column("tasks", sa.Column("category_id", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("create_request_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_tasks_category_id_categories",
        "tasks",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tasks_category_id", "tasks", ["category_id"])
    op.create_unique_constraint(
        "uq_tasks_user_create_request_id", "tasks", ["user_id", "create_request_id"]
    )

    # Preserve the old due-date/time meaning for existing rows. New rows may omit a deadline.
    op.execute(
        """
        UPDATE tasks
        SET deadline_at = (
            (due_date + COALESCE(due_time, TIME '23:59:59'))
            AT TIME ZONE 'Asia/Ho_Chi_Minh'
        )
        """
    )


def downgrade() -> None:
    op.drop_constraint("uq_tasks_user_create_request_id", "tasks", type_="unique")
    op.drop_index("ix_tasks_category_id", table_name="tasks")
    op.drop_constraint("fk_tasks_category_id_categories", "tasks", type_="foreignkey")
    op.drop_column("tasks", "create_request_id")
    op.drop_column("tasks", "category_id")
    op.drop_column("tasks", "priority")
    op.drop_column("tasks", "estimated_minutes")
    op.drop_column("tasks", "deadline_at")
    op.drop_column("tasks", "description")
    postgresql.ENUM("high", "medium", "low", name="task_priority").drop(
        op.get_bind(), checkfirst=True
    )
    op.drop_index("ix_categories_user_id", table_name="categories")
    op.drop_table("categories")
