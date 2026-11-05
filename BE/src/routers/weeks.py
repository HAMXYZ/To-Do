from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.ai_service import AIServiceError, generate_json
from src.db import get_session
from src.deps import get_current_user
from src.habit_utils import round_half_up, week_progress
from src.models import Habit, Task, User, WeeklyReview, utc_now
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


class WeeklyReviewTextIn(BaseModel):
    summary_text: str = Field(min_length=1, max_length=4000)

    @field_validator("summary_text")
    @classmethod
    def trim_summary(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nội dung review không được để trống.")
        return value


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


def _week_dates(iso_year: int, iso_week: int) -> list[date]:
    try:
        monday = date.fromisocalendar(iso_year, iso_week, 1)
    except ValueError as exc:
        raise HTTPException(422, "Tuần ISO không hợp lệ") from exc
    return [monday + timedelta(days=index) for index in range(7)]


async def _weekly_review_data(
    session: AsyncSession, user: User, week_dates: list[date]
) -> dict[str, Any]:
    tasks = list(
        (
            await session.scalars(
                select(Task)
                .where(
                    *_active(user),
                    Task.due_date >= week_dates[0],
                    Task.due_date <= week_dates[-1],
                )
                .order_by(Task.due_date, Task.due_time, Task.id)
            )
        ).all()
    )
    done_tasks = sum(1 for task in tasks if task.is_completed)
    task_rate = round_half_up(done_tasks / len(tasks) * 100) if tasks else 0

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
    habit_summaries = []
    scheduled_habit_days = 0
    completed_habit_days = 0
    for habit in habits:
        progress = await week_progress(session, habit, week_dates, config.today())
        scheduled_habit_days += progress["scheduled_count"]
        completed_habit_days += progress["done_count"]
        habit_summaries.append(
            {
                "title": habit.title,
                "scheduled_days": [
                    day for day, scheduled in enumerate(progress["scheduled"]) if scheduled
                ],
                "completed_days": [
                    day for day, completed in enumerate(progress["logs"]) if completed
                ],
                "done_count": progress["done_count"],
                "scheduled_count": progress["scheduled_count"],
            }
        )

    habit_rate = (
        round_half_up(completed_habit_days / scheduled_habit_days * 100)
        if scheduled_habit_days
        else 0
    )
    return {
        "task_total": len(tasks),
        "task_done": done_tasks,
        "task_completion_rate": task_rate,
        "habit_total": len(habits),
        "habit_scheduled_days": scheduled_habit_days,
        "habit_completed_days": completed_habit_days,
        "habit_completion_rate": habit_rate,
        "habits": habit_summaries,
        "tasks": [
            {
                "title": task.title[:120],
                "completed": task.is_completed,
                "day": (task.due_date - week_dates[0]).days,
            }
            for task in tasks[:50]
        ],
    }


def _review_out(review: WeeklyReview | None) -> dict[str, Any] | None:
    if review is None:
        return None
    return {
        "id": review.id,
        "year": review.year,
        "week_number": review.week_number,
        "summary_text": review.summary_text,
        "completion_rate": review.completion_rate,
        "created_at": review.created_at,
    }


@router.get("/{iso_year}/{iso_week}/review")
async def get_weekly_review(
    iso_year: int = Path(..., ge=2000, le=2100),
    iso_week: int = Path(..., ge=1, le=53),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    week_dates = _week_dates(iso_year, iso_week)
    review = await session.scalar(
        select(WeeklyReview).where(
            WeeklyReview.user_id == user.id,
            WeeklyReview.year == iso_year,
            WeeklyReview.week_number == iso_week,
        )
    )
    stats = await _weekly_review_data(session, user, week_dates)
    return {"review": _review_out(review), "stats": stats}


@router.post("/{iso_year}/{iso_week}/review/generate")
async def generate_weekly_review(
    response: Response,
    iso_year: int = Path(..., ge=2000, le=2100),
    iso_week: int = Path(..., ge=1, le=53),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    week_dates = _week_dates(iso_year, iso_week)
    stats = await _weekly_review_data(session, user, week_dates)
    system = (
        "Bạn viết weekly review ngắn bằng tiếng Việt dựa đúng dữ liệu được cung cấp. "
        "Nêu điểm đã làm được, điểm còn dang dở và một gợi ý cho tuần tới nếu dữ liệu hỗ trợ. "
        "Không bịa lý do, cảm xúc, deadline hoặc sự kiện. Trả đúng JSON {\"summary_text\": string}, không markdown."
    )
    try:
        result, provider, quota_info = await generate_json(
            user.id,
            system,
            {
                "iso_year": iso_year,
                "iso_week": iso_week,
                "week_start": week_dates[0].isoformat(),
                "week_end": week_dates[-1].isoformat(),
                "stats": {key: value for key, value in stats.items() if key != "tasks"},
                "tasks": stats["tasks"],
            },
        )
        response.headers["X-RateLimit-Limit"] = str(quota_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(quota_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(quota_info["reset_in_seconds"])
        summary = result.get("summary_text")
        if not isinstance(summary, str) or not 20 <= len(summary.strip()) <= 4000:
            raise HTTPException(502, "AI trả về weekly review không hợp lệ. Hãy thử lại.")
        return {
            "summary_text": summary.strip(),
            "completion_rate": stats["task_completion_rate"],
            "provider": provider,
            "stats": stats,
        }
    except AIServiceError as exc:
        headers: dict[str, str] = {}
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        if exc.details.get("limit") is not None:
            headers["X-RateLimit-Limit"] = str(exc.details["limit"])
            headers["X-RateLimit-Remaining"] = str(exc.details["remaining"])
            headers["X-RateLimit-Reset"] = str(exc.details["reset_in_seconds"])
        detail = {
            "code": exc.code,
            "message": exc.message,
            "retry_after": exc.retry_after,
        }
        raise HTTPException(status_code=exc.status_code, detail=detail, headers=headers) from exc


@router.put("/{iso_year}/{iso_week}/review")
async def save_weekly_review(
    body: WeeklyReviewTextIn,
    iso_year: int = Path(..., ge=2000, le=2100),
    iso_week: int = Path(..., ge=1, le=53),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _week_dates(iso_year, iso_week)
    stats = await _weekly_review_data(
        session, user, _week_dates(iso_year, iso_week)
    )
    review = await session.scalar(
        select(WeeklyReview).where(
            WeeklyReview.user_id == user.id,
            WeeklyReview.year == iso_year,
            WeeklyReview.week_number == iso_week,
        )
    )
    if review is None:
        review = WeeklyReview(
            user_id=user.id,
            year=iso_year,
            week_number=iso_week,
            summary_text=body.summary_text,
            completion_rate=stats["task_completion_rate"],
            created_at=utc_now(),
        )
        session.add(review)
    else:
        review.summary_text = body.summary_text
        review.completion_rate = stats["task_completion_rate"]
    await session.commit()
    await session.refresh(review)
    return _review_out(review)
