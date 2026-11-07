from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, model_validator

from src.task_schemas import clean_time

ALLOWED_LEAD_MINUTES = (5, 10, 15, 30)


class SettingsOut(BaseModel):
    reminder_time: str  # "HH:mm"
    reminder_lead_minutes: Optional[int]  # null = tắt nhắc trước giờ task


class SettingsPatch(BaseModel):
    reminder_time: Optional[str] = None
    reminder_lead_minutes: Optional[int] = None  # gửi null để tắt

    @model_validator(mode="after")
    def _check(self):
        if "reminder_time" in self.model_fields_set:
            t = clean_time(self.reminder_time)
            if not t:
                raise ValueError("reminder_time phải có dạng HH:mm")
            self.reminder_time = t
        if "reminder_lead_minutes" in self.model_fields_set:
            v = self.reminder_lead_minutes
            if v is not None and v not in ALLOWED_LEAD_MINUTES:
                raise ValueError("reminder_lead_minutes chỉ nhận 5, 10, 15, 30 hoặc null")
        return self


class UpcomingTask(BaseModel):
    id: int
    title: str
    time: str
    minutes_until: int
    habit_id: Optional[int] = None


class RemindersOut(BaseModel):
    today: date
    now: datetime
    reminder_time: str
    reminder_lead_minutes: Optional[int]
    pending_tasks: int  # task chưa xong của hôm nay (kể cả task habit)
    pending_habits: int  # habit tắt auto_task, có lịch hôm nay, chưa tick
    upcoming: list[UpcomingTask]  # task hôm nay có giờ, chưa xong, chưa qua giờ
