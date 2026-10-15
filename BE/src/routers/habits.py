from datetime import date
from datetime import time as time_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.db import get_session
from src.deps import get_current_user
from src.habit_logs import upsert_log
from src.habit_utils import (
    cleanup_on_delete,
    cleanup_on_schedule_change,
    cleanup_on_time_change,
    cleanup_on_title_change,
    days_list,
    generate_habit_tasks,
    normalize_habit_fields,
    scheduled_days,
)
from src.models import Habit, HabitFrequency, HabitLog, Task, User, utc_now
from src.routers.tasks import _active, _out, _parse_time, _steps_for

router = APIRouter(prefix="/habits", tags=["habits"])


# ---------- Schemas ----------

class HabitCreate(BaseModel):
    title: str
    frequency: HabitFrequency = HabitFrequency.DAILY
    days: Optional[list[int]] = None
    time: Optional[str] = None
    auto_task: Optional[bool] = Field(default=True)
    is_active: Optional[bool] = Field(default=True)


class HabitPatch(BaseModel):
    title: Optional[str] = None
    frequency: Optional[HabitFrequency] = None
    days: Optional[list[int]] = None
    time: Optional[str] = None
    auto_task: Optional[bool] = None
    is_active: Optional[bool] = None


class HabitOut(BaseModel):
    id: int
    title: str
    frequency: HabitFrequency
    days: list[int]
    time: str
    auto_task: bool
    is_active: bool


class GenerateIn(BaseModel):
    iso_year: int = Field(ge=2000, le=2100)
    iso_week: int = Field(ge=1, le=53)


class HabitLogUpdate(BaseModel):
    is_completed: bool


class HabitLogResult(BaseModel):
    is_completed: bool
    task: Optional[dict] = None


# ---------- Helpers ----------

def _habit_out(h: Habit) -> dict:
    return {
        "id": h.id,
        "title": h.title,
        "frequency": h.frequency,
        "days": days_list(h),
        "time": h.preferred_time.strftime("%H:%M") if h.preferred_time else "",
        "auto_task": h.auto_create_task,
        "is_active": h.is_active,
    }


async def _get_habit(session: AsyncSession, user: User, habit_id: int) -> Habit:
    habit = await session.scalar(
        select(Habit).where(
            Habit.id == habit_id,
            Habit.user_id == user.id,
            Habit.deleted_at.is_(None),
        )
    )
    if habit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy habit")
    return habit


# ---------- Endpoints ----------

@router.get("", response_model=list[HabitOut])
async def list_habits(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Lấy danh sách các habit chưa bị xóa (bao gồm cả tạm dừng)."""
    habits = (
        await session.scalars(
            select(Habit)
            .where(Habit.user_id == user.id, Habit.deleted_at.is_(None))
            .order_by(Habit.id)
        )
    ).all()
    return [_habit_out(h) for h in habits]


@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
async def create_habit(
    body: HabitCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Tạo mới một habit."""
    title = body.title.strip()
    if not title:
        raise HTTPException(422, "Tiêu đề không được để trống")

    try:
        custom_days = normalize_habit_fields(body.frequency, body.days)
    except ValueError as e:
        raise HTTPException(422, str(e))

    pref_time = _parse_time(body.time)

    habit = Habit(
        user_id=user.id,
        title=title,
        frequency=body.frequency,
        custom_days=custom_days,
        preferred_time=pref_time,
        auto_create_task=body.auto_task if body.auto_task is not None else True,
        is_active=body.is_active if body.is_active is not None else True,
    )
    session.add(habit)
    await session.commit()
    await session.refresh(habit)
    return _habit_out(habit)


@router.patch("/{habit_id}", response_model=HabitOut)
async def update_habit(
    habit_id: int,
    body: HabitPatch,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cập nhật habit và xử lý task tương lai theo quy tắc dọn dẹp đã chốt."""
    habit = await _get_habit(session, user, habit_id)
    sent = body.model_fields_set

    old_sched = scheduled_days(habit)

    # 1. Cập nhật title
    if "title" in sent and body.title is not None:
        new_title = body.title.strip()
        if not new_title:
            raise HTTPException(422, "Tiêu đề không được để trống")
        if new_title != habit.title:
            habit.title = new_title
            await cleanup_on_title_change(session, habit, new_title)

    # 2. Cập nhật frequency / days
    freq_changed = "frequency" in sent and body.frequency is not None and body.frequency != habit.frequency
    days_changed = "days" in sent

    if freq_changed or days_changed:
        new_freq = body.frequency if ("frequency" in sent and body.frequency is not None) else habit.frequency
        new_days = body.days if "days" in sent else (days_list(habit) if new_freq == HabitFrequency.CUSTOM else None)
        try:
            custom_days = normalize_habit_fields(new_freq, new_days)
        except ValueError as e:
            raise HTTPException(422, str(e))

        habit.frequency = new_freq
        habit.custom_days = custom_days

        new_sched = scheduled_days(habit)
        await cleanup_on_schedule_change(session, habit, old_sched, new_sched)

    # 3. Cập nhật preferred_time
    if "time" in sent:
        new_time = _parse_time(body.time)
        if new_time != habit.preferred_time:
            habit.preferred_time = new_time
            await cleanup_on_time_change(session, habit, new_time)

    # 4. Cập nhật auto_create_task
    if "auto_task" in sent and body.auto_task is not None:
        habit.auto_create_task = body.auto_task

    # 5. Cập nhật is_active
    if "is_active" in sent and body.is_active is not None:
        habit.is_active = body.is_active

    await session.commit()
    await session.refresh(habit)
    return _habit_out(habit)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Xóa mềm habit: deleted_at = utc_now(), is_active = False. Dọn task tương lai chưa sửa."""
    habit = await _get_habit(session, user, habit_id)
    habit.deleted_at = utc_now()
    habit.is_active = False

    await cleanup_on_delete(session, habit)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/generate")
async def generate_habits(
    body: GenerateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Sinh task còn thiếu cho một tuần ISO."""
    created = await generate_habit_tasks(session, user.id, body.iso_year, body.iso_week)
    await session.commit()
    return {"created": created}


@router.put("/{habit_id}/logs/{log_date}", response_model=HabitLogResult)
async def update_habit_log(
    habit_id: int,
    log_date: date,
    body: HabitLogUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Đánh dấu log hoàn thành của habit cho ngày hôm nay. Đồng bộ sang task cùng ngày nếu có."""
    today = config.today()
    if log_date != today:
        raise HTTPException(400, "Chỉ có thể ghi log thói quen cho ngày hôm nay")

    habit = await _get_habit(session, user, habit_id)

    # Ghi hoặc cập nhật log
    await upsert_log(session, habit.id, log_date, body.is_completed)

    # Đồng bộ sang task nếu có task tương ứng chưa vào thùng rác/purge
    task = await session.scalar(
        select(Task).where(
            *_active(user),
            Task.habit_id == habit.id,
            Task.due_date == log_date,
        )
    )

    task_out_dict = None
    if task is not None:
        task.is_completed = body.is_completed
        task.completed_at = utc_now() if body.is_completed else None
        await session.flush()
        steps = await _steps_for(session, [task])
        task_out_dict = _out(task, steps[task.id])

    await session.commit()
    return {"is_completed": body.is_completed, "task": task_out_dict}

