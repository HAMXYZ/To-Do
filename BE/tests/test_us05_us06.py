import pytest
from unittest.mock import AsyncMock, MagicMock
from pydantic import ValidationError
from src.models import Category, Habit, HabitLog, Task, User, WeeklyReview
from src.routers.me import delete_account, update_profile
from src.schemas import ProfileUpdateIn, UserOut


def run_async(coro):
    """Helper to run a coroutine in test environments without full event loop sockets."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value


# ==========================================
# US-05: Update Profile Tests
# ==========================================


def test_profile_update_schema_validation():
    # Valid name
    schema = ProfileUpdateIn(full_name="  Nguyễn Văn A  ")
    assert schema.full_name == "Nguyễn Văn A"

    # None is allowed
    schema_none = ProfileUpdateIn(full_name=None)
    assert schema_none.full_name is None

    # Empty string becomes None
    schema_empty = ProfileUpdateIn(full_name="   ")
    assert schema_empty.full_name is None

    # Over 100 chars should raise ValidationError
    with pytest.raises(ValidationError):
        ProfileUpdateIn(full_name="A" * 105)


def test_update_profile_endpoint():
    user = User(
        id=1,
        email="test@example.com",
        full_name="Old Name",
        reminder_time="20:00",
        reminder_lead_minutes=15,
    )

    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()

    body = ProfileUpdateIn(full_name="Trần Văn Mới")

    result = run_async(update_profile(body, user=user, session=mock_session))

    assert user.full_name == "Trần Văn Mới"
    mock_session.commit.assert_awaited_once()
    mock_session.refresh.assert_awaited_once_with(user)
    assert result.full_name == "Trần Văn Mới"
    assert result.email == "test@example.com"


# ==========================================
# US-06: Delete Account Tests
# ==========================================


def test_delete_account_endpoint():
    user = User(
        id=42,
        email="delete_me@example.com",
        full_name="User To Delete",
    )

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.delete = AsyncMock()
    mock_session.commit = AsyncMock()

    # Call delete_account
    run_async(delete_account(user=user, session=mock_session))

    # Verify habit_logs, tasks, habits, categories, weekly_reviews were deleted
    assert mock_session.execute.await_count == 5
    mock_session.delete.assert_awaited_once_with(user)
    mock_session.commit.assert_awaited_once()
