import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, Response
from pydantic import ValidationError

from src.ai_service import AIServiceError
from src.routers.ai import (
    AIAssistantIn,
    AIAssistantOut,
    AssistantAction,
    AssistantActionTask,
    ask_ai_assistant,
)


def test_ai_assistant_input_validation():
    # Empty message should fail
    with pytest.raises(ValidationError):
        AIAssistantIn(message="   ")

    # Valid message
    valid = AIAssistantIn(message="Làm sao để tập trung?", current_day=2)
    assert valid.message == "Làm sao để tập trung?"
    assert valid.current_day == 2


def test_ai_assistant_qa_response():
    fake_result = {
        "reply": "Để tập trung tốt hơn, bạn có thể thử phương pháp Pomodoro 25 phút làm việc và 5 phút nghỉ ngơi.",
        "action": None,
    }
    fake_quota = {
        "limit": 10,
        "used": 1,
        "remaining": 9,
        "reset_in_seconds": 600,
    }

    user = MagicMock()
    user.id = 101

    body = AIAssistantIn(message="Làm sao để tập trung?")
    response = Response()

    with patch("src.routers.ai.generate_json") as mock_gen:
        # Mocking the coroutine returned by generate_json
        async def mock_call(*args, **kwargs):
            return fake_result, "google_ai", fake_quota

        mock_gen.side_effect = mock_call

        # Call the endpoint directly with an event loop or testing coroutine
        coro = ask_ai_assistant(body, response, user=user, session=None)
        # Using coro.send(None) to drive the coroutine to completion
        try:
            coro.send(None)
        except StopIteration as e:
            res = e.value

        assert isinstance(res, AIAssistantOut)
        assert "Pomodoro" in res.reply
        assert res.action is None
        assert response.headers["X-RateLimit-Limit"] == "10"
        assert response.headers["X-RateLimit-Remaining"] == "9"


def test_ai_assistant_create_task_action():
    fake_result = {
        "reply": "Tôi đã chuẩn bị công việc 'Họp nhóm đồ án' vào Thứ Ba lúc 10:00 cho bạn.",
        "action": {
            "type": "create_task",
            "task": {
                "title": "Họp nhóm đồ án",
                "day": 1,
                "time": "10:00",
                "is_starred": True,
                "priority": "high",
            },
        },
    }
    fake_quota = {
        "limit": 10,
        "used": 2,
        "remaining": 8,
        "reset_in_seconds": 540,
    }

    user = MagicMock()
    user.id = 102

    body = AIAssistantIn(message="Nhắc tôi họp nhóm đồ án lúc 10:00 thứ Ba ⭐", current_day=0)
    response = Response()

    with patch("src.routers.ai.generate_json") as mock_gen:
        async def mock_call(*args, **kwargs):
            return fake_result, "google_ai", fake_quota

        mock_gen.side_effect = mock_call

        coro = ask_ai_assistant(body, response, user=user, session=None)
        try:
            coro.send(None)
        except StopIteration as e:
            res = e.value

        assert isinstance(res, AIAssistantOut)
        assert res.action is not None
        assert res.action.type == "create_task"
        assert res.action.task.title == "Họp nhóm đồ án"
        assert res.action.task.day == 1
        assert res.action.task.time == "10:00"
        assert res.action.task.is_starred is True


def test_ai_assistant_rate_limit_429():
    user = MagicMock()
    user.id = 103

    body = AIAssistantIn(message="Xin chào")
    response = Response()

    with patch("src.routers.ai.generate_json") as mock_gen:
        async def mock_call(*args, **kwargs):
            raise AIServiceError(
                429,
                "Bạn đã đạt giới hạn 10 yêu cầu AI trong 10 phút. Vui lòng thử lại sau 120 giây.",
                code="RATE_LIMIT_EXCEEDED",
                retry_after=120,
                details={"limit": 10, "remaining": 0, "reset_in_seconds": 120},
            )

        mock_gen.side_effect = mock_call

        coro = ask_ai_assistant(body, response, user=user, session=None)
        with pytest.raises(HTTPException) as exc_info:
            try:
                coro.send(None)
            except StopIteration as e:
                pass

        err = exc_info.value
        assert err.status_code == 429
        assert err.detail["code"] == "RATE_LIMIT_EXCEEDED"
        assert err.headers["Retry-After"] == "120"
        assert err.headers["X-RateLimit-Remaining"] == "0"


def test_ai_assistant_prevents_past_date_and_handles_next_week():
    # Giả sử hôm nay là Thứ Bảy 2026-11-07 (day index 5)
    # LLM trả về Thứ Ba của tuần này (2026-11-03 - trong quá khứ)
    fake_result = {
        "reply": "Mình đã thêm việc 'Mua quần áo' vào Thứ Ba tuần sau cho bạn rồi nhé!",
        "action": {
            "type": "create_task",
            "task": {
                "title": "Mua quần áo",
                "day": 1,
                "date": "2026-11-03",
                "time": None,
                "is_starred": False,
                "priority": "medium",
            },
        },
    }
    fake_quota = {"limit": 10, "used": 1, "remaining": 9, "reset_in_seconds": 600}

    user = MagicMock()
    user.id = 104

    body = AIAssistantIn(
        message="thêm cho tôi công việc mua quần áo vào thứ 3 tuần sau",
        today_date="2026-11-07",
    )
    response = Response()

    with patch("src.routers.ai.generate_json") as mock_gen:
        async def mock_call(*args, **kwargs):
            return fake_result, "google_ai", fake_quota

        mock_gen.side_effect = mock_call

        coro = ask_ai_assistant(body, response, user=user, session=None)
        try:
            coro.send(None)
        except StopIteration as e:
            res = e.value

        assert isinstance(res, AIAssistantOut)
        assert res.action is not None
        assert res.action.task is not None
        # Backend safety guard phải tịnh tiến sang Thứ Ba tuần sau (2026-11-10)
        assert res.action.task.date == "2026-11-10"
        assert res.action.task.day == 1
        assert res.action.task.date >= "2026-11-07"


def test_ai_assistant_auto_computes_date_for_passed_day_in_week():
    # Hôm nay là Thứ Bảy 2026-11-07, người dùng nói "thứ 3 đi bơi"
    # LLM chỉ trả về day: 1, không có date
    fake_result = {
        "reply": "Mình đã lên lịch đi bơi vào Thứ Ba cho bạn!",
        "action": {
            "type": "create_task",
            "task": {
                "title": "Đi bơi",
                "day": 1,
                "time": None,
                "is_starred": False,
                "priority": "medium",
            },
        },
    }
    fake_quota = {"limit": 10, "used": 1, "remaining": 9, "reset_in_seconds": 600}

    user = MagicMock()
    user.id = 105

    body = AIAssistantIn(
        message="thứ 3 đi bơi",
        today_date="2026-11-07",
    )
    response = Response()

    with patch("src.routers.ai.generate_json") as mock_gen:
        async def mock_call(*args, **kwargs):
            return fake_result, "google_ai", fake_quota

        mock_gen.side_effect = mock_call

        coro = ask_ai_assistant(body, response, user=user, session=None)
        try:
            coro.send(None)
        except StopIteration as e:
            res = e.value

        assert isinstance(res, AIAssistantOut)
        assert res.action is not None
        assert res.action.task is not None
        # Vì Thứ Ba tuần này đã qua so với Thứ Bảy 07/11, phải tự chọn Thứ Ba tuần tới (2026-11-10)
        assert res.action.task.date == "2026-11-10"
        assert res.action.task.day == 1


