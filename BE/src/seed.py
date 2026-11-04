"""Seed data for FocusFlow AI.
Tạo dữ liệu mẫu:
- Khoảng 1 năm công việc (tasks) phân bố theo các danh mục, ưu tiên, thời gian.
- Đúng 15 task quá hạn (overdue: due_date < today, deadline_at < now, is_completed = False, habit_id = None).
- 7 habits kéo dài 1 năm (từ 365 ngày trước đến nay) kèm log từng ngày với các ngày nghỉ/bỏ lỡ chân thực (heatmap hoàn thành ~85-92%).
- Báo cáo tuần (WeeklyReview) cho các tuần gần đây.
Tự động kích hoạt khi BE khởi động qua FastAPI lifespan hoặc chạy thủ công:
    python -m src.seed
"""

import asyncio
from datetime import date, datetime, time, timedelta, timezone
import os
import random
import sys
from typing import Optional

# Đảm bảo in tiếng Việt trên console Windows không lỗi mã hóa
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src import config
from src.db import AsyncSessionLocal, engine
from src.models import (
    Category,
    Habit,
    HabitFrequency,
    HabitLog,
    Task,
    TaskPriority,
    User,
    WeeklyReview,
    utc_now,
)
from src.security import hash_password


# 7 thói quen mẫu trong 1 năm
SAMPLE_HABITS = [
    {
        "title": "Uống 2 lít nước mỗi ngày",
        "frequency": HabitFrequency.DAILY,
        "custom_days": None,
        "preferred_time": time(7, 30),
        "miss_rate": 0.08,  # ~8% ngày bỏ lỡ
    },
    {
        "title": "Đọc sách phát triển bản thân 30 phút",
        "frequency": HabitFrequency.DAILY,
        "custom_days": None,
        "preferred_time": time(21, 30),
        "miss_rate": 0.12,  # ~12% ngày bỏ lỡ
    },
    {
        "title": "Tập thể dục / Gym rèn luyện thể lực",
        "frequency": HabitFrequency.CUSTOM,
        "custom_days": "0,2,4",  # Thứ 2, Thứ 4, Thứ 6
        "preferred_time": time(17, 30),
        "miss_rate": 0.10,  # ~10% buổi nghỉ
    },
    {
        "title": "Thiền tĩnh tâm buổi sáng 15 phút",
        "frequency": HabitFrequency.WEEKDAYS,
        "custom_days": None,  # Thứ 2 đến Thứ 6
        "preferred_time": time(6, 30),
        "miss_rate": 0.09,
    },
    {
        "title": "Học từ vựng tiếng Anh 30 phút",
        "frequency": HabitFrequency.DAILY,
        "custom_days": None,
        "preferred_time": time(20, 0),
        "miss_rate": 0.15,
    },
    {
        "title": "Dọn dẹp bàn làm việc & sao lưu dữ liệu",
        "frequency": HabitFrequency.CUSTOM,
        "custom_days": "3,6",  # Thứ 5, Chủ nhật
        "preferred_time": time(21, 0),
        "miss_rate": 0.08,
    },
    {
        "title": "Lập kế hoạch và đánh giá tuần mới",
        "frequency": HabitFrequency.CUSTOM,
        "custom_days": "6",  # Chủ nhật
        "preferred_time": time(20, 30),
        "miss_rate": 0.06,  # ~3 buổi nghỉ trên 52 tuần
    },
]

# 15 công việc quá hạn (Overdue tasks)
OVERDUE_TASKS_DEF = [
    {
        "title": "Hoàn thiện slide thuyết trình Sprint Review",
        "days_ago": 3,
        "time": time(17, 0),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 90,
        "starred": True,
        "steps": ["Tổng hợp kết quả demo", "Chụp ảnh màn hình giao diện mới", "Gửi slide trước cho Mentor"],
    },
    {
        "title": "Nộp báo cáo chi tiêu và quyết toán tháng trước",
        "days_ago": 5,
        "time": time(18, 0),
        "category": "Cá nhân",
        "priority": TaskPriority.HIGH,
        "estimated": 45,
        "starred": False,
        "steps": ["Rà soát hóa đơn trên app ngân hàng", "Điền form quyết toán", "Chuyển kế toán"],
    },
    {
        "title": "Đặt lịch hẹn bảo dưỡng định kỳ máy lạnh",
        "days_ago": 7,
        "time": time(11, 30),
        "category": "Cá nhân",
        "priority": TaskPriority.LOW,
        "estimated": 30,
        "starred": False,
        "steps": [],
    },
    {
        "title": "Review code pull request #42 từ FE team",
        "days_ago": 8,
        "time": time(16, 0),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 60,
        "starred": True,
        "steps": ["Kiểm tra component modal", "Test thử luồng hiển thị trên mobile", "Approve PR"],
    },
    {
        "title": "Gửi email phản hồi khách hàng đối tác về tiến độ API",
        "days_ago": 10,
        "time": time(15, 0),
        "category": "Công việc",
        "priority": TaskPriority.MEDIUM,
        "estimated": 30,
        "starred": False,
        "steps": ["Viết nội dung cập nhật", "Đính kèm changelog phiên bản 2.1"],
    },
    {
        "title": "Kiểm tra và gia hạn tên miền to-do app",
        "days_ago": 12,
        "time": time(20, 0),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 20,
        "starred": True,
        "steps": [],
    },
    {
        "title": "Cập nhật tài liệu API Swagger cho module AI",
        "days_ago": 14,
        "time": time(17, 30),
        "category": "Công việc",
        "priority": TaskPriority.MEDIUM,
        "estimated": 60,
        "starred": False,
        "steps": ["Bổ sung mô tả request/response", "Cập nhật mã lỗi 422 và 502"],
    },
    {
        "title": "Đăng ký khóa học AWS Cloud Solutions Architect",
        "days_ago": 18,
        "time": time(21, 0),
        "category": "Học tập",
        "priority": TaskPriority.MEDIUM,
        "estimated": 40,
        "starred": False,
        "steps": ["Áp mã giảm giá sinh viên", "Xem lộ trình bài giảng tuần 1"],
    },
    {
        "title": "Tối ưu hóa query bảng habit_logs tránh N+1",
        "days_ago": 21,
        "time": time(16, 30),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 90,
        "starred": True,
        "steps": ["Thêm composite index", "Viết migration Alembic", "Chạy EXPLAIN ANALYZE"],
    },
    {
        "title": "Mua tài liệu sách tham khảo Clean Architecture",
        "days_ago": 25,
        "time": time(19, 0),
        "category": "Học tập",
        "priority": TaskPriority.LOW,
        "estimated": 30,
        "starred": False,
        "steps": [],
    },
    {
        "title": "Backup dữ liệu database server lên AWS S3",
        "days_ago": 30,
        "time": time(23, 0),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 45,
        "starred": False,
        "steps": ["Cấu hình script pg_dump tự động", "Kiểm tra quyền IAM role S3"],
    },
    {
        "title": "Gửi trả bưu kiện trả hàng Shopee trước hạn",
        "days_ago": 35,
        "time": time(12, 0),
        "category": "Cá nhân",
        "priority": TaskPriority.LOW,
        "estimated": 30,
        "starred": False,
        "steps": [],
    },
    {
        "title": "Soạn thảo bài chia sẻ kỹ thuật nội bộ về FastAPI Async",
        "days_ago": 40,
        "time": time(20, 0),
        "category": "Học tập",
        "priority": TaskPriority.MEDIUM,
        "estimated": 120,
        "starred": False,
        "steps": ["Chuẩn bị demo code", "Làm outline 5 phần chính", "Chia sẻ slide lên channel team"],
    },
    {
        "title": "Kiểm tra log lỗi 502 trên môi trường staging",
        "days_ago": 45,
        "time": time(14, 0),
        "category": "Công việc",
        "priority": TaskPriority.HIGH,
        "estimated": 60,
        "starred": True,
        "steps": ["Tra cứu trace ID trong Sentry", "Tái hiện lỗi với payload dài"],
    },
    {
        "title": "Thanh toán hóa đơn tiền điện và mạng internet",
        "days_ago": 60,
        "time": time(18, 0),
        "category": "Cá nhân",
        "priority": TaskPriority.HIGH,
        "estimated": 15,
        "starred": False,
        "steps": [],
    },
]

# Các mẫu công việc hoàn thành trong quá khứ và tương lai (khoảng 1 năm)
TASK_TITLES = [
    ("Thiết kế sơ đồ cơ sở dữ liệu cho tính năng nhắc nhở", "Công việc", TaskPriority.HIGH, 60),
    ("Viết migration Alembic thêm cột reminder_lead_minutes", "Công việc", TaskPriority.MEDIUM, 45),
    ("Triển khai endpoint xác thực JWT và bảo vệ API", "Công việc", TaskPriority.HIGH, 90),
    ("Đọc tài liệu về async SQLAlchemy và Connection Pooling", "Học tập", TaskPriority.MEDIUM, 60),
    ("Luyện tập 3 bài LeetCode chủ đề Two Pointers", "Học tập", TaskPriority.MEDIUM, 75),
    ("Đồng bộ giao diện Dark Mode cho các modal", "Công việc", TaskPriority.LOW, 45),
    ("Họp Sprint Planning với Product Owner và nhóm dev", "Công việc", TaskPriority.HIGH, 60),
    ("Khám sức khỏe tổng quát định kỳ tại bệnh viện", "Sức khỏe", TaskPriority.HIGH, 180),
    ("Tái cấu trúc thư mục FE chuẩn bị cho Sprint 3", "Công việc", TaskPriority.MEDIUM, 90),
    ("Viết unit test cho logic tính điểm hoàn thành tuần", "Công việc", TaskPriority.MEDIUM, 60),
    ("Thay dầu và bảo dưỡng định kỳ xe máy", "Cá nhân", TaskPriority.LOW, 60),
    ("Xem bài giảng kiến trúc Microservices buổi 4", "Học tập", TaskPriority.LOW, 90),
    ("Kiểm thử tải endpoint tạo task hàng loạt (Bulk Add)", "Công việc", TaskPriority.HIGH, 60),
    ("Mua sắm nhu yếu phẩm và thực phẩm cuối tuần", "Cá nhân", TaskPriority.LOW, 60),
    ("Đánh giá hiệu suất truy vấn của Postgres trên Docker", "Công việc", TaskPriority.MEDIUM, 45),
    ("Thực hiện khảo sát trải nghiệm người dùng về FocusFlow", "Công việc", TaskPriority.LOW, 60),
    ("Học ngữ pháp tiếng Anh nâng cao Unit 6", "Học tập", TaskPriority.MEDIUM, 45),
    ("Kiểm tra chỉ số đường huyết và huyết áp", "Sức khỏe", TaskPriority.MEDIUM, 30),
    ("Cấu hình CI/CD GitHub Actions chạy pytest tự động", "Công việc", TaskPriority.HIGH, 90),
    ("Cập nhật README và hướng dẫn cài đặt Docker Compose", "Công việc", TaskPriority.LOW, 30),
    ("Thử nghiệm gợi ý habit bằng LLM provider", "Công việc", TaskPriority.MEDIUM, 90),
    ("Dọn dẹp hòm thư điện tử và phân loại email công việc", "Cá nhân", TaskPriority.LOW, 30),
    ("Lên danh sách mục tiêu tài chính quý tiếp theo", "Cá nhân", TaskPriority.MEDIUM, 45),
    ("Đi bơi thư giãn hồi phục cơ bắp", "Sức khỏe", TaskPriority.MEDIUM, 60),
]


async def seed_user_data(session: AsyncSession, user: User, today: date, force: bool = False) -> dict:
    """Tạo dữ liệu mẫu 1 năm cho một user."""
    # Kiểm tra nếu user đã có nhiều task & habit rồi thì bỏ qua trừ khi force=True
    task_count = await session.scalar(
        select(func.count(Task.id)).where(Task.user_id == user.id)
    )
    habit_count = await session.scalar(
        select(func.count(Habit.id)).where(Habit.user_id == user.id)
    )

    if not force and task_count >= 40 and habit_count >= 7:
        return {
            "skipped": True,
            "user_id": user.id,
            "email": user.email,
            "message": "User đã có đủ dữ liệu mẫu",
        }

    # 1. Tạo danh mục (Categories)
    cat_names = ["Công việc", "Học tập", "Cá nhân", "Sức khỏe"]
    cat_map: dict[str, Category] = {}
    for name in cat_names:
        norm = name.lower()
        existing = await session.scalar(
            select(Category).where(
                Category.user_id == user.id,
                Category.normalized_name == norm,
            )
        )
        if existing is None:
            existing = Category(user_id=user.id, name=name, normalized_name=norm)
            session.add(existing)
            await session.flush()
        cat_map[name] = existing

    # 2. Tạo 7 Habits trong 1 năm
    one_year_ago = today - timedelta(days=365)
    habit_created_time = datetime.combine(one_year_ago, time(6, 0), tzinfo=config.APP_TZ).astimezone(timezone.utc)

    created_habits: list[Habit] = []
    total_logs = 0

    # Lấy danh sách habit hiện có để không tạo trùng
    existing_habits = list(
        (
            await session.scalars(
                select(Habit).where(Habit.user_id == user.id, Habit.deleted_at.is_(None))
            )
        ).all()
    )
    existing_habit_titles = {h.title for h in existing_habits}

    for h_def in SAMPLE_HABITS:
        habit = next((h for h in existing_habits if h.title == h_def["title"]), None)
        if habit is None:
            habit = Habit(
                user_id=user.id,
                title=h_def["title"],
                frequency=h_def["frequency"],
                custom_days=h_def["custom_days"],
                preferred_time=h_def["preferred_time"],
                is_active=True,
                auto_create_task=True,
                created_at=habit_created_time,
            )
            session.add(habit)
            await session.flush()
        created_habits.append(habit)

        # Tính toán lịch cho habit trong 365 ngày qua
        if h_def["frequency"] == HabitFrequency.DAILY:
            sched_weekdays = {0, 1, 2, 3, 4, 5, 6}
        elif h_def["frequency"] == HabitFrequency.WEEKDAYS:
            sched_weekdays = {0, 1, 2, 3, 4}
        else:
            sched_weekdays = {int(d) for d in h_def["custom_days"].split(",")}

        # Lấy các ngày đã có log
        existing_log_dates = set(
            await session.scalars(
                select(HabitLog.date).where(HabitLog.habit_id == habit.id)
            )
        )

        # Dùng seed ngẫu nhiên cố định theo habit.id để tái lập kết quả nhất quán
        rng = random.Random(habit.id + 100)

        # Duyệt từng ngày trong 365 ngày qua đến hôm nay
        cur_date = one_year_ago
        while cur_date <= today:
            if cur_date.weekday() in sched_weekdays and cur_date not in existing_log_dates:
                # Quyết định hoàn thành hay nghỉ (vài ngày không thực hiện)
                is_done = rng.random() > h_def["miss_rate"]
                log = HabitLog(
                    habit_id=habit.id,
                    date=cur_date,
                    is_completed=is_done,
                )
                session.add(log)
                total_logs += 1
            cur_date += timedelta(days=1)

    await session.flush()

    # 3. Tạo 15 Overdue Tasks (đảm bảo deadline_at < now, is_completed = False)
    created_overdue = 0
    now_utc = utc_now()

    for item in OVERDUE_TASKS_DEF:
        due = today - timedelta(days=item["days_ago"])
        deadline = datetime.combine(due, item["time"], tzinfo=config.APP_TZ).astimezone(timezone.utc)
        cat = cat_map.get(item["category"])

        # Kiểm tra xem task trùng tiêu đề đã tồn tại chưa
        exists = await session.scalar(
            select(Task.id).where(
                Task.user_id == user.id,
                Task.title == item["title"],
                Task.due_date == due,
            )
        )
        if exists:
            continue

        task = Task(
            user_id=user.id,
            title=item["title"],
            description=f"Task mẫu quá hạn cần hoàn thành sớm. Ngày giao hẹn: {due.isoformat()}.",
            due_date=due,
            due_time=item["time"],
            deadline_at=deadline,
            estimated_minutes=item["estimated"],
            priority=item["priority"],
            category_id=cat.id if cat else None,
            is_completed=False,
            completed_at=None,
            is_starred=item["starred"],
            is_ai_generated=False,
            habit_id=None,
        )
        session.add(task)
        await session.flush()
        created_overdue += 1

        # Tạo subtask nếu có
        for step_title in item.get("steps", []):
            sub = Task(
                user_id=user.id,
                title=step_title,
                due_date=due,
                due_time=item["time"],
                deadline_at=deadline,
                is_completed=False,
                parent_task_id=task.id,
                priority=item["priority"],
            )
            session.add(sub)

    # 4. Tạo các task trải dài trong khoảng 1 năm (từ 330 ngày trước đến 20 ngày sau)
    created_general_tasks = 0
    rng_tasks = random.Random(user.id + 42)

    # Sinh khoảng 2-3 task mỗi tuần trong suốt 52 tuần qua
    for week_offset in range(50, -4, -1):  # từ 50 tuần trước đến 3 tuần tới
        week_monday = today - timedelta(weeks=week_offset, days=today.weekday())
        num_tasks = rng_tasks.randint(2, 3)

        for _ in range(num_tasks):
            t_title, t_cat_name, t_prio, t_est = rng_tasks.choice(TASK_TITLES)
            day_delta = rng_tasks.randint(0, 6)
            task_date = week_monday + timedelta(days=day_delta)

            # Không tạo trùng lặp với các ngày của 15 overdue task nếu ngày < today
            is_past = task_date < today
            t_time = time(rng_tasks.randint(8, 20), rng_tasks.choice([0, 15, 30, 45]))
            deadline = datetime.combine(task_date, t_time, tzinfo=config.APP_TZ).astimezone(timezone.utc)

            # Tất cả các task trong quá khứ khác (ngoài 15 overdue) đều đã hoàn thành
            is_completed = True if is_past else (task_date == today and rng_tasks.random() > 0.6)
            completed_at = (
                datetime.combine(task_date, t_time, tzinfo=config.APP_TZ).astimezone(timezone.utc)
                if is_completed
                else None
            )

            # Tránh trùng tiêu đề trong cùng ngày
            exists = await session.scalar(
                select(Task.id).where(
                    Task.user_id == user.id,
                    Task.title == t_title,
                    Task.due_date == task_date,
                )
            )
            if exists:
                continue

            cat = cat_map.get(t_cat_name)
            task = Task(
                user_id=user.id,
                title=t_title,
                description=f"Công việc trong tuần {task_date.isocalendar().week} năm {task_date.isocalendar().year}.",
                due_date=task_date,
                due_time=t_time,
                deadline_at=deadline,
                estimated_minutes=t_est,
                priority=t_prio,
                category_id=cat.id if cat else None,
                is_completed=is_completed,
                completed_at=completed_at,
                is_starred=rng_tasks.random() < 0.15,
                is_ai_generated=rng_tasks.random() < 0.25,
                habit_id=None,
            )
            session.add(task)
            created_general_tasks += 1

    # 5. Tạo dữ liệu báo cáo tuần mẫu (WeeklyReview) cho 6 tuần gần nhất
    for w_back in range(1, 7):
        rev_date = today - timedelta(weeks=w_back)
        iso = rev_date.isocalendar()
        exists = await session.scalar(
            select(WeeklyReview.id).where(
                WeeklyReview.user_id == user.id,
                WeeklyReview.year == iso.year,
                WeeklyReview.week_number == iso.week,
            )
        )
        if not exists:
            completion_rate = rng_tasks.randint(82, 95)
            rev = WeeklyReview(
                user_id=user.id,
                year=iso.year,
                week_number=iso.week,
                summary_text=(
                    f"Tuần {iso.week}/{iso.year}: Hoàn thành tốt các mục tiêu đề ra với tỷ lệ {completion_rate}%. "
                    "Các thói quen duy trì đều đặn, đặc biệt là đọc sách và tập thể dục. "
                    "Cần tiếp tục cải thiện việc giải quyết các task tồn đọng đúng hạn trong tuần kế tiếp."
                ),
                completion_rate=completion_rate,
                created_at=utc_now() - timedelta(weeks=w_back - 1),
            )
            session.add(rev)

    await session.commit()

    return {
        "skipped": False,
        "user_id": user.id,
        "email": user.email,
        "habits_created": len(created_habits),
        "habit_logs_added": total_logs,
        "overdue_tasks": created_overdue,
        "general_tasks": created_general_tasks,
    }


async def seed_database(force: bool = False, target_email: Optional[str] = None) -> list[dict]:
    """Hàm chính thực hiện nạp dữ liệu mẫu."""
    results = []
    today = config.today()

    async with AsyncSessionLocal() as session:
        # Nếu chỉ định email
        if target_email:
            user = await session.scalar(
                select(User).where(User.email == target_email.strip().lower())
            )
            if not user:
                # Tạo mới user này nếu chưa có
                user = User(
                    email=target_email.strip().lower(),
                    hashed_password=hash_password("Password123@"),
                    full_name="Target User",
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
            res = await seed_user_data(session, user, today, force=force)
            results.append(res)
            return results

        # Tìm tất cả user hiện có
        users = list((await session.scalars(select(User).order_by(User.id))).all())

        if not users:
            # Nếu chưa có user nào, tạo tài khoản demo mặc định
            demo_user = User(
                email="demo@focusflow.ai",
                hashed_password=hash_password("Password123@"),
                full_name="Demo User",
            )
            session.add(demo_user)
            await session.commit()
            await session.refresh(demo_user)
            users = [demo_user]

        for u in users:
            res = await seed_user_data(session, u, today, force=force)
            results.append(res)

    return results


async def main():
    force = "--force" in sys.argv
    email = None
    for arg in sys.argv[1:]:
        if arg.startswith("--email="):
            email = arg.split("=", 1)[1]
        elif not arg.startswith("--"):
            email = arg

    print(f"=== Đang nạp dữ liệu mẫu FocusFlow AI (force={force}, email={email}) ===")
    results = await seed_database(force=force, target_email=email)
    for r in results:
        print(r)
    await engine.dispose()
    print("=== Hoàn tất nạp dữ liệu mẫu! ===")


if __name__ == "__main__":
    asyncio.run(main())
