import pytest
from src.ai_schemas import BreakdownRequest, PriorityConfirmRequest
from src.routers.ai import _build_ai_or_fallback_steps


def test_us29_breakdown_valid():
    req = BreakdownRequest(
        prompt="Chuẩn bị bài thuyết trình doanh thu Quý 3, Hạn: Thứ Sáu 16:00",
        start_day=0,
        deadline_day=4,
        due_time="16:00",
    )
    topic, items, is_proto, provider = _build_ai_or_fallback_steps(
        prompt=req.prompt,
        start_day=req.start_day,
        deadline_day=req.deadline_day,
        due_time=req.due_time,
    )
    assert len(items) >= 3, "Phải sinh ra ít nhất 3 bước công việc"
    assert items[-1].day == 4, "Bước cuối phải khớp ngày hạn chót (Thứ Sáu = 4)"
    assert items[-1].time == "16:00", "Bước cuối phải khớp giờ hạn chót (16:00)"


def test_us29_empty_prompt_blocked():
    with pytest.raises(ValueError):
        BreakdownRequest(prompt="   ")


def test_us29_invalid_deadline_order():
    with pytest.raises(ValueError):
        BreakdownRequest(prompt="Làm báo cáo", start_day=4, deadline_day=1)


def test_us31_priority_confirm_dedup():
    confirm = PriorityConfirmRequest(task_ids=[3, 1, 3, 2], is_starred=True)
    assert confirm.task_ids == [3, 1, 2], "Phải tự động loại bỏ ID trùng lặp"
