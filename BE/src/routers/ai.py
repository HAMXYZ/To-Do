import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, timedelta
from typing import Any, Optional

from sqlalchemy import select
from src import config, limits
from src.ai_schemas import (
    BreakdownRequest,
    BreakdownResponse,
    BreakdownStepOut,
    PriorityConfirmRequest,
    PrioritySuggestionItem,
    PrioritySuggestionRequest,
    PrioritySuggestionResponse,
)
from src.models import Task, utc_now
from src.routers.tasks import _active, _order, _outs, _steps_for
from src.task_schemas import TaskListOut

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_service import AIServiceError, generate_json, get_ai_quota, transcribe_audio
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
    """Kiểm tra hạn mức gọi AI của người dùng."""
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


# ---------- AI Assistant (Hỏi đáp và nhập liệu bằng giọng nói / văn bản) ----------

class AssistantActionTask(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str | None = None
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
    week_offset: int | None = None

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
    """Trợ lý AI hỏi đáp và nhập liệu nhanh bằng giọng nói hoặc văn bản."""
    del session

    ref_today: date = config.today()
    if body.today_date:
        try:
            ref_today = date.fromisoformat(body.today_date)
        except ValueError:
            pass

    today_str = ref_today.isoformat()
    today_weekday_idx = ref_today.weekday()  # 0=Thứ Hai, ..., 6=Chủ Nhật
    weekday_names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
    today_weekday_name = weekday_names[today_weekday_idx]

    system = (
        f"Bạn là FocusFlow AI Assistant - trợ lý năng suất thông minh, thân thiện bằng tiếng Việt.\n"
        f"HÔM NAY LÀ: {today_weekday_name}, ngày {today_str}.\n"
        "QUY TẮC BẮT BUỘC VỀ THỜI GIAN:\n"
        f"- TUYỆT ĐỐI KHÔNG BAO GIỜ lên lịch hay tạo công việc cho ngày trong quá khứ so với hôm nay ({today_str}). Mọi công việc phải từ ngày hôm nay trở đi (date >= '{today_str}').\n"
        "- Khi người dùng nhắc đến thứ trong tuần:\n"
        "  + Nếu người dùng nói 'tuần sau' hoặc 'tuần tới' (ví dụ: 'thứ 3 tuần sau'): bắt buộc phải tính đúng ngày của thứ đó trong tuần tiếp theo (date = YYYY-MM-DD của tuần sau).\n"
        f"  + Nếu người dùng chỉ nói thứ (ví dụ: 'thứ 3') mà thứ đó đã qua trong tuần hiện tại (hôm nay là {today_weekday_name}): PHẢI TÍNH LÀ THỨ ĐÓ CỦA TUẦN SAU để không bao giờ bị vào quá khứ.\n"
        "  + 'hôm nay' -> date chính là ngày hôm nay.\n"
        "  + 'ngày mai' -> hôm nay + 1 ngày.\n"
        "  + 'ngày kia' -> hôm nay + 2 ngày.\n"
        "  + Nếu người dùng nói ngày cụ thể (ví dụ: '15/11', 'ngày 20'): tính đúng YYYY-MM-DD tương ứng trong tương lai gần nhất.\n"
        "Nhiệm vụ:\n"
        "1. Nhập liệu nhanh: Khi người dùng yêu cầu tạo việc, ghi nhớ công việc, nhắc lịch (từ giọng nói hoặc văn bản), hãy trích xuất công việc vào trường 'action' với type='create_task'. "
        "Trường 'task' gồm: 'title' (tên việc ngắn gọn), 'date' (chuỗi 'YYYY-MM-DD' chính xác của ngày được chọn, bắt buộc >= '{today_str}'), 'day' (số nguyên 0-6: 0 là Thứ Hai... 6 là Chủ Nhật tương ứng với date), "
        "'time' ('HH:MM' hoặc null nếu không nhắc giờ), 'is_starred' (true nếu việc quan trọng, gấp; ngược lại false), 'priority' ('high'|'medium'|'low'). "
        "Viết 'reply' ngắn gọn, dễ thương báo rõ thứ và ngày đã lên lịch cho người dùng (ví dụ: 'Mình đã lên lịch công việc Mua quần áo vào Thứ Ba tuần sau (10/11) cho bạn nhé! ✨').\n"
        "2. Hỏi đáp nhanh: Khi người dùng hỏi mẹo quản lý thời gian, cách lập kế hoạch, câu hỏi năng suất hoặc chào hỏi, hãy trả lời ngắn gọn, thực tế, động viên (1-3 câu). Đặt action=null hoặc action.type='none'.\n"
        "Chỉ trả JSON object dạng: {\"reply\": string, \"action\": {\"type\": \"create_task\"|\"none\", \"task\": {\"title\": string, \"date\": \"YYYY-MM-DD\", \"day\": int, \"time\": string|null, \"is_starred\": bool, \"priority\": \"low\"|\"medium\"|\"high\"}} | null}.\n"
        "Tuyệt đối không bọc trong markdown code fence."
    )
    try:
        result, provider, quota_info = await generate_json(
            user.id,
            system,
            {
                "user_message": body.message,
                "today_date": today_str,
                "today_weekday": today_weekday_name,
                "current_day": today_weekday_idx,
            },
        )

        # Backend Safety Guard: Đảm bảo task không bao giờ rơi vào quá khứ
        if result and isinstance(result, dict):
            action = result.get("action")
            if isinstance(action, dict) and action.get("type") == "create_task":
                task_data = action.get("task")
                if isinstance(task_data, dict):
                    task_date_str = str(task_data.get("date") or "").strip()
                    task_day = task_data.get("day")
                    user_msg_lower = body.message.lower()
                    is_next_week = any(w in user_msg_lower for w in ["tuần sau", "tuần tới", "next week"])

                    target_date: date | None = None
                    if task_date_str:
                        try:
                            target_date = date.fromisoformat(task_date_str)
                        except ValueError:
                            m = re.match(r"^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$", task_date_str)
                            if m:
                                d_val = int(m.group(1))
                                m_val = int(m.group(2))
                                y_val = int(m.group(3)) if m.group(3) else ref_today.year
                                try:
                                    target_date = date(y_val, m_val, d_val)
                                except ValueError:
                                    target_date = None

                    if target_date is not None:
                        if target_date < ref_today:
                            diff_days = (ref_today - target_date).days
                            weeks_needed = (diff_days // 7) + 1
                            target_date = target_date + timedelta(days=weeks_needed * 7)
                        elif is_next_week:
                            next_monday = ref_today + timedelta(days=(7 - today_weekday_idx))
                            if target_date < next_monday:
                                target_date = target_date + timedelta(days=7)
                    elif task_day is not None and isinstance(task_day, int) and 0 <= task_day <= 6:
                        days_diff = task_day - today_weekday_idx
                        if is_next_week:
                            next_monday = ref_today + timedelta(days=(7 - today_weekday_idx))
                            target_date = next_monday + timedelta(days=task_day)
                        elif days_diff < 0:
                            target_date = ref_today + timedelta(days=7 + days_diff)
                        else:
                            target_date = ref_today + timedelta(days=days_diff)
                    else:
                        target_date = ref_today

                    if target_date < ref_today:
                        target_date = ref_today

                    task_data["date"] = target_date.isoformat()
                    task_data["day"] = target_date.weekday()

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


class AITranscribeIn(BaseModel):
    audio_base64: str = Field(min_length=10)
    mime_type: str = "audio/webm"

    @field_validator("audio_base64")
    @classmethod
    def clean_base64(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Dữ liệu âm thanh không được để trống.")
        return value


class AITranscribeOut(BaseModel):
    text: str
    provider: str


@router.post("/transcribe", response_model=AITranscribeOut)
async def transcribe_audio_endpoint(
    body: AITranscribeIn,
    response: Response,
    user: User = Depends(get_current_user),
):
    """Nhận diện giọng nói từ dữ liệu âm thanh ghi âm (Hỗ trợ Electron Desktop & Web)."""
    try:
        text, provider, quota_info = await transcribe_audio(
            user.id, body.audio_base64, body.mime_type
        )
        response.headers["X-RateLimit-Limit"] = str(quota_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(quota_info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(quota_info["reset_in_seconds"])
        return AITranscribeOut(text=text, provider=provider)
    except AIServiceError as exc:
        headers: dict[str, str] = {}
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        if exc.details.get("limit") is not None:
            headers["X-RateLimit-Limit"] = str(exc.details["limit"])
            headers["X-RateLimit-Remaining"] = str(exc.details.get("remaining", 0))
            headers["X-RateLimit-Reset"] = str(exc.details.get("reset_in_seconds", 0))
        detail = {
            "code": exc.code,
            "message": exc.message,
            "retry_after": exc.retry_after,
        }
        raise HTTPException(status_code=exc.status_code, detail=detail, headers=headers) from exc


# ===========================================================================
# AI Breakdown & Priority Suggestions
# ===========================================================================

PROMPT_MAX: int = getattr(limits, "PROMPT_MAX", 500)
BULK_MAX: int = getattr(limits, "BULK_MAX", 50)
TITLE_MAX: int = getattr(limits, "TITLE_MAX", 200)

DEFAULT_GEMINI_KEY = "AQ.Ab8RN6JbGPYgPIqpPVQU-dHn8NvDZFOnBRmK090G7P8AvBR9gQ"
GEMINI_API_KEY: str = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or getattr(config, "GEMINI_API_KEY", "")
    or DEFAULT_GEMINI_KEY
).strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
GEMINI_CANDIDATE_MODELS: list[str] = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
]
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

_PRIORITY_KEYWORDS = re.compile(
    r"\b(deadline|urgent|asap|submit|present|presentation|pitch|exam|test|quiz|client|deploy|release|fix|bug|critical|important|review|report|final|báo cáo|nộp|họp|thi|kiểm tra|thuyết trình|khẩn|gấp|quan trọng|chốt)\b",
    re.IGNORECASE,
)


def _extract_topic(prompt: str) -> str:
    topic = re.split(
        r",|\bdeadline\s*:|\bhạn\s*:|\bdue\s*:", prompt, maxsplit=1, flags=re.IGNORECASE
    )[0].strip()
    if not topic:
        topic = prompt.strip()
    return topic[:TITLE_MAX]


def _extract_json_dict(raw_text: str) -> Optional[dict[str, Any]]:
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^\`\`\`(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*\`\`\`$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return None


def _call_llm_json(
    system_instruction: str, user_prompt: str
) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    if GEMINI_API_KEY:
        models_to_try: list[str] = []
        for m in [GEMINI_MODEL, *GEMINI_CANDIDATE_MODELS]:
            if m and m not in models_to_try:
                models_to_try.append(m)

        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "responseMimeType": "application/json",
            },
        }
        body_bytes = json.dumps(payload).encode("utf-8")

        for model_name in models_to_try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_name}:generateContent?key={GEMINI_API_KEY}"
            )
            req = urllib.request.Request(
                url,
                data=body_bytes,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": GEMINI_API_KEY,
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    raw = json.loads(resp.read().decode("utf-8"))
                    text = (
                        raw.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [{}])[0]
                        .get("text", "")
                    )
                    parsed = _extract_json_dict(text)
                    if parsed:
                        return parsed, f"google-gemini ({model_name})"
            except urllib.error.HTTPError as e:
                if e.code in (400, 404, 429, 503):
                    continue
                break
            except Exception:
                continue

    if OPENAI_API_KEY:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": OPENAI_MODEL,
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
                text = raw.get("choices", [{}])[0].get("message", {}).get("content", "")
                parsed = _extract_json_dict(text)
                if parsed:
                    return parsed, f"openai ({OPENAI_MODEL})"
        except Exception:
            pass

    return None, None


def _build_prototype_steps(
    prompt: str,
    start_day: int,
    deadline_day: Optional[int],
    due_time: Optional[str],
) -> tuple[str, list[BreakdownStepOut]]:
    topic = _extract_topic(prompt)
    lower_topic = topic.lower()
    target_end = deadline_day if deadline_day is not None else min(start_day + 3, 6)
    target_end = max(start_day, min(target_end, 6))
    final_time = due_time if due_time is not None else "16:00"

    segments = [
        s.strip()
        for s in re.split(
            r"\n|;|•|-|\b(?:bước|step)\s*\d+\s*[:.)]", prompt, flags=re.IGNORECASE
        )
        if len(s.strip()) >= 3
    ]

    if len(segments) >= 2:
        raw_steps = []
        chosen = segments[:8]
        for idx, seg in enumerate(chosen):
            is_first = idx == 0
            is_last = idx == len(chosen) - 1
            raw_steps.append(
                (
                    seg[:TITLE_MAX],
                    final_time if is_last else ("09:00" if is_first else "14:00"),
                    is_first or is_last,
                    "Bước khởi đầu quan trọng"
                    if is_first
                    else ("Bước hoàn thiện trước hạn chót" if is_last else None),
                )
            )
    elif re.search(
        r"present|slide|pitch|revenue|deck|thuyết trình|báo cáo", lower_topic
    ):
        raw_steps = [
            (
                f"Thu thập dữ liệu & số liệu cho {topic}",
                "09:30",
                True,
                "Bước nền tảng: cần chuẩn bị dữ liệu đầu tiên",
            ),
            (f"Phân tích nội dung trọng tâm của {topic}", "10:30", False, None),
            (f"Thiết kế bố cục slide & trực quan hóa {topic}", "14:00", False, None),
            (
                f"Rà soát & tổng duyệt {topic}",
                final_time or "16:00",
                True,
                "Bước chốt trước hạn hoàn thành",
            ),
        ]
    elif re.search(
        r"code|api|bug|feature|backend|frontend|app|website|test|deploy|lập trình|phần mềm",
        lower_topic,
    ):
        raw_steps = [
            (
                f"Phân tích yêu cầu & thiết kế kỹ thuật cho {topic}",
                "09:00",
                True,
                "Bước khởi đầu quan trọng để định hình kỹ thuật",
            ),
            (f"Xây dựng xử lý logic chính ({topic})", "10:30", False, None),
            ("Viết kiểm thử (test) & kiểm tra trường hợp biên", "14:00", False, None),
            (
                f"Hoàn thiện & bàn giao {topic}",
                final_time or "16:00",
                True,
                "Bước hoàn tất và bàn giao trước deadline",
            ),
        ]
    elif re.search(
        r"study|exam|learn|course|read|research|ôn tập|thi|học|nghiên cứu", lower_topic
    ):
        raw_steps = [
            (
                f"Tổng hợp tài liệu & đề cương cho {topic}",
                "09:00",
                True,
                "Chuẩn bị tài liệu cốt lõi trước khi học",
            ),
            (f"Tóm tắt các khái niệm trọng tâm của {topic}", "10:30", False, None),
            ("Làm bài tập vận dụng & ghi nhớ chủ động", "14:30", False, None),
            (
                f"Tổng ôn tập & tự kiểm tra {topic}",
                final_time or "16:00",
                True,
                "Tổng duyệt kiến thức trước hạn",
            ),
        ]
    else:
        raw_steps = [
            (
                f"Chuẩn bị tài liệu & xác định mục tiêu cho {topic}",
                "09:30",
                True,
                "Bước mở đầu cần ưu tiên thực hiện trước",
            ),
            (f"Lập dàn ý chi tiết các hạng mục của {topic}", "10:30", False, None),
            (f"Triển khai thực hiện nội dung chính {topic}", "14:00", False, None),
            (
                f"Kiểm tra chất lượng & hoàn tất {topic}",
                final_time or "16:00",
                True,
                "Bước hoàn thiện cuối cùng theo hạn chót",
            ),
        ]

    span = max(0, target_end - start_day)
    n = len(raw_steps)
    items: list[BreakdownStepOut] = []
    for idx, (title, default_time, starred, reason) in enumerate(raw_steps):
        if idx == n - 1:
            day = target_end
            step_time = final_time if final_time is not None else default_time
        else:
            offset = (
                round(idx * span / max(1, n - 1))
                if span > 0
                else min(idx, 6 - start_day)
            )
            day = min(6, start_day + offset)
            step_time = default_time
        items.append(
            BreakdownStepOut(
                id=idx + 1,
                title=title[:TITLE_MAX],
                day=day,
                time=step_time,
                is_starred=starred,
                priority_reason=reason,
            )
        )
    return topic, items


def _build_ai_or_fallback_steps(
    prompt: str,
    start_day: int,
    deadline_day: Optional[int],
    due_time: Optional[str],
) -> tuple[str, list[BreakdownStepOut], bool, Optional[str]]:
    topic = _extract_topic(prompt)
    target_end = deadline_day if deadline_day is not None else min(start_day + 3, 6)
    target_end = max(start_day, min(target_end, 6))
    final_time = due_time if due_time is not None else "16:00"

    system_prompt = (
        "Bạn là trợ lý lập kế hoạch công việc thông minh FocusFlow AI. "
        "Hãy phân rã mục tiêu công việc của người dùng thành 4 đến 6 bước hành động cụ thể, ngắn gọn, khả thi trong tuần. "
        "Trả về duy nhất JSON theo cấu trúc: "
        '{"topic": "tên chủ đề", "steps": [{"title": "tên bước", "day": 0, "time": "09:30", "is_starred": true, "priority_reason": "lý do ngắn gọn"}]} '
        f"Trong đó day là số nguyên từ {start_day} đến {target_end} (0=Thứ Hai .. 6=Chủ Nhật), "
        f"bước cuối cùng phải có day={target_end} và time='{final_time}'. Chỉ đánh dấu is_starred=true cho 1-2 bước quan trọng nhất."
    )
    llm_data, provider_name = _call_llm_json(system_prompt, prompt)
    if (
        llm_data
        and isinstance(llm_data.get("steps"), list)
        and len(llm_data["steps"]) > 0
    ):
        parsed_items: list[BreakdownStepOut] = []
        for st in llm_data["steps"][:8]:
            try:
                raw_title = str(st.get("title") or "").strip()[:TITLE_MAX]
                if not raw_title:
                    continue
                raw_day = int(st.get("day", start_day))
                raw_day = max(start_day, min(6, raw_day))
                raw_time = str(st.get("time") or "09:30").strip()
                parsed_items.append(
                    BreakdownStepOut(
                        id=len(parsed_items) + 1,
                        title=raw_title,
                        day=raw_day,
                        time=raw_time,
                        is_starred=bool(st.get("is_starred", False)),
                        priority_reason=st.get("priority_reason"),
                    )
                )
            except Exception:
                continue
        if parsed_items:
            ai_topic = str(llm_data.get("topic") or topic).strip()[:TITLE_MAX] or topic
            return ai_topic, parsed_items, False, provider_name

    fallback_topic, fallback_items = _build_prototype_steps(
        prompt=prompt,
        start_day=start_day,
        deadline_day=deadline_day,
        due_time=due_time,
    )
    return fallback_topic, fallback_items, True, "gemini-hybrid-fallback"


def _evaluate_task_priority(
    t: Task,
    steps_count: int,
    today: date,
) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []

    days_until = (t.due_date - today).days
    if days_until < 0:
        score += 45
        reasons.append("Đã quá hạn hoàn thành, cần ưu tiên xử lý sớm")
    elif days_until == 0:
        score += 40
        reasons.append("Đến hạn ngay hôm nay")
    elif days_until == 1:
        score += 25
        reasons.append("Đến hạn vào ngày mai")
    elif days_until <= 3:
        score += 15
        reasons.append(f"Sắp đến hạn trong {days_until} ngày tới")

    if t.due_time is not None:
        hm = t.due_time.strftime("%H:%M")
        if t.due_time.hour < 12:
            score += 25
            reasons.append(f"Có mốc giờ sớm trong buổi sáng ({hm})")
        elif t.due_time.hour < 15:
            score += 18
            reasons.append(f"Có mốc giờ cụ thể đầu giờ chiều ({hm})")
        else:
            score += 12
            reasons.append(f"Có đặt mốc giờ hoàn thành ({hm})")

    if steps_count > 0:
        score += min(20, steps_count * 5)
        reasons.append(f"Gồm {steps_count} bước con cần phối hợp thực hiện")

    if _PRIORITY_KEYWORDS.search(t.title):
        score += 20
        reasons.append("Tiêu đề chứa từ khóa công việc trọng tâm/quan trọng")

    if t.is_ai_generated:
        score += 5

    return score, reasons


@router.post("/breakdown", response_model=BreakdownResponse)
async def preview_breakdown(
    body: BreakdownRequest,
    user: User = Depends(get_current_user),
):
    _ = user
    if body.iso_year is not None and body.iso_week is not None:
        try:
            date.fromisocalendar(body.iso_year, body.iso_week, 1)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Tuần ISO không hợp lệ"
            )

    topic, items, is_proto, provider = _build_ai_or_fallback_steps(
        prompt=body.prompt,
        start_day=body.start_day,
        deadline_day=body.deadline_day,
        due_time=body.due_time,
    )
    return BreakdownResponse(
        is_prototype=is_proto,
        provider=provider,
        notice="",
        topic=topic,
        items=items,
    )


@router.post("/priority-suggestions", response_model=PrioritySuggestionResponse)
async def suggest_priorities(
    body: PrioritySuggestionRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        monday = date.fromisocalendar(body.iso_year, body.iso_week, 1)
    except ValueError:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Tuần ISO không hợp lệ"
        )

    sunday = monday + timedelta(days=6)
    today = config.today()

    conds = [
        *_active(user),
        Task.is_completed.is_(False),
        Task.due_date >= monday,
        Task.due_date <= sunday,
    ]
    if body.day is not None:
        conds.append(Task.due_date == monday + timedelta(days=body.day))

    tasks = list(
        (await session.scalars(select(Task).where(*conds).order_by(*_order()))).all()
    )
    steps_map = await _steps_for(session, tasks)

    scored: list[PrioritySuggestionItem] = []
    for t in tasks:
        steps_count = len(steps_map.get(t.id, []))
        score, reasons = _evaluate_task_priority(t, steps_count, today)
        if not reasons:
            reasons.append("Công việc chưa hoàn thành trong tuần")
        recommended = score >= 25 or bool(t.is_starred)
        scored.append(
            PrioritySuggestionItem(
                task_id=t.id,
                title=t.title,
                due_date=t.due_date,
                day=t.due_date.weekday(),
                time=t.due_time.strftime("%H:%M") if t.due_time else "",
                currently_starred=t.is_starred,
                recommended_star=recommended,
                score=score,
                reason=" · ".join(reasons),
            )
        )

    is_proto = True
    provider_name: Optional[str] = "gemini-hybrid-fallback"

    if scored:
        tasks_payload = [
            {
                "task_id": item.task_id,
                "title": item.title,
                "due_date": str(item.due_date),
                "time": item.time,
                "currently_starred": item.currently_starred,
            }
            for item in scored
        ]
        sys_prompt = (
            "Bạn là trợ lý quản lý công việc FocusFlow AI. Dựa trên danh sách công việc chưa hoàn thành dưới đây, "
            "hãy đánh giá độ ưu tiên (score từ 10-100, recommended_star=true cho các việc quan trọng/gấp, và reason ngắn gọn bằng tiếng Việt). "
            'Trả về duy nhất JSON: {"suggestions": [{"task_id": 1, "recommended_star": true, "score": 85, "reason": "lý do ngắn gọn"}]}'
        )
        llm_res, llm_provider = _call_llm_json(
            sys_prompt, json.dumps(tasks_payload, ensure_ascii=False)
        )
        if llm_res and isinstance(llm_res.get("suggestions"), list):
            ai_map = {
                int(x["task_id"]): x
                for x in llm_res["suggestions"]
                if isinstance(x, dict) and "task_id" in x
            }
            if ai_map:
                is_proto = False
                provider_name = llm_provider
                for item in scored:
                    if item.task_id in ai_map:
                        ai_item = ai_map[item.task_id]
                        item.recommended_star = bool(
                            ai_item.get("recommended_star", item.recommended_star)
                        )
                        item.score = int(ai_item.get("score", item.score))
                        if ai_item.get("reason"):
                            item.reason = str(ai_item["reason"]).strip()

    scored.sort(
        key=lambda item: (
            -item.score,
            item.day,
            item.time == "",
            item.time,
            item.task_id,
        )
    )

    if scored and not any(item.recommended_star for item in scored):
        for item in scored[: min(2, len(scored))]:
            item.recommended_star = True

    return PrioritySuggestionResponse(
        is_prototype=is_proto,
        provider=provider_name,
        notice="",
        suggestions=scored,
    )


@router.post("/priority-confirm", response_model=TaskListOut)
async def confirm_priority_suggestions(
    body: PriorityConfirmRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    tasks = list(
        (
            await session.scalars(
                select(Task).where(
                    *_active(user),
                    Task.id.in_(body.task_ids),
                )
            )
        ).all()
    )
    if len(tasks) != len(body.task_ids):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Một hoặc nhiều công việc không tồn tại hoặc không thuộc quyền sở hữu của bạn",
        )

    now = utc_now()
    for t in tasks:
        if t.is_starred != body.is_starred:
            t.is_starred = body.is_starred
            t.user_modified_at = now

    await session.commit()
    return {"count": len(tasks), "tasks": await _outs(session, tasks)}