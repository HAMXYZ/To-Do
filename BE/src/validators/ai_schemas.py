from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from src import limits
from src.task_schemas import clean_time, clean_title

PROMPT_MAX: int = getattr(limits, "PROMPT_MAX", 500)
BULK_MAX: int = getattr(limits, "BULK_MAX", 50)


def clean_prompt(v: str) -> str:
    if not isinstance(v, str):
        raise ValueError("Nội dung mô tả công việc không hợp lệ")
    v = v.strip()
    if not v:
        raise ValueError("Nội dung mô tả công việc không được để trống")
    if len(v) < 3:
        raise ValueError("Nội dung mô tả công việc cần ít nhất 3 ký tự")
    if len(v) > PROMPT_MAX:
        raise ValueError(f"Nội dung mô tả công việc tối đa {PROMPT_MAX} ký tự")
    return v


class BreakdownRequest(BaseModel):
    prompt: str
    iso_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    iso_week: Optional[int] = Field(default=None, ge=1, le=53)
    start_day: int = Field(default=0, ge=0, le=6)
    deadline_day: Optional[int] = Field(default=None, ge=0, le=6)
    due_time: Optional[str] = Field(default="16:00")

    @model_validator(mode="after")
    def _clean(self):
        self.prompt = clean_prompt(self.prompt)
        self.due_time = clean_time(self.due_time)
        if self.deadline_day is not None and self.deadline_day < self.start_day:
            raise ValueError("Ngày hạn hoàn thành (deadline_day) không được nhỏ hơn ngày bắt đầu (start_day)")
        return self


class BreakdownStepOut(BaseModel):
    id: int
    title: str
    day: int = Field(ge=0, le=6)
    time: str
    is_starred: bool = False
    priority_reason: Optional[str] = None

    @model_validator(mode="after")
    def _clean(self):
        self.title = clean_title(self.title)
        cleaned_t = clean_time(self.time)
        self.time = cleaned_t or ""
        return self


class BreakdownResponse(BaseModel):
    is_prototype: bool = True
    provider: Optional[str] = None
    notice: str = ""
    topic: str
    items: list[BreakdownStepOut]


class PrioritySuggestionRequest(BaseModel):
    iso_year: int = Field(ge=2000, le=2100)
    iso_week: int = Field(ge=1, le=53)
    day: Optional[int] = Field(default=None, ge=0, le=6)


class PrioritySuggestionItem(BaseModel):
    task_id: int
    title: str
    due_date: date
    day: int = Field(ge=0, le=6)
    time: str
    currently_starred: bool
    recommended_star: bool
    score: int
    reason: str


class PrioritySuggestionResponse(BaseModel):
    is_prototype: bool = True
    provider: Optional[str] = None
    notice: str = ""
    suggestions: list[PrioritySuggestionItem]


class PriorityConfirmRequest(BaseModel):
    task_ids: list[int] = Field(min_length=1, max_length=BULK_MAX)
    is_starred: bool = True

    @model_validator(mode="after")
    def _dedup(self):
        seen: list[int] = []
        for tid in self.task_ids:
            if tid <= 0:
                raise ValueError("ID công việc không hợp lệ")
            if tid not in seen:
                seen.append(tid)
        self.task_ids = seen
        return self
