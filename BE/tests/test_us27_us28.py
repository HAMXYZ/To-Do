import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import date, time, datetime
from src import config
from src.models import Task, User
from src.reminder_schemas import SettingsPatch
from src.routers.me import get_settings, put_settings
from src.routers.reminders import get_reminders


def run_async(coro):
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value


# ==========================================
# US-27 & US-28: Reminder & Desktop Settings Tests
# ==========================================


def test_get_settings_endpoint():
    user = User(
        id=1,
        email="test@example.com",
        reminder_time=time(20, 0),
        reminder_lead_minutes=15,
    )
    res = run_async(get_settings(user=user))
    assert res["reminder_time"] == "20:00"
    assert res["reminder_lead_minutes"] == 15


def test_put_settings_endpoint():
    user = User(
        id=1,
        email="test@example.com",
        reminder_time=time(20, 0),
        reminder_lead_minutes=15,
    )
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()

    body = SettingsPatch(reminder_time="21:30", reminder_lead_minutes=30)
    res = run_async(put_settings(body=body, user=user, session=mock_session))

    assert user.reminder_time == time(21, 30)
    assert user.reminder_lead_minutes == 30
    assert res["reminder_time"] == "21:30"
    assert res["reminder_lead_minutes"] == 30
    mock_session.commit.assert_awaited_once()


def test_get_reminders_filters_past_due():
    user = User(
        id=1,
        email="test@example.com",
        reminder_time=time(20, 0),
        reminder_lead_minutes=15,
    )
    mock_session = AsyncMock()

    # Mock tasks query result: 1 task in the past, 1 task in the future today
    now_local = datetime.now(config.APP_TZ)
    today = now_local.date()

    past_task = Task(
        id=101,
        user_id=1,
        title="Past Task",
        due_date=today,
        due_time=time(0, 1),
        is_completed=False,
    )
    future_task = Task(
        id=102,
        user_id=1,
        title="Future Task",
        due_date=today,
        due_time=time(23, 59),
        is_completed=False,
    )

    mock_scalars = MagicMock()
    mock_scalars.all.side_effect = [
        [past_task, future_task],  # tasks query
        [],                        # habits query
    ]
    mock_session.scalars.return_value = mock_scalars

    res = run_async(get_reminders(user=user, session=mock_session))

    assert res["pending_tasks"] == 2
    assert len(res["upcoming"]) == 1
    assert res["upcoming"][0]["id"] == 102
    assert res["upcoming"][0]["title"] == "Future Task"
