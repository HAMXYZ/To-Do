import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from src.db import get_session
from src.deps import get_current_user
from src.models import Task, User, utc_now
from src.routers.tasks import _active, _order, _outs, _steps_for
from src.task_schemas import TaskListOut

router = APIRouter(prefix="/ai", tags=["ai"])

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
