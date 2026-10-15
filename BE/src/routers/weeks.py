from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.db import get_session
from src.deps import get_current_user
from src.habit_utils import round_half_up, week_progress
from src.models import Habit, Task, User
from src.routers.habits import HabitOut, _habit_out
from src.routers.tasks import _active, _order, _outs

router = APIRouter(prefix="/weeks", tags=["weeks"])


# ---------- Schemas ----------

class DayStat(BaseModel):
    day: int
    date: date
    total: int
    done: int
    percent: int


class WeekStats(BaseModel):
    total: int
    done: int
    percent: int


class HabitWeekOut(HabitOut):
    scheduled: list[bool]
    logs: list[bool]
    done_count: int
    scheduled_count: int
    progress: int


class WeekResponse(BaseModel):
    iso_year: int
    iso_week: int
    start_date: date
    end_date: date
    today: date
    tasks: list[dict[str, Any]]
    days: list[DayStat]
    stats: WeekStats
    habits: list[HabitWeekOut]


# ---------- Endpoints ----------

@router.get("/{iso_year}/{iso_week}", response_model=WeekResponse)
async def get_week(
    iso_year: int = Path(..., ge=2000, le=2100),
    iso_week: int = Path(..., ge=1, le=53),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Lấy dữ liệu toàn bộ của một tuần ISO: tasks, thống kê 7 ngày, thống kê tuần, habits kèm log & tiến độ."""
    try:
        monday = date.fromisocalendar(iso_year, iso_week, 1)
    except ValueError:
        raise HTTPException(422, "Tuần ISO không hợp lệ")

    sunday = monday + timedelta(days=6)
    week_dates = [monday + timedelta(days=i) for i in range(7)]
    today = config.today()

    # 1. Lấy tất cả task trong tuần (không gồm subtask riêng, rác, purge)
    tasks = list(
        (
            await session.scalars(
                select(Task)
                .where(
                    *_active(user),
                    Task.due_date >= monday,
                    Task.due_date <= sunday,
                )
                .order_by(*_order())
            )
        ).all()
    )
    tasks_out = await _outs(session, tasks)

    # 2. Thống kê từng ngày (0 = thứ Hai ... 6 = Chủ Nhật)
    days_stats: list[DayStat] = []
    total_week = len(tasks)
    done_week = sum(1 for t in tasks if t.is_completed)

    for i, d in enumerate(week_dates):
        day_tasks = [t for t in tasks if t.due_date == d]
        d_total = len(day_tasks)
        d_done = sum(1 for t in day_tasks if t.is_completed)
        d_percent = round_half_up(d_done / d_total * 100) if d_total else 0
        days_stats.append(
            DayStat(
                day=i,
                date=d,
                total=d_total,
                done=d_done,
                percent=d_percent,
            )
        )

    week_percent = round_half_up(done_week / total_week * 100) if total_week else 0
    weekly_stats = WeekStats(
        total=total_week,
        done=done_week,
        percent=week_percent,
    )

    # 3. Lấy các habit đang hoạt động (chưa bị xóa)
    habits = list(
        (
            await session.scalars(
                select(Habit)
                .where(
                    Habit.user_id == user.id,
                    Habit.deleted_at.is_(None),
                    Habit.is_active.is_(True),
                )
                .order_by(Habit.id)
            )
        ).all()
    )

    habits_out: list[HabitWeekOut] = []
    for h in habits:
        prog = await week_progress(session, h, week_dates, today)
        base_h = _habit_out(h)
        habits_out.append(
            HabitWeekOut(
                **base_h,
                scheduled=prog["scheduled"],
                logs=prog["logs"],
                done_count=prog["done_count"],
                scheduled_count=prog["scheduled_count"],
                progress=prog["progress"],
            )
        )

    return WeekResponse(
        iso_year=iso_year,
        iso_week=iso_week,
        start_date=monday,
        end_date=sunday,
        today=today,
        tasks=tasks_out,
        days=days_stats,
        stats=weekly_stats,
        habits=habits_out,
    )
