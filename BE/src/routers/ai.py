from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_service import AIServiceError, generate_json
from src.db import get_session
from src.deps import get_current_user
from src.models import User

router = APIRouter(prefix="/ai", tags=["ai"])


class HabitRecognitionIn(BaseModel):
    text: str = Field(min_length=3, max_length=500)

    @field_validator("text")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Hãy mô tả thói quen bằng ít nhất 3 ký tự.")
        return value


class HabitSuggestion(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    frequency: Literal["daily", "weekdays", "custom"]
    days: list[int] = Field(default_factory=list, max_length=7)
    time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    reason: str = Field(min_length=1, max_length=240)
    confidence: int = Field(ge=0, le=100)

    @field_validator("title", "reason")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Trường văn bản không được để trống.")
        return value

    @field_validator("days")
    @classmethod
    def valid_days(cls, value: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in value) or len(set(value)) != len(value):
            raise ValueError("Ngày trong tuần phải là các số khác nhau từ 0 đến 6.")
        return value

    @model_validator(mode="after")
    def require_custom_days(self):
        if self.frequency == "custom" and not self.days:
            raise ValueError("Habit tùy chỉnh cần ít nhất một ngày.")
        if self.frequency != "custom":
            self.days = []
        return self


class HabitRecognitionOut(BaseModel):
    suggestions: list[HabitSuggestion] = Field(max_length=3)
    notice: str = Field(max_length=240)
    provider: str


@router.post("/habits/recognize", response_model=HabitRecognitionOut)
async def recognize_habits(
    body: HabitRecognitionIn,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    del session  # Recognition does not read or change account data.
    system = (
        "Bạn trích xuất tối đa 3 thói quen mà người dùng mô tả rõ ràng từ văn bản tiếng Việt. "
        "Chỉ trả JSON object dạng {\"suggestions\":[{\"title\":string,\"frequency\":\"daily|weekdays|custom\","
        "\"days\":[0..6],\"time\":\"HH:MM|null\",\"reason\":string,\"confidence\":0..100}],"
        "\"notice\":string}. Ngày 0 là thứ Hai, 6 là Chủ nhật. Không tự bịa thời gian; không rõ thì time=null. "
        "Nếu mô tả không thể hiện thói quen lặp lại thì trả suggestions rỗng. "
        "Không tạo, lưu hoặc thay đổi dữ liệu. Không trả markdown."
    )
    try:
        result, provider = await generate_json(
            user.id,
            system,
            {"habit_description": body.text},
        )
        return HabitRecognitionOut.model_validate({**result, "provider": provider})
    except AIServiceError as exc:
        raise HTTPException(exc.status_code, exc.message) from exc
    except ValidationError as exc:
        raise HTTPException(502, "AI trả về gợi ý habit không hợp lệ. Hãy thử lại.") from exc
