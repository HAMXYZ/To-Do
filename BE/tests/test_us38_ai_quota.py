import time
import pytest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError
import io

from src.ai_service import (
    AIServiceError,
    get_ai_quota,
    _reserve_request,
    _usage,
    _usage_lock,
    _AI_REQUEST_LIMIT,
    _AI_WINDOW_SECONDS,
    _request_json,
)


def reset_ai_usage():
    with _usage_lock:
        _usage.clear()


def test_ai_quota_initial_state():
    reset_ai_usage()
    user_id = 9999
    quota = get_ai_quota(user_id)
    assert quota["limit"] == _AI_REQUEST_LIMIT
    assert quota["used"] == 0
    assert quota["remaining"] == _AI_REQUEST_LIMIT
    assert quota["reset_in_seconds"] == 0
    assert quota["window_seconds"] == _AI_WINDOW_SECONDS


def test_ai_quota_rate_limit_exceeded():
    reset_ai_usage()
    user_id = 8888

    # Reserve up to the limit (10 requests)
    for i in range(_AI_REQUEST_LIMIT):
        info = _reserve_request(user_id)
        assert info["used"] == i + 1
        assert info["remaining"] == _AI_REQUEST_LIMIT - (i + 1)

    # 11th request must raise AIServiceError 429
    with pytest.raises(AIServiceError) as exc_info:
        _reserve_request(user_id)

    err = exc_info.value
    assert err.status_code == 429
    assert err.code == "RATE_LIMIT_EXCEEDED"
    assert err.retry_after is not None and err.retry_after > 0
    assert "đạt giới hạn 10 yêu cầu AI trong 10 phút" in err.message

    # Verify quota info shows remaining = 0
    quota = get_ai_quota(user_id)
    assert quota["used"] == _AI_REQUEST_LIMIT
    assert quota["remaining"] == 0
    assert quota["reset_in_seconds"] > 0


def test_ai_quota_window_expiration():
    reset_ai_usage()
    user_id = 7777

    # Simulate calls made 11 minutes ago
    past_time = time.monotonic() - (_AI_WINDOW_SECONDS + 5)
    with _usage_lock:
        _usage[user_id].extend([past_time] * 10)

    # Calling reserve_request now should purge expired calls and succeed
    info = _reserve_request(user_id)
    assert info["used"] == 1
    assert info["remaining"] == _AI_REQUEST_LIMIT - 1


def test_upstream_provider_quota_429():
    with patch("src.ai_service.urlopen") as mock_urlopen:
        fp = io.BytesIO(b'{"error": "RESOURCE_EXHAUSTED", "message": "Quota exceeded"}')
        mock_urlopen.side_effect = HTTPError("https://api.test", 429, "Too Many Requests", {}, fp)

        with pytest.raises(AIServiceError) as exc_info:
            _request_json("dummy_key", "https://api.test", "gemini-1.5-flash", 10, "sys", {"prompt": "test"})

        err = exc_info.value
        assert err.status_code == 429
        assert err.code == "PROVIDER_QUOTA_EXCEEDED"
        assert err.retry_after == 60
        assert "Nhà cung cấp AI (Google AI / OpenAI) đang tạm thời hết hạn mức" in err.message

