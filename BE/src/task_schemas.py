import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from src import limits

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def clean_title(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("Tiêu đề không được để trống")
    if len(v) > limits.TITLE_MAX:
        raise ValueError(f"Tiêu đề tối đa {limits.TITLE_MAX} ký tự")
    return v


def clean_steps(steps: list[str]) -> list[str]:
    if len(steps) > limits.MAX_SUBTASKS:
        raise ValueError(f"Tối đa {limits.MAX_SUBTASKS} bước con")
    out = []
    for s in steps:
        s = s.strip()
        if not s:
            raise ValueError("Bước con không được để trống")
        if len(s) > limits.SUBTASK_MAX:
            raise ValueError(f"Mỗi bước con tối đa {limits.SUBTASK_MAX} ký tự")
        out.append(s)
    return out


def clean_time(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return ""
    if not _TIME_RE.match(v):
        raise ValueError("Giờ phải có dạng HH:mm (24 giờ)")
    return v


class TaskCreate(BaseModel):
    title: str
    due_date: date
    time: Optional[str] = None
    is_starred: bool = False
    steps: list[str] = []

    @model_validator(mode="after")
    def _clean(self):
        self.title = clean_title(self.title)
        self.time = clean_time(self.time)
        self.steps = clean_steps(self.steps)
        return self


class TaskPatch(BaseModel):
    title: Optional[str] = None
    due_date: Optional[date] = None
    time: Optional[str] = None  # "" hoặc null = xóa giờ
    is_starred: Optional[bool] = None
    is_completed: Optional[bool] = None
    steps: Optional[list[str]] = None

    @model_validator(mode="after")
    def _clean(self):
        for f in ("title", "due_date", "is_starred", "is_completed", "steps"):
            if f in self.model_fields_set and getattr(self, f) is None:
                raise ValueError(f"{f} không được là null")
        if self.title is not None:
            self.title = clean_title(self.title)
        if self.time is not None:
            self.time = clean_time(self.time)
        if self.steps is not None:
            self.steps = clean_steps(self.steps)
        return self


class BulkItem(BaseModel):
    title: str
    day: int = Field(ge=0, le=6)  # 0 = thứ Hai
    time: Optional[str] = None

    @model_validator(mode="after")
    def _clean(self):
        self.title = clean_title(self.title)
        self.time = clean_time(self.time)
        return self


class BulkIn(BaseModel):
    iso_year: int = Field(ge=2000, le=2100)
    iso_week: int = Field(ge=1, le=53)
    items: list[BulkItem] = Field(min_length=1, max_length=limits.BULK_MAX)


class TaskOut(BaseModel):
    id: int
    title: str
    due_date: date
    day: int  # 0 = thứ Hai ... 6 = Chủ nhật
    iso_year: int
    iso_week: int
    time: str  # "HH:mm" hoặc ""
    is_completed: bool
    completed_at: Optional[datetime] = None
    is_starred: bool
    is_ai_generated: bool
    habit_id: Optional[int] = None
    steps: list[str]


class TrashItemOut(TaskOut):
    deleted_at: datetime


class TaskListOut(BaseModel):
    count: int
    tasks: list[TaskOut]


class CountOut(BaseModel):
    count: int
