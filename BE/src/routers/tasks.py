from datetime import date, datetime, timedelta, timezone
from datetime import time as time_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Integer, String, cast, delete, extract, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.db import get_session
from src.deps import get_current_user
from src.habit_logs import upsert_log
from src.models import Habit, Task, User, utc_now
from src.task_schemas import (
    BulkIn,
    CountOut,
    TaskCreate,
    TaskListOut,
    TaskOut,
    TaskPatch,
    TrashItemOut,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])

PAST_LOCK_MSG = "Không thể thay đổi trạng thái hoàn thành của ngày đã qua"


# ---------- helpers ----------

def _parse_time(v: Optional[str]) -> Optional[time_type]:
    if not v:
        return None
    h, m = v.split(":")
    return time_type(int(h), int(m))


def _out(t: Task, steps: list[str]) -> dict:
    iso = t.due_date.isocalendar()
    return {
        "id": t.id,
        "title": t.title,
        "due_date": t.due_date,
        "day": t.due_date.weekday(),
        "iso_year": iso.year,
        "iso_week": iso.week,
        "time": t.due_time.strftime("%H:%M") if t.due_time else "",
        "is_completed": t.is_completed,
        "completed_at": t.completed_at,
        "is_starred": t.is_starred,
        "is_ai_generated": t.is_ai_generated,
        "habit_id": t.habit_id,
        "steps": steps,
    }


async def _steps_for(session: AsyncSession, tasks: list[Task]) -> dict[int, list[str]]:
    """Ghép subtask thành steps. Subtask hợp lệ khi cùng trạng thái xóa với task cha."""
    result: dict[int, list[str]] = {t.id: [] for t in tasks}
    if not tasks:
        return result
    parents = {t.id: t for t in tasks}
    subs = await session.scalars(
        select(Task).where(Task.parent_task_id.in_(parents.keys())).order_by(Task.id)
    )
    for s in subs:
        if s.deleted_at == parents[s.parent_task_id].deleted_at:
            result[s.parent_task_id].append(s.title)
    return result


async def _outs(session: AsyncSession, tasks: list[Task]) -> list[dict]:
    steps = await _steps_for(session, tasks)
    return [_out(t, steps[t.id]) for t in tasks]


async def _get_task(
    session: AsyncSession, user: User, task_id: int, *, trashed: bool = False
) -> Task:
    q = select(Task).where(
        Task.id == task_id,
        Task.user_id == user.id,
        Task.parent_task_id.is_(None),
        Task.purged_at.is_(None),
        Task.deleted_at.is_not(None) if trashed else Task.deleted_at.is_(None),
    )
    task = await session.scalar(q)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy task")
    return task


def _active(user: User):
    return (
        Task.user_id == user.id,
        Task.parent_task_id.is_(None),
        Task.deleted_at.is_(None),
        Task.purged_at.is_(None),
    )


def _order():
    return (Task.due_date, Task.due_time.nulls_last(), Task.id)


async def _purge(session: AsyncSession, task: Task) -> None:
    """Xóa vĩnh viễn. Task do habit sinh chỉ đánh dấu purged_at để không bị sinh lại."""
    if task.habit_id is not None:
        await session.execute(delete(Task).where(Task.parent_task_id == task.id))
        task.purged_at = utc_now()
    else:
        await session.execute(delete(Task).where(Task.id == task.id))  # subtask xóa theo (CASCADE)


def _like(q: str) -> str:
    esc = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc}%"


# ---------- đọc ----------

@router.get("", response_model=TaskListOut)
async def list_tasks(
    date_from: date,
    date_to: date,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if date_to < date_from or (date_to - date_from).days > 62:
        raise HTTPException(400, "Khoảng ngày không hợp lệ (tối đa 63 ngày)")
    tasks = (
        await session.scalars(
            select(Task)
            .where(*_active(user), Task.due_date >= date_from, Task.due_date <= date_to)
            .order_by(*_order())
        )
    ).all()
    return {"count": len(tasks), "tasks": await _outs(session, list(tasks))}


@router.get("/search", response_model=list[TaskOut])
async def search_tasks(
    q: str = Query(..., max_length=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    q = q.strip()
    if not q:
        return []
    pat = _like(q)
    conds = [
        Task.title.ilike(pat, escape="\\"),
        cast(Task.due_time, String).ilike(pat, escape="\\"),
        func.to_char(Task.due_date, "YYYY-MM-DD").ilike(pat, escape="\\"),
        func.to_char(Task.due_date, "FMMon FMDD, YYYY").ilike(pat, escape="\\"),
    ]
    if q.isdigit() and len(q) <= 2:
        conds.append(cast(extract("week", Task.due_date), Integer) == int(q))
    tasks = (
        await session.scalars(
            select(Task).where(*_active(user), or_(*conds)).limit(500)
        )
    ).all()
    pending = [t for t in tasks if not t.is_completed]
    done = [t for t in tasks if t.is_completed]
    pending.sort(key=lambda t: (t.due_date, t.due_time is None, t.due_time or time_type.min, t.id))
    floor = datetime.min.replace(tzinfo=timezone.utc)
    done.sort(key=lambda t: t.completed_at or floor, reverse=True)
    return await _outs(session, (pending + done)[:100])


@router.get("/overdue", response_model=TaskListOut)
async def overdue_tasks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    tasks = list(
        (
            await session.scalars(_overdue_query(user, config.today()))
        ).all()
    )
    return {"count": len(tasks), "tasks": await _outs(session, tasks)}


def _overdue_query(user: User, today: date):
    return (
        select(Task)
        .where(
            *_active(user),
            Task.habit_id.is_(None),  # task habit không tính là overdue (Câu 45)
            Task.is_completed.is_(False),
            Task.due_date < today,
        )
        .order_by(*_order())
    )


@router.get("/trash", response_model=list[TrashItemOut])
async def list_trash(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    tasks = list(
        (
            await session.scalars(
                select(Task)
                .where(
                    Task.user_id == user.id,
                    Task.parent_task_id.is_(None),
                    Task.deleted_at.is_not(None),
                    Task.purged_at.is_(None),
                )
                .order_by(Task.deleted_at.desc(), Task.id.desc())
            )
        ).all()
    )
    steps = await _steps_for(session, tasks)
    return [{**_out(t, steps[t.id]), "deleted_at": t.deleted_at} for t in tasks]


# ---------- ghi ----------

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = Task(
        user_id=user.id,
        title=body.title,
        due_date=body.due_date,
        due_time=_parse_time(body.time),
        is_starred=body.is_starred,
    )
    session.add(task)
    await session.flush()
    for s in body.steps:
        session.add(Task(user_id=user.id, title=s, due_date=body.due_date, parent_task_id=task.id))
    await session.commit()
    return _out(task, list(body.steps))


@router.post("/bulk", response_model=TaskListOut, status_code=status.HTTP_201_CREATED)
async def bulk_create(
    body: BulkIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        monday = date.fromisocalendar(body.iso_year, body.iso_week, 1)
    except ValueError:
        raise HTTPException(422, "Tuần ISO không hợp lệ")
    tasks = [
        Task(
            user_id=user.id,
            title=item.title,
            due_date=monday + timedelta(days=item.day),
            due_time=_parse_time(item.time),
            is_ai_generated=True,
        )
        for item in body.items
    ]
    session.add_all(tasks)
    await session.commit()
    return {"count": len(tasks), "tasks": [_out(t, []) for t in tasks]}


@router.post("/carry-over", response_model=TaskListOut)
async def carry_over(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    today = config.today()
    tasks = list((await session.scalars(_overdue_query(user, today))).all())
    now = utc_now()
    for t in tasks:
        t.due_date = today
        t.user_modified_at = now
    if tasks:
        await session.execute(
            update(Task)
            .where(Task.parent_task_id.in_([t.id for t in tasks]))
            .values(due_date=today)
        )
    await session.commit()
    return {"count": len(tasks), "tasks": await _outs(session, tasks)}


@router.delete("/trash", response_model=CountOut)
async def empty_trash(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    tasks = (
        await session.scalars(
            select(Task).where(
                Task.user_id == user.id,
                Task.parent_task_id.is_(None),
                Task.deleted_at.is_not(None),
                Task.purged_at.is_(None),
            )
        )
    ).all()
    for t in tasks:
        await _purge(session, t)
    await session.commit()
    return {"count": len(tasks)}


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task(session, user, task_id)
    return (await _outs(session, [task]))[0]


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    body: TaskPatch,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task(session, user, task_id)
    sent = body.model_fields_set
    changed = False  # có thay đổi nội dung -> đặt user_modified_at

    if "title" in sent and body.title != task.title:
        task.title = body.title
        changed = True

    if "due_date" in sent and body.due_date != task.due_date:
        if task.habit_id is not None:
            raise HTTPException(400, "Task của thói quen không thể dời lịch")
        task.due_date = body.due_date
        await session.execute(
            update(Task).where(Task.parent_task_id == task.id).values(due_date=body.due_date)
        )
        changed = True

    if "time" in sent:
        new_time = _parse_time(body.time)
        if new_time != task.due_time:
            task.due_time = new_time
            changed = True

    if "is_starred" in sent and body.is_starred != task.is_starred:
        task.is_starred = body.is_starred
        changed = True

    if "steps" in sent:
        current = (await _steps_for(session, [task]))[task.id]
        if body.steps != current:
            await session.execute(
                delete(Task).where(Task.parent_task_id == task.id, Task.deleted_at.is_(None))
            )
            for s in body.steps:
                session.add(
                    Task(user_id=user.id, title=s, due_date=task.due_date, parent_task_id=task.id)
                )
            changed = True

    completion_changed = False
    if "is_completed" in sent and body.is_completed != task.is_completed:
        today = config.today()
        if task.due_date < today:
            raise HTTPException(400, PAST_LOCK_MSG)
        if task.habit_id is not None and body.is_completed and task.due_date > today:
            raise HTTPException(400, "Chưa thể hoàn thành thói quen của ngày tương lai")
        task.is_completed = body.is_completed
        task.completed_at = utc_now() if body.is_completed else None
        completion_changed = True

    if changed:
        task.user_modified_at = utc_now()

    if completion_changed and task.habit_id is not None:
        habit = await session.get(Habit, task.habit_id)
        if habit is not None and habit.deleted_at is None:
            await upsert_log(session, habit.id, task.due_date, task.is_completed)

    await session.commit()
    return (await _outs(session, [task]))[0]


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def trash_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task(session, user, task_id)
    now = utc_now()
    task.deleted_at = now
    await session.execute(
        update(Task)
        .where(Task.parent_task_id == task.id, Task.deleted_at.is_(None))
        .values(deleted_at=now)
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/restore", response_model=TaskOut)
async def restore_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task(session, user, task_id, trashed=True)
    ts = task.deleted_at
    await session.execute(
        update(Task)
        .where(Task.parent_task_id == task.id, Task.deleted_at == ts)
        .values(deleted_at=None)
    )
    task.deleted_at = None
    await session.commit()
    return (await _outs(session, [task]))[0]


@router.delete("/{task_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_task(
    task_id: int,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    task = await _get_task(session, user, task_id, trashed=True)
    await _purge(session, task)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
