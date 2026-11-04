import asyncio
from collections import defaultdict
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.db import AsyncSessionLocal, engine
from src.models import Habit, HabitLog, Task, User, WeeklyReview, utc_now
from src.routers.tasks import _overdue_query
from sqlalchemy import func, select


async def main():
    async with AsyncSessionLocal() as session:
        user = await session.scalar(select(User).order_by(User.id))
        if not user:
            print("Chưa có user nào.")
            return

        print(f"=== Thống kê dữ liệu mẫu của User: {user.email} (ID: {user.id}) ===")

        # 1. Habits
        habits = list((await session.scalars(select(Habit).where(Habit.user_id == user.id))).all())
        print(f"\n1. Thói quen (Habits) - Tổng số: {len(habits)}:")
        for h in habits:
            total_logs = await session.scalar(select(func.count(HabitLog.id)).where(HabitLog.habit_id == h.id))
            done_logs = await session.scalar(select(func.count(HabitLog.id)).where(HabitLog.habit_id == h.id, HabitLog.is_completed == True))
            missed_logs = await session.scalar(select(func.count(HabitLog.id)).where(HabitLog.habit_id == h.id, HabitLog.is_completed == False))
            rate = round(done_logs / total_logs * 100, 1) if total_logs else 0
            print(f"   - {h.title} [{h.frequency.value}]: {total_logs} ngày log (Hoàn thành: {done_logs}, Bỏ lỡ: {missed_logs}, Tỷ lệ: {rate}%)")

        # 2. Overdue tasks
        overdue = list((await session.scalars(_overdue_query(user))).all())
        print(f"\n2. Công việc quá hạn (Overdue Tasks) - Tổng số: {len(overdue)}:")
        for o in overdue:
            print(f"   - [ID {o.id}] {o.title} | Hạn: {o.due_date} {o.due_time or ''} | Priority: {o.priority.value}")

        # 3. Task distribution over 1 year
        tasks = list((await session.scalars(select(Task).where(Task.user_id == user.id, Task.parent_task_id.is_(None)))).all())
        print(f"\n3. Phân bổ công việc trong 1 năm - Tổng số parent tasks: {len(tasks)}:")
        by_month = defaultdict(lambda: {"total": 0, "done": 0, "overdue": 0, "pending": 0})
        now = utc_now()
        for t in tasks:
            ym = t.due_date.strftime("%Y-%m")
            by_month[ym]["total"] += 1
            if t.is_completed:
                by_month[ym]["done"] += 1
            elif t.deadline_at and t.deadline_at < now:
                by_month[ym]["overdue"] += 1
            else:
                by_month[ym]["pending"] += 1

        for ym in sorted(by_month.keys()):
            st = by_month[ym]
            print(f"   - Tháng {ym}: {st['total']} tasks (Hoàn thành: {st['done']}, Quá hạn: {st['overdue']}, Đang chờ: {st['pending']})")

        # 4. Weekly reviews
        reviews = list((await session.scalars(select(WeeklyReview).where(WeeklyReview.user_id == user.id).order_by(WeeklyReview.year.desc(), WeeklyReview.week_number.desc()))).all())
        print(f"\n4. Báo cáo tuần (Weekly Reviews) - Tổng số: {len(reviews)}:")
        for r in reviews:
            print(f"   - Tuần {r.week_number}/{r.year}: Tỷ lệ {r.completion_rate}% | {r.summary_text[:80]}...")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

