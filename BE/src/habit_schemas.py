from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from src import limits
from src.models import HabitFrequency
from src.task_schemas import clean_time, clean_title


class HabitCreate(BaseModel):
    title: str
    frequency: HabitFrequency = HabitFrequency.DAILY
    days: Optional[list[int]] = None  # 0 = Thứ Hai ... 6 = Chủ Nhật
    time: Optional[str] = None  # "HH:mm"
    auto_create_task: bool = True

    @model_validator(mode="after")
    def _clean(self):
        self.title = clean_title(self.title)
        self.time = clean_time(self.time)
        return self


class HabitPatch(BaseModel):
    title: Optional[str] = None
    frequency: Optional[HabitFrequency] = None
    days: Optional[list[int]] = None
    time: Optional[str] = None  # "" hoặc null = xóa giờ
    is_active: Optional[bool] = None
    auto_create_task: Optional[bool] = None

    @model_validator(mode="after")
    def _clean(self):
        if "title" in self.model_fields_set and getattr(self, "title") is not None:
            self.title = clean_title(self.title)
        if "time" in self.model_fields_set:
            self.time = clean_time(self.time)
        return self


class HabitLogUpdate(BaseModel):
    is_completed: bool


class HabitGenerateIn(BaseModel):
    iso_year: int = Field(ge=2000, le=2100)
    iso_week: int = Field(ge=1, le=53)


class HabitOut(BaseModel):
    id: int
    title: str
    frequency: HabitFrequency
    days: list[int]
    time: str
    is_active: bool
    auto_create_task: bool
    created_at: str


class HabitWeekItem(BaseModel):
    id: int
    title: str
    frequency: HabitFrequency
    days: list[int]
    time: str
    is_active: bool
    auto_create_task: bool
    scheduled: list[bool]  # 7 ngày trong tuần
    logs: list[bool]        # 7 ngày trong tuần
    progress: int           # Phần trăm hoàn thành theo số ngày có lịch


class WeekDataOut(BaseModel):
    iso_year: int
    iso_week: int
    start_date: date
    end_date: date
    tasks_by_day: list[list[dict]]  # 7 mảng task theo ngày 0-6
    daily_stats: list[dict]         # 7 thống kê {total, done, percent}
    weekly_stats: dict              # {total, done, percent}
    habits: list[HabitWeekItem]

