from datetime import date
from typing import Optional

from pydantic import BaseModel

from src.models import HabitFrequency


class HeatmapHabit(BaseModel):
    id: int
    title: str
    frequency: HabitFrequency
    days: list[int]
    time: str
    is_active: bool
    is_deleted: bool
    created_date: date
    scheduled_count: int  # số ngày có lịch đã tính vào phần trăm
    done_count: int
    percent: int
    # Một phần tử cho mỗi ngày từ 1/1 đến 31/12:
    # 0 = không có gì (ngoài thời gian theo dõi, ngày không có lịch, ngày chưa tới, hôm nay chưa xong)
    # 1 = có lịch nhưng đã bỏ lỡ, 2 = đã hoàn thành
    cells: list[int]


class HeatmapOut(BaseModel):
    year: int
    start_date: date
    end_date: date
    today: date
    available_years: list[int]
    days_tracked: int
    habit_count: int
    consistency: int
    habits: list[HeatmapHabit]
