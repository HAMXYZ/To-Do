from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.db import get_session
from src.deps import get_current_user
from src.habit_utils import scheduled_days
from src.models import Habit, HabitLog, Task, User
from src.reminder_schemas import RemindersOut
from src.routers.tasks import _active

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=RemindersOut)
async def get_reminders(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Dữ liệu cho Electron quyết định có hiện toast không. Chỉ đọc.
    BE chỉ cung cấp dữ liệu; việc nhắc đúng lúc và nhớ đã nhắc do app desktop làm."""
    now_local = datetime.now(config.APP_TZ)
    today = now_local.date()
    now_min = now_local.time().replace(second=0, microsecond=0)

    tasks = list(
        (
            await session.scalars(
                select(Task).where(
                    *_active(user), Task.due_date == today, Task.is_completed.is_(False)
                )
            )
        ).all()
    )
    upcoming = []
    for t in sorted((t for t in tasks if t.due_time is not None), key=lambda t: (t.due_time, t.id)):
        if t.due_time < now_min:
            continue  # đã qua giờ thì không nhắc
        due = datetime.combine(today, t.due_time, tzinfo=config.APP_TZ)
        upcoming.append(
            {
                "id": t.id,
                "title": t.title,
                "time": t.due_time.strftime("%H:%M"),
                "minutes_until": max(0, int((due - now_local).total_seconds() // 60)),
                "habit_id": t.habit_id,
            }
        )

    # Habit tắt auto_task thì không có task, nên đếm riêng theo HabitLog hôm nay
    habits = (
        await session.scalars(
            select(Habit).where(
                Habit.user_id == user.id,
                Habit.is_active.is_(True),
                Habit.deleted_at.is_(None),
                Habit.auto_create_task.is_(False),
            )
        )
    ).all()
    due_habits = [h for h in habits if today.weekday() in scheduled_days(h)]
    pending_habits = 0
    if due_habits:
        done_ids = set(
            await session.scalars(
                select(HabitLog.habit_id).where(
                    HabitLog.habit_id.in_([h.id for h in due_habits]),
                    HabitLog.date == today,
                    HabitLog.is_completed.is_(True),
                )
            )
        )
        pending_habits = sum(1 for h in due_habits if h.id not in done_ids)

    return {
        "today": today,
        "now": datetime.now(timezone.utc),
        "reminder_time": user.reminder_time.strftime("%H:%M"),
        "reminder_lead_minutes": user.reminder_lead_minutes,
        "pending_tasks": len(tasks),
        "pending_habits": pending_habits,
        "upcoming": upcoming,
    }
