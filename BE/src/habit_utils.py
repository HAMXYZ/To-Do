"""Tiện ích dùng chung cho habit: tính lịch, sinh task, dọn task khi đổi lịch."""

from __future__ import annotations

import math
from datetime import date, timedelta
from datetime import time as time_type
from typing import TYPE_CHECKING, Sequence

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.models import Habit, HabitFrequency, HabitLog, Task, utc_now

if TYPE_CHECKING:
    pass


# ---------- hàm tiện ích ----------


def round_half_up(x: float) -> int:
    """Làm tròn đến số nguyên gần nhất (0.5 làm tròn lên)."""
    return math.floor(x + 0.5)


def scheduled_days(habit: Habit) -> set[int]:
    """Trả về set các weekday (0=Mon..6=Sun) mà habit có lịch."""
    if habit.frequency == HabitFrequency.DAILY:
        return {0, 1, 2, 3, 4, 5, 6}
    if habit.frequency == HabitFrequency.WEEKDAYS:
        return {0, 1, 2, 3, 4}
    # custom
    if not habit.custom_days:
        return set()
    return {int(d) for d in habit.custom_days.split(",") if d.strip().isdigit()}


def days_list(habit: Habit) -> list[int]:
    """Trả về danh sách weekday sắp xếp tăng dần, dùng cho API response."""
    return sorted(scheduled_days(habit))


def _parse_custom_days(days: list[int] | None) -> str | None:
    """Chuẩn hóa days: kiểm tra 0-6, loại trùng, sắp tăng dần, trả chuỗi."""
    if days is None:
        return None
    seen: set[int] = set()
    for d in days:
        if d < 0 or d > 6:
            raise ValueError(f"Giá trị ngày {d} không hợp lệ (phải từ 0 đến 6)")
        seen.add(d)
    if not seen:
        return None
    return ",".join(str(d) for d in sorted(seen))


def normalize_habit_fields(
    frequency: HabitFrequency,
    days: list[int] | None,
) -> str | None:
    """Trả về custom_days đã chuẩn hóa. Khi frequency != custom thì trả None.
    Khi frequency = custom mà days rỗng thì raise ValueError."""
    if frequency != HabitFrequency.CUSTOM:
        return None
    result = _parse_custom_days(days)
    if result is None:
        raise ValueError("Cần ít nhất một ngày khi frequency = custom")
    return result


# ---------- sinh task habit ----------


async def generate_habit_tasks(
    session: AsyncSession,
    user_id: int,
    iso_year: int,
    iso_week: int,
) -> int:
    """Sinh task còn thiếu cho các habit đang bật auto_create_task, trong một tuần ISO.
    Gọi lặp lại an toàn nhờ ràng buộc unique (habit_id, habit_date).
    Trả về số task đã tạo."""
    today = config.today()
    try:
        monday = date.fromisocalendar(iso_year, iso_week, 1)
    except ValueError:
        return 0

    # Chỉ sinh task cho tuần hiện tại trở đi, tối đa ~1 năm
    # Câu 73 (suy ra): không sinh task cho ngày đã qua
    habits = list(
        (
            await session.scalars(
                select(Habit).where(
                    Habit.user_id == user_id,
                    Habit.is_active.is_(True),
                    Habit.deleted_at.is_(None),
                    Habit.auto_create_task.is_(True),
                )
            )
        ).all()
    )
    if not habits:
        return 0

    # Tính 7 ngày của tuần
    week_dates = [monday + timedelta(days=i) for i in range(7)]

    # Lấy các (habit_id, habit_date) đã tồn tại (kể cả đã xóa/purge) để tránh trùng
    habit_ids = [h.id for h in habits]
    existing: set[tuple[int, date]] = set()
    if habit_ids:
        rows = await session.execute(
            select(Task.habit_id, Task.habit_date).where(
                Task.habit_id.in_(habit_ids),
                Task.habit_date.in_(week_dates),
            )
        )
        for row in rows:
            existing.add((row[0], row[1]))

    created = 0
    for h in habits:
        sched = scheduled_days(h)
        for d in week_dates:
            # Không sinh cho ngày trước hôm nay (Câu 73 suy ra)
            if d < today:
                continue
            if d.weekday() not in sched:
                continue
            if (h.id, d) in existing:
                continue
            task = Task(
                user_id=user_id,
                title=h.title,
                due_date=d,
                due_time=h.preferred_time,
                habit_id=h.id,
                habit_date=d,
            )
            session.add(task)
            created += 1

    if created:
        await session.flush()

    return created


# ---------- dọn task khi sửa/xóa habit ----------


async def _future_untouched_tasks(
    session: AsyncSession,
    habit: Habit,
    *,
    from_date: date | None = None,
) -> list[Task]:
    """Lấy task habit từ ngày mai trở đi, chưa Done và chưa bị người dùng sửa."""
    tomorrow = (from_date or config.today()) + timedelta(days=1)
    return list(
        (
            await session.scalars(
                select(Task).where(
                    Task.habit_id == habit.id,
                    Task.due_date >= tomorrow,
                    Task.is_completed.is_(False),
                    Task.user_modified_at.is_(None),
                    Task.deleted_at.is_(None),
                    Task.purged_at.is_(None),
                )
            )
        ).all()
    )


async def cleanup_on_schedule_change(
    session: AsyncSession,
    habit: Habit,
    old_sched: set[int],
    new_sched: set[int],
) -> None:
    """Câu 21: Khi đổi lịch habit, xóa task tương lai không còn khớp.
    Chỉ đụng task từ ngày mai, chưa Done, chưa bị sửa."""
    removed_days = old_sched - new_sched
    if not removed_days:
        return
    tasks = await _future_untouched_tasks(session, habit)
    for t in tasks:
        if t.due_date.weekday() in removed_days:
            # Xóa thật (không vào thùng rác), vì người dùng chưa đụng vào
            await session.execute(delete(Task).where(Task.parent_task_id == t.id))
            await session.delete(t)


async def cleanup_on_time_change(
    session: AsyncSession,
    habit: Habit,
    new_time: time_type | None,
) -> None:
    """Câu 23/69: Đổi preferred_time → cập nhật giờ cho task chưa sửa."""
    tasks = await _future_untouched_tasks(session, habit)
    for t in tasks:
        t.due_time = new_time


async def cleanup_on_title_change(
    session: AsyncSession,
    habit: Habit,
    new_title: str,
) -> None:
    """Suy ra Đợt 4: Đổi tên habit → task tương lai chưa sửa đổi tên theo."""
    tasks = await _future_untouched_tasks(session, habit)
    for t in tasks:
        t.title = new_title


async def cleanup_on_delete(
    session: AsyncSession,
    habit: Habit,
) -> None:
    """Câu 36/21: Xóa habit → xóa task tương lai chưa Done, chưa sửa.
    Task hôm nay/quá khứ, đã Done, đã sửa được giữ nguyên.
    HabitLog và task đã sinh vẫn giữ."""
    tasks = await _future_untouched_tasks(session, habit)
    for t in tasks:
        await session.execute(delete(Task).where(Task.parent_task_id == t.id))
        await session.delete(t)


async def cleanup_on_deactivate(
    session: AsyncSession,
    habit: Habit,
) -> None:
    """Tạm dừng habit: chỉ ngừng sinh task mới, không xóa task đang có.
    Hàm này không làm gì, gọi để rõ ý."""
    pass


# ---------- tính tiến độ tuần cho habit ----------


async def week_progress(
    session: AsyncSession,
    habit: Habit,
    week_dates: list[date],
    today: date,
) -> dict:
    """Trả về dữ liệu tiến độ tuần cho một habit: scheduled (7 bool), logs (7 bool), progress %."""
    sched = scheduled_days(habit)
    scheduled = [d.weekday() in sched for d in week_dates]

    # Lấy log hoàn thành trong tuần
    done_dates: set[date] = set()
    logs_rows = await session.scalars(
        select(HabitLog).where(
            HabitLog.habit_id == habit.id,
            HabitLog.date.in_(week_dates),
            HabitLog.is_completed.is_(True),
        )
    )
    for lg in logs_rows:
        done_dates.add(lg.date)

    logs = [d in done_dates for d in week_dates]

    # Câu 41: progress = done / scheduled trong tuần, kể cả ngày chưa tới
    sched_count = sum(1 for s in scheduled if s)
    done_count = sum(1 for i, s in enumerate(scheduled) if s and logs[i])
    progress = round_half_up(done_count / sched_count * 100) if sched_count else 0

    return {
        "scheduled": scheduled,
        "logs": logs,
        "done_count": done_count,
        "scheduled_count": sched_count,
        "progress": progress,
    }
