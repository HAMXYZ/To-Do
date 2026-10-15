from __future__ import annotations

from datetime import date as date_type
from datetime import datetime, time, timezone
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLAlchemyEnum, ForeignKey
from sqlalchemy import Index, Integer, String, Text, Time, UniqueConstraint, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class HabitFrequency(str, Enum):
    DAILY = "daily"
    WEEKDAYS = "weekdays"
    CUSTOM = "custom"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    # Cài đặt nhắc nhở (Câu 56, 57)
    reminder_time: Mapped[time] = mapped_column(
        Time, default=time(20, 0), server_default=text("'20:00:00'"), nullable=False
    )
    # Số phút nhắc trước due_time: 5/10/15/30, NULL = tắt
    reminder_lead_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, default=15, server_default=text("15"), nullable=True
    )

    tasks: Mapped[List[Task]] = relationship(back_populates="user")
    habits: Mapped[List[Habit]] = relationship(back_populates="user")
    weekly_reviews: Mapped[List[WeeklyReview]] = relationship(back_populates="user")


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        # Mỗi habit chỉ sinh tối đa 1 task cho mỗi ngày gốc (NULL không bị tính trùng)
        UniqueConstraint("habit_id", "habit_date", name="uq_tasks_habit_id_habit_date"),
        Index("ix_tasks_user_id_due_date", "user_id", "due_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[date_type] = mapped_column(Date, nullable=False)
    due_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Xóa vĩnh viễn kiểu "giữ dấu vết" cho task sinh từ habit (Câu 13)
    purged_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Lần cuối người dùng sửa nội dung task (Câu 22)
    user_modified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    parent_task_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Liên kết với habit sinh ra task (Câu 10, 20)
    habit_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("habits.id"), nullable=True, index=True
    )
    habit_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)

    user: Mapped[User] = relationship(back_populates="tasks")
    parent_task: Mapped[Optional[Task]] = relationship(
        back_populates="subtasks", remote_side="Task.id"
    )
    subtasks: Mapped[List[Task]] = relationship(back_populates="parent_task")
    habit: Mapped[Optional[Habit]] = relationship(back_populates="tasks")


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    frequency: Mapped[HabitFrequency] = mapped_column(
        SQLAlchemyEnum(
            HabitFrequency,
            name="habit_frequency",
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        default=HabitFrequency.DAILY,
        nullable=False,
    )
    # Chuỗi số "0,2,4" (0 = thứ Hai ... 6 = Chủ nhật), chỉ dùng khi frequency = custom
    custom_days: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    preferred_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_create_task: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    # Xóa mềm: khác với tạm dừng (is_active = false) (Câu 36)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Mốc bắt đầu tính phần trăm trong heatmap (Câu 74)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="habits")
    logs: Mapped[List[HabitLog]] = relationship(back_populates="habit")
    tasks: Mapped[List[Task]] = relationship(back_populates="habit")


class HabitLog(Base):
    __tablename__ = "habit_logs"
    __table_args__ = (
        UniqueConstraint("habit_id", "date", name="uq_habit_logs_habit_id_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id"), nullable=False, index=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    habit: Mapped[Habit] = relationship(back_populates="logs")


class WeeklyReview(Base):
    __tablename__ = "weekly_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    completion_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="weekly_reviews")
