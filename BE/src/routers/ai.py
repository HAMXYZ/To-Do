from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_service import AIServiceError, generate_json, get_ai_quota
from src.db import get_session
from src.deps import get_current_user
from src.models import User

router = APIRouter(prefix="/ai", tags=["ai"])


class AIQuotaOut(BaseModel):
    limit: int
    used: int
    remaining: int
    reset_in_seconds: int
    window_seconds: int
    provider: str


@router.get("/quota", response_model=AIQuotaOut)
def get_ai_quota_status(user: User = Depends(get_current_user)):
    """Kiểm tra hạn mức gọi AI của người dùng (US-38)."""
    return get_ai_quota(user.id)


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
    response: Response,
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
        result, provider, quota_info = await generate_json(
            user.id,
            system,
            {"habit_description": body.text},
        )
        response.headers["X-RateLimit-Limit"] = str(quota_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(quota_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(quota_info["reset_in_seconds"])
        return HabitRecognitionOut.model_validate({**result, "provider": provider})
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
    except ValidationError as exc:
        raise HTTPException(502, "AI trả về gợi ý habit không hợp lệ. Hãy thử lại.") from exc


# ---------- US-33: AI Assistant (Hỏi đáp và nhập liệu bằng giọng nói / văn bản) ----------

class AssistantActionTask(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    day: int | None = Field(default=None, ge=0, le=6)
    time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    is_starred: bool = False
    priority: Literal["low", "medium", "high"] = "medium"

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tiêu đề công việc không được để trống.")
        return value


class AssistantAction(BaseModel):
    type: Literal["create_task", "none"] = "none"
    task: AssistantActionTask | None = None


class AIAssistantIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    current_day: int | None = Field(default=0, ge=0, le=6)
    today_date: str | None = None

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nội dung tin nhắn không được để trống.")
        return value


class AIAssistantOut(BaseModel):
    reply: str = Field(min_length=1, max_length=2000)
    action: AssistantAction | None = None
    provider: str


@router.post("/assistant", response_model=AIAssistantOut)
async def ask_ai_assistant(
    body: AIAssistantIn,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Trợ lý AI hỏi đáp và nhập liệu nhanh bằng giọng nói hoặc văn bản (US-33)."""
    del session
    system = (
        "Bạn là FocusFlow AI Assistant - trợ lý năng suất thông minh, thân thiện bằng tiếng Việt. "
        "Bạn thực hiện 2 nhiệm vụ chính (US-33): "
        "1. Nhập liệu nhanh: Khi người dùng yêu cầu tạo việc, ghi nhớ công việc, nhắc lịch (từ giọng nói hoặc văn bản), "
        "hãy trích xuất công việc vào trường 'action' với type='create_task'. "
        "task gồm: 'title' (tên việc ngắn gọn), 'day' (số nguyên 0-6: 0 là Thứ Hai, 1 là Thứ Ba... 6 là Chủ Nhật; "
        "nếu người dùng nói 'hôm nay' thì dùng current_day, 'ngày mai' thì (current_day+1)%7; mặc định current_day nếu không rõ ngày), "
        "'time' ('HH:MM' hoặc null nếu không nhắc giờ), 'is_starred' (true nếu việc quan trọng, gấp, ưu tiên cao; ngược lại false), "
        "'priority' ('high'|'medium'|'low'). "
        "Viết 'reply' ngắn gọn, dễ thương báo cho người dùng biết đã trích xuất công việc. "
        "2. Hỏi đáp nhanh: Khi người dùng hỏi mẹo quản lý thời gian, cách lập kế hoạch, câu hỏi năng suất hoặc chào hỏi, "
        "hãy trả lời ngắn gọn, thực tế, động viên (1-3 câu). Đặt action=null hoặc action.type='none'. "
        "Chỉ trả JSON object dạng: {\"reply\": string, \"action\": {\"type\": \"create_task\"|\"none\", \"task\": {\"title\": string, \"day\": int, \"time\": string|null, \"is_starred\": bool, \"priority\": \"low\"|\"medium\"|\"high\"}} | null}. "
        "Tuyệt đối không bọc trong markdown code fence."
    )
    try:
        result, provider, quota_info = await generate_json(
            user.id,
            system,
            {
                "user_message": body.message,
                "current_day": body.current_day if body.current_day is not None else 0,
                "today_date": body.today_date or "",
            },
        )
        response.headers["X-RateLimit-Limit"] = str(quota_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(quota_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(quota_info["reset_in_seconds"])
        return AIAssistantOut.model_validate({**result, "provider": provider})
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
    except ValidationError as exc:
        raise HTTPException(502, "Trợ lý AI trả về dữ liệu không đúng cấu trúc yêu cầu. Hãy thử lại.") from exc
