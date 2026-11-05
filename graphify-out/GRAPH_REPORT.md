# Graph Report - D:\BT\To-Do  (2026-11-06)

## Corpus Check
- 63 files · ~40,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 600 nodes · 1089 edges · 40 communities detected
- Extraction: 66% EXTRACTED · 34% INFERRED · 0% AMBIGUOUS · INFERRED: 371 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]

## God Nodes (most connected - your core abstractions)
1. `Task` - 45 edges
2. `Habit` - 43 edges
3. `HabitFrequency` - 40 edges
4. `User` - 35 edges
5. `HabitLog` - 34 edges
6. `AIServiceError` - 17 edges
7. `TaskPriority` - 14 edges
8. `WeeklyReview` - 13 edges
9. `HabitOut` - 13 edges
10. `get_week()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Ghi hoặc cập nhật log hoàn thành của habit cho một ngày (an toàn khi gọi đồng th` --uses--> `HabitLog`  [INFERRED]
  D:\BT\To-Do\BE\src\habit_logs.py → D:\BT\To-Do\BE\src\models.py
- `create_category()` --calls--> `Category`  [INFERRED]
  D:\BT\To-Do\BE\src\routers\categories.py → D:\BT\To-Do\BE\src\models.py
- `upgrade()` --calls--> `date`  [INFERRED]
  D:\BT\To-Do\BE\alembic\versions\0001_initial.py → D:\BT\To-Do\FE\src\components\AIBreakdownModal.tsx
- `main()` --calls--> `request()`  [INFERRED]
  D:\BT\To-Do\BE\scripts\check_ai.py → D:\BT\To-Do\FE\src\api.ts
- `Seed data for FocusFlow AI. Tạo dữ liệu mẫu: - Khoảng 1 năm công việc (tasks) ph` --uses--> `TaskPriority`  [INFERRED]
  D:\BT\To-Do\BE\src\seed.py → D:\BT\To-Do\BE\src\models.py

## Communities

### Community 0 - "Community 0"
_It handles scheduling tasks, tracking their status, and rendering them in a calendar interface with dark mode support._
Cohesion: 0.02
Nodes (102): addDays(), backlog, [calendarOpen, setCalendarOpen], cancelled, checked, checks, choose(), complete (+94 more)

### Community 1 - "Community 1"

Cohesion: 0.05
Nodes (44): recognize(), API_URL, ApiError, createCategory(), createHabit(), createTask(), freqToBe(), freqToFe() (+36 more)

### Community 2 - "Community 2"

Cohesion: 0.13
Nodes (56): Heatmap cả năm cho từng habit, tính từ ngày tạo habit (Câu 74).     Habit đã xóa, DeclarativeBase, generate_habit_tasks(), normalize_habit_fields(), _parse_custom_days(), Tiện ích dùng chung cho habit: tính lịch, sinh task, dọn task khi đổi lịch., Lấy task habit từ ngày mai trở đi, chưa Done và chưa bị người dùng sửa., Câu 21: Khi đổi lịch habit, xóa task tương lai không còn khớp.     Chỉ đụng task (+48 more)

### Community 3 - "Community 3"

Cohesion: 0.08
Nodes (43): HeatmapHabit, HeatmapOut, BaseModel, CategoryCreate, CategoryOut, _clean(), HabitCreate, HabitGenerateIn (+35 more)

### Community 4 - "Community 4"

Cohesion: 0.06
Nodes (27): [categoryName, setCategoryName], [clientRequestId, setClientRequestId], [deadlineAt, setDeadlineAt], [description, setDescription], [draftHour, draftMinute], [draftPriority, setDraftPriority], [draftTime, setDraftTime], [estimatedMinutes, setEstimatedMinutes] (+19 more)

### Community 5 - "Community 5"

Cohesion: 0.14
Nodes (31): count, today, main(), Ghi hoặc cập nhật log hoàn thành của habit cho một ngày (an toàn khi gọi đồng th, upsert_log(), update_habit_log(), utc_now(), _active() (+23 more)

### Community 6 - "Community 6"

Cohesion: 0.1
Nodes (22): AIQuotaOut, get_ai_quota_status(), HabitRecognitionIn, HabitRecognitionOut, HabitSuggestion, Kiểm tra hạn mức gọi AI của người dùng (US-38)., recognize_habits(), AIServiceError (+14 more)

### Community 7 - "Community 7"

Cohesion: 0.13
Nodes (20): date, habit_heatmap(), _local_date(), Ngày hôm nay theo APP_TIMEZONE. Mọi phép tính 'hôm nay' phải dùng hàm này., today(), cleanup_on_deactivate(), cleanup_on_delete(), cleanup_on_schedule_change() (+12 more)

### Community 8 - "Community 8"

Cohesion: 0.16
Nodes (18): getToday(), addDays(), BASE_MONDAY, dateToWeekDay(), dayToDate(), diffDays(), formatYmd(), isoWeek() (+10 more)

### Community 9 - "Community 9"

Cohesion: 0.12
Nodes (12): [copied, setCopied], [draft, setDraft], [error, setError], [loading, setLoading], [notice, setNotice], [quota, setQuota], [retryCountdown, setRetryCountdown], [saving, setSaving] (+4 more)

### Community 10 - "Community 10"

Cohesion: 0.12
Nodes (14): active, [copied, setCopied], [error, setError], [generating, setGenerating], iso, [isTimeout, setIsTimeout], [loading, setLoading], [notice, setNotice] (+6 more)

### Community 11 - "Community 11"

Cohesion: 0.19
Nodes (10): _client_ip(), login(), _recent_fails(), register(), get_current_user(), create_access_token(), decode_access_token(), hash_password() (+2 more)

### Community 12 - "Community 12"

Cohesion: 0.28
Nodes (7): downgrade(), initial schema  Revision ID: 0001_initial Revises: Create Date: 2026-10-13, upgrade(), downgrade(), add task creation fields, categories, and request idempotency  Revision ID: 0003, upgrade(), Enum

### Community 13 - "Community 13"

Cohesion: 0.22
Nodes (8): [busy, setBusy], [confirmPassword, setConfirmPassword], [email, setEmail], [error, setError], [fullName, setFullName], inputClass, PASSWORD_MIN, [password, setPassword]

### Community 14 - "Community 14"

Cohesion: 0.54
Nodes (6): generate_weekly_review(), get_weekly_review(), _review_out(), save_weekly_review(), _week_dates(), _weekly_review_data()

### Community 15 - "Community 15"

Cohesion: 0.25
Nodes (7): login(), [busy, setBusy], [email, setEmail], [error, setError], handleLogin(), inputClass, [password, setPassword]

### Community 16 - "Community 16"

Cohesion: 0.29
Nodes (2): __dirname, emitSourcemaps

### Community 17 - "Community 17"

Cohesion: 0.29
Nodes (4): actionReveal, completeReveal, [offset, setOffset], [touchStart, setTouchStart]

### Community 18 - "Community 18"

Cohesion: 0.33
Nodes (4): get_today(), lifespan(), Tự động nạp dữ liệu mẫu khi khởi động BE (nếu cần)., Ngày hôm nay theo APP_TIMEZONE, để FE không phải đoán múi giờ.

### Community 19 - "Community 19"

Cohesion: 0.53
Nodes (5): getNotificationPermission(), isNotificationSupported(), playNotificationChime(), requestNotificationPermission(), showAppNotification()

### Community 20 - "Community 20"

Cohesion: 0.5
Nodes (1): add habits.created_at  Revision ID: 0002_habit_created_at Revises: 0001_initial

### Community 21 - "Community 21"

Cohesion: 0.5
Nodes (1): allow one saved weekly review per account and ISO week  Revision ID: 0004_weekly

### Community 22 - "Community 22"

Cohesion: 0.5
Nodes (2): STORAGE_KEY_NOTIFIED, STORAGE_KEY_SUMMARY_DATE

### Community 23 - "Community 23"

Cohesion: 0.67
Nodes (3): getIsoWeekInfo(), getWeekLabelForOffset(), WEEK_ANCHOR_MONDAY

### Community 24 - "Community 24"
_Unable to determine domain due to missing code entities._
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"

Cohesion: 0.67
Nodes (1): create_category()

### Community 26 - "Community 26"
_Unable to determine domain due to missing code entities._
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"

Cohesion: 0.67
Nodes (1): priorityOrder

### Community 28 - "Community 28"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"

Cohesion: 1.0
Nodes (1): openTasks

### Community 31 - "Community 31"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
_Unable to determine domain due to missing code entities._
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **189 isolated node(s):** `initial schema  Revision ID: 0001_initial Revises: Create Date: 2026-10-13`, `add habits.created_at  Revision ID: 0002_habit_created_at Revises: 0001_initial`, `add task creation fields, categories, and request idempotency  Revision ID: 0003`, `allow one saved weekly review per account and ISO week  Revision ID: 0004_weekly`, `Kiểm tra API Key và liệt kê các model Gemini khả dụng. Chạy từ thư mục BE:     p` (+184 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 28`** (2 nodes): `db.py`, `get_session()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `Root.tsx`, `Root()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `openTasks`, `AIPriorityModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `TrashBinModal.tsx`, `closeOnEscape()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `limits.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `Icon.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.