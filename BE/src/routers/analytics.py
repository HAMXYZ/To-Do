from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.analytics_schemas import HeatmapOut
from src.db import get_session
from src.deps import get_current_user
from src.habit_utils import days_list, round_half_up, scheduled_days
from src.models import Habit, HabitLog, User

router = APIRouter(prefix="/habits", tags=["analytics"])


def _local_date(dt) -> date:
    return dt.astimezone(config.APP_TZ).date()


@router.get("/heatmap", response_model=HeatmapOut)
async def habit_heatmap(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Heatmap cả năm cho từng habit, tính từ ngày tạo habit (Câu 74).
    Habit đã xóa chỉ hiện nếu có lịch sử hoàn thành trong năm đó (is_deleted = true)."""
    today = config.today()
    year = year or today.year
    jan1, dec31 = date(year, 1, 1), date(year, 12, 31)

    all_habits = list(
        (await session.scalars(select(Habit).where(Habit.user_id == user.id).order_by(Habit.id))).all()
    )
    done_by_habit: dict[int, set[date]] = {}
    if all_habits:
        logs = await session.scalars(
            select(HabitLog).where(
                HabitLog.habit_id.in_([h.id for h in all_habits]),
                HabitLog.date >= jan1,
                HabitLog.date <= dec31,
                HabitLog.is_completed.is_(True),
            )
        )
        for lg in logs:
            done_by_habit.setdefault(lg.habit_id, set()).add(lg.date)

    # Habit tạo sau năm đang xem thì chưa tồn tại ở năm đó; habit đã xóa chỉ hiện nếu có lịch sử
    rows = [
        h
        for h in all_habits
        if _local_date(h.created_at) <= dec31 and (h.deleted_at is None or done_by_habit.get(h.id))
    ]
    first_year = min((_local_date(h.created_at).year for h in all_habits), default=today.year)
    available_years = list(range(min(first_year, today.year), today.year + 1))

    n_days = (dec31 - jan1).days + 1
    out_habits = []
    total_sched = total_done = 0
    for h in rows:
        created = _local_date(h.created_at)
        start = max(jan1, created)
        end = min(dec31, today)
        if h.deleted_at is not None:
            end = min(end, _local_date(h.deleted_at))
        sched = scheduled_days(h)
        done = done_by_habit.get(h.id, set())
        cells = []
        scheduled_count = done_count = 0
        for i in range(n_days):
            d = jan1 + timedelta(days=i)
            tracked = start <= d <= end and d.weekday() in sched
            if d in done:
                cells.append(2)
            elif tracked and d < today:
                cells.append(1)
            else:
                cells.append(0)
            # Hôm nay chỉ tính vào phần trăm khi đã xong (ngày chưa kết thúc thì không phạt)
            if tracked and (d < today or d in done):
                scheduled_count += 1
                if d in done:
                    done_count += 1
        total_sched += scheduled_count
        total_done += done_count
        out_habits.append(
            {
                "id": h.id,
                "title": h.title,
                "frequency": h.frequency,
                "days": days_list(h),
                "time": h.preferred_time.strftime("%H:%M") if h.preferred_time else "",
                "is_active": h.is_active,
                "is_deleted": h.deleted_at is not None,
                "created_date": created,
                "scheduled_count": scheduled_count,
                "done_count": done_count,
                "percent": round_half_up(done_count / scheduled_count * 100) if scheduled_count else 0,
                "cells": cells,
            }
        )

    days_tracked = 0
    if rows:
        s = max(jan1, min(_local_date(h.created_at) for h in rows))
        e = min(dec31, today)
        days_tracked = max(0, (e - s).days + 1)

    return {
        "year": year,
        "start_date": jan1,
        "end_date": dec31,
        "today": today,
        "available_years": available_years,
        "days_tracked": days_tracked,
        "habit_count": sum(1 for h in rows if h.deleted_at is None),
        "consistency": round_half_up(total_done / total_sched * 100) if total_sched else 0,
        "habits": out_habits,
    }
