from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from collections import defaultdict, deque
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class AIServiceError(Exception):
    def __init__(
        self,
        status_code: int,
        message: str,
        code: str | None = None,
        retry_after: int | None = None,
        details: dict | None = None,
    ):
        self.status_code = status_code
        self.message = message
        self.code = code or ("RATE_LIMIT_EXCEEDED" if status_code == 429 else "AI_ERROR")
        self.retry_after = retry_after
        self.details = details or {}
        super().__init__(message)


_usage: dict[int, deque[float]] = defaultdict(deque)
_usage_lock = threading.Lock()
_AI_REQUEST_LIMIT = 10
_AI_WINDOW_SECONDS = 10 * 60
_MAX_RESPONSE_BYTES = 256 * 1024


def get_ai_quota(user_id: int) -> dict:
    """Lấy thông tin hạn mức sử dụng AI hiện tại của người dùng."""
    now = time.monotonic()
    with _usage_lock:
        calls = _usage[user_id]
        while calls and now - calls[0] >= _AI_WINDOW_SECONDS:
            calls.popleft()
        used = len(calls)
        remaining = max(0, _AI_REQUEST_LIMIT - used)
        reset_in = max(0, int(_AI_WINDOW_SECONDS - (now - calls[0]))) if calls else 0

    base_url = os.getenv("AI_API_BASE_URL", "").strip()
    provider = urlparse(base_url).netloc if base_url else "google_ai"

    return {
        "limit": _AI_REQUEST_LIMIT,
        "used": used,
        "remaining": remaining,
        "reset_in_seconds": reset_in,
        "window_seconds": _AI_WINDOW_SECONDS,
        "provider": provider,
    }


def _settings() -> tuple[str, str, str, int]:
    provider = os.getenv("AI_PROVIDER", "openai_compatible").strip().lower()
    api_key = os.getenv("AI_API_KEY", "").strip()
    base_url = os.getenv("AI_API_BASE_URL", "").strip().rstrip("/")
    model = os.getenv("AI_MODEL", "").strip()
    try:
        timeout = int(os.getenv("AI_TIMEOUT_SECONDS", "30"))
    except ValueError as exc:
        raise AIServiceError(503, "AI_TIMEOUT_SECONDS phải là số nguyên.") from exc

    if provider != "openai_compatible":
        raise AIServiceError(503, "AI_PROVIDER hiện chỉ hỗ trợ openai_compatible.")
    if not api_key or not base_url or not model or api_key.startswith("YOUR_"):
        raise AIServiceError(
            503,
            "AI chưa được cấu hình hoặc AI_API_KEY chưa được điền. Hãy đặt API key thật từ Google AI Studio trong BE/.env.",
        )
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AIServiceError(503, "AI_API_BASE_URL không hợp lệ.")
    if not 1 <= timeout <= 30:
        raise AIServiceError(503, "AI_TIMEOUT_SECONDS phải nằm trong khoảng 1–30.")
    return api_key, base_url, model, timeout


def _reserve_request(user_id: int) -> dict:
    now = time.monotonic()
    with _usage_lock:
        calls = _usage[user_id]
        while calls and now - calls[0] >= _AI_WINDOW_SECONDS:
            calls.popleft()
        if len(calls) >= _AI_REQUEST_LIMIT:
            reset_in = max(1, int(_AI_WINDOW_SECONDS - (now - calls[0])))
            raise AIServiceError(
                429,
                f"Bạn đã đạt giới hạn {_AI_REQUEST_LIMIT} yêu cầu AI trong {int(_AI_WINDOW_SECONDS // 60)} phút. Vui lòng thử lại sau {reset_in} giây.",
                code="RATE_LIMIT_EXCEEDED",
                retry_after=reset_in,
                details={
                    "limit": _AI_REQUEST_LIMIT,
                    "used": len(calls),
                    "remaining": 0,
                    "reset_in_seconds": reset_in,
                },
            )
        calls.append(now)
        used = len(calls)
        remaining = max(0, _AI_REQUEST_LIMIT - used)
        reset_in = max(0, int(_AI_WINDOW_SECONDS - (now - calls[0])))
        return {
            "limit": _AI_REQUEST_LIMIT,
            "used": used,
            "remaining": remaining,
            "reset_in_seconds": reset_in,
        }


def _request_json(api_key: str, base_url: str, model: str, timeout: int, system: str, payload: dict) -> dict:
    body = json.dumps(
        {
            "model": model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = Request(
        f"{base_url}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read(_MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        err_body = ""
        try:
            err_body = exc.read().decode("utf-8", errors="ignore")
        except Exception:
            pass

        if exc.code == 429:
            raise AIServiceError(
                429,
                "Nhà cung cấp AI (Google AI / OpenAI) đang tạm thời hết hạn mức (Quota / Rate Limit). Vui lòng thử lại sau.",
                code="PROVIDER_QUOTA_EXCEEDED",
                retry_after=60,
            ) from exc
        if exc.code in (401, 403) or "API key" in err_body or "API_KEY" in err_body:
            raise AIServiceError(503, "Khóa AI (AI_API_KEY) không hợp lệ hoặc bị từ chối. Hãy kiểm tra lại key trong BE/.env.") from exc
        raise AIServiceError(502, "Nhà cung cấp AI chưa thể xử lý yêu cầu.") from exc
    except (TimeoutError, asyncio.TimeoutError) as exc:
        raise AIServiceError(504, "Yêu cầu AI đã quá thời gian chờ. Hãy thử lại.") from exc
    except URLError as exc:
        if isinstance(exc.reason, TimeoutError):
            raise AIServiceError(504, "Yêu cầu AI đã quá thời gian chờ. Hãy thử lại.") from exc
        raise AIServiceError(502, "Không kết nối được nhà cung cấp AI.") from exc

    if len(raw) > _MAX_RESPONSE_BYTES:
        raise AIServiceError(502, "Phản hồi AI vượt quá giới hạn cho phép.")
    try:
        envelope = json.loads(raw)
        content = envelope["choices"][0]["message"]["content"]
        result = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
        raise AIServiceError(502, "AI trả về dữ liệu không đúng cấu trúc JSON.") from exc
    if not isinstance(result, dict):
        raise AIServiceError(502, "AI trả về dữ liệu không đúng cấu trúc.")
    return result


async def generate_json(user_id: int, system: str, payload: dict) -> tuple[dict, str, dict]:
    api_key, base_url, model, timeout = _settings()
    quota_info = _reserve_request(user_id)
    result = await asyncio.to_thread(
        _request_json, api_key, base_url, model, timeout, system, payload
    )
    provider = urlparse(base_url).netloc
    return result, provider, quota_info
