"""
Kịch bản kiểm thử tự động cho phần công việc US-29, US-30, US-31.
Chạy lệnh từ thư mục BE:
    python -m scripts.test_us29_30_31
"""
from src.ai_schemas import BreakdownRequest, PriorityConfirmRequest
from src.routers.ai import _build_ai_or_fallback_steps


def run_tests():
    print("=== BẮT ĐẦU KIỂM THỬ US-29, US-30, US-31 ===")

    # TC-01: Kiểm tra phân rã công việc hợp lệ (US-29)
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
    print(f"[PASS] TC-01: Phân rã thành công {len(items)} bước (Provider: {provider})")

    # TC-02: Kiểm tra chặn prompt rỗng (US-29.EX1)
    try:
        BreakdownRequest(prompt="   ")
        raise AssertionError("Phải báo lỗi khi prompt rỗng")
    except ValueError:
        print("[PASS] TC-02: Đã chặn prompt rỗng đúng yêu cầu US-29.EX1")

    # TC-03: Kiểm tra chặn deadline_day < start_day
    try:
        BreakdownRequest(prompt="Làm báo cáo", start_day=4, deadline_day=1)
        raise AssertionError("Phải báo lỗi khi ngày kết thúc nhỏ hơn ngày bắt đầu")
    except ValueError:
        print("[PASS] TC-03: Đã chặn deadline_day < start_day")

    # TC-04: Kiểm tra khử trùng lặp danh sách ID khi xác nhận gắn sao (US-31)
    confirm = PriorityConfirmRequest(task_ids=[3, 1, 3, 2], is_starred=True)
    assert confirm.task_ids == [3, 1, 2], "Phải tự động loại bỏ ID trùng lặp"
    print("[PASS] TC-04: Xác nhận gắn sao ưu tiên US-31 hợp lệ")

    print("=== TẤT CẢ CA KIỂM THỬ ĐỀU PASS 100% ===")


if __name__ == "__main__":
    run_tests()
