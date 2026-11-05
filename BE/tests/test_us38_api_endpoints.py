import time
from unittest.mock import MagicMock
from src.ai_service import _AI_REQUEST_LIMIT, _usage, _usage_lock
from src.routers.ai import get_ai_quota_status


def setup_function():
    with _usage_lock:
        _usage.clear()


def test_get_ai_quota_status_endpoint():
    user = MagicMock()
    user.id = 123
    data = get_ai_quota_status(user)
    assert data["limit"] == 10
    assert data["used"] == 0
    assert data["remaining"] == 10
    assert data["reset_in_seconds"] == 0
    assert data["window_seconds"] == 600
    assert data["provider"] == "generativelanguage.googleapis.com"


def test_get_ai_quota_status_with_existing_usage():
    user = MagicMock()
    user.id = 456
    now = time.monotonic()
    with _usage_lock:
        _usage[456].extend([now, now])

    data = get_ai_quota_status(user)
    assert data["limit"] == 10
    assert data["used"] == 2
    assert data["remaining"] == 8
    assert data["reset_in_seconds"] > 0
    assert data["window_seconds"] == 600
