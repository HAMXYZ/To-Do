from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_session
from src.deps import get_current_user
from src.models import Category, Habit, HabitLog, Task, User, WeeklyReview
from src.reminder_schemas import SettingsOut, SettingsPatch
from src.routers.tasks import _parse_time
from src.schemas import ProfileUpdateIn, UserOut

router = APIRouter(prefix="/me", tags=["me"])


def settings_out(u: User) -> dict:
    return {
        "reminder_time": u.reminder_time.strftime("%H:%M"),
        "reminder_lead_minutes": u.reminder_lead_minutes,
    }


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    body: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cập nhật tên hiển thị hồ sơ cá nhân."""
    user.full_name = body.full_name
    await session.commit()
    await session.refresh(user)
    return user


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu cá nhân liên quan."""
    # 1. Xóa các log thói quen (habit_logs)
    user_habit_ids = select(Habit.id).where(Habit.user_id == user.id)
    await session.execute(delete(HabitLog).where(HabitLog.habit_id.in_(user_habit_ids)))

    # 2. Xóa các công việc (tasks)
    await session.execute(delete(Task).where(Task.user_id == user.id))

    # 3. Xóa các thói quen (habits)
    await session.execute(delete(Habit).where(Habit.user_id == user.id))

    # 4. Xóa danh mục (categories)
    await session.execute(delete(Category).where(Category.user_id == user.id))

    # 5. Xóa báo cáo tuần (weekly_reviews)
    await session.execute(delete(WeeklyReview).where(WeeklyReview.user_id == user.id))

    # 6. Xóa người dùng (user)
    await session.delete(user)
    await session.commit()
    return None


@router.get("/settings", response_model=SettingsOut)
async def get_settings(user: User = Depends(get_current_user)):
    return settings_out(user)


@router.put("/settings", response_model=SettingsOut)
async def put_settings(
    body: SettingsPatch,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Chỉ cập nhật các trường được gửi lên."""
    sent = body.model_fields_set
    if "reminder_time" in sent:
        user.reminder_time = _parse_time(body.reminder_time)
    if "reminder_lead_minutes" in sent:
        user.reminder_lead_minutes = body.reminder_lead_minutes
    await session.commit()
    return settings_out(user)
