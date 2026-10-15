from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import get_session
from src.deps import get_current_user
from src.models import User
from src.reminder_schemas import SettingsOut, SettingsPatch
from src.routers.tasks import _parse_time

router = APIRouter(prefix="/me", tags=["me"])


def settings_out(u: User) -> dict:
    return {
        "reminder_time": u.reminder_time.strftime("%H:%M"),
        "reminder_lead_minutes": u.reminder_lead_minutes,
    }


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
