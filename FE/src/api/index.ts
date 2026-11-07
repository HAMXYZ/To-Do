import type {
  BreakdownItem,
  Category,
  DeletedTask,
  Habit,
  OverdueTask,
  PrioritySuggestionBundle,
  SearchResult,
  Task,
  TaskPriority,
} from "../types"
import {
  dateToWeekDay,
  dayToDate,
  weekToIso,
  ymdToLocalDate,
  type Ymd,
} from "../utils/dates"

// ---------------------------------------------------------------------------
// Cấu hình, token, lỗi
// ---------------------------------------------------------------------------

const API_URL: string = (
  import.meta.env?.VITE_API_URL as string | undefined ?? "http://localhost:8000"
).replace(/\/$/, "")

export class ApiError extends Error {
  status: number
  code?: string
  retryAfter?: number
  constructor(
    status: number,
    message: string,
    code?: string,
    retryAfter?: number,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

/** Nơi lưu token. Mặc định là localStorage; bản Electron có thể thay bằng kho an toàn của hệ điều hành. */
export interface TokenStore {
  get(): string | null | Promise<string | null>
  set(token: string): void | Promise<void>
  clear(): void | Promise<void>
}

const TOKEN_KEY = "access_token"

const localStorageStore: TokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* bỏ qua: token vẫn nằm trong bộ nhớ của phiên hiện tại */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* bỏ qua */
    }
  },
}

let store: TokenStore = localStorageStore
let token: string | null = null
let onUnauthorized: (() => void) | null = null

export function setTokenStore(s: TokenStore): void {
  store = s
}

/** Gọi một lần khi khởi động app, trước khi render. Trả về true nếu đã có token. */
export async function initAuth(): Promise<boolean> {
  token = (await store.get()) ?? null
  return token !== null
}

export function isLoggedIn(): boolean {
  return token !== null
}

/** Được gọi khi BE trả 401 (token hết hạn hoặc sai). App nên đưa người dùng về trang Login. */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

export async function logout(): Promise<void> {
  token = null
  await store.clear()
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail
    if (typeof d === "string") return d
    if (typeof d === "object" && d !== null) {
      if (
        "message" in d &&
        typeof (d as { message: unknown }).message === "string"
      ) {
        return (d as { message: string }).message
      }
    }
    if (Array.isArray(d)) {
      const msg = d
        .map((e) => {
          const m = (e as { msg?: unknown }).msg
          return typeof m === "string" ? m.replace(/^Value error, /, "") : ""
        })
        .filter(Boolean)
        .join("; ")
      return msg || "Dữ liệu không hợp lệ"
    }
  }
  return `Lỗi ${status}`
}

interface RequestOptions {
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** false: không gắn token và không coi 401 là hết phiên (dùng cho đăng ký, đăng nhập). */
  auth?: boolean
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const useAuth = opts.auth !== false
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) qs.set(k, String(v))
  }
  const url = `${API_URL}${path}${qs.size ? `?${qs.toString()}` : ""}`

  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  if (useAuth && token) headers["Authorization"] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ")
  }

  if (res.status === 204) return undefined as T
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* thân phản hồi rỗng hoặc không phải JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && useAuth) {
      await logout()
      onUnauthorized?.()
    }
    let code: string | undefined
    let retryAfter: number | undefined
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail
      if (typeof d === "object" && d !== null) {
        if ("code" in d && typeof (d as { code: unknown }).code === "string") {
          code = (d as { code: string }).code
        }
        if (
          "retry_after" in d &&
          typeof (d as { retry_after: unknown }).retry_after === "number"
        ) {
          retryAfter = (d as { retry_after: number }).retry_after
        }
      }
    }
    const headerRetry = res.headers.get("Retry-After")
    if (headerRetry && retryAfter === undefined) {
      const parsed = parseInt(headerRetry, 10)
      if (!Number.isNaN(parsed)) retryAfter = parsed
    }
    throw new ApiError(
      res.status,
      messageFrom(data, res.status),
      code,
      retryAfter,
    )
  }
  return data as T
}

// ---------------------------------------------------------------------------
// Kiểu dữ liệu của BE (snake_case) và các hàm chuyển đổi sang kiểu của FE
// ---------------------------------------------------------------------------

interface BeTask {
  id: number
  title: string
  description?: string | null
  due_date: Ymd
  day: number
  iso_year: number
  iso_week: number
  time: string
  deadline_at?: string | null
  estimated_minutes?: number | null
  priority?: TaskPriority
  category_id?: number | null
  category_name?: string | null
  is_completed: boolean
  completed_at: string | null
  is_starred: boolean
  is_ai_generated: boolean
  habit_id: number | null
  steps: string[]
}
interface BeTrashItem extends BeTask {
  deleted_at: string
}
interface BeTaskList {
  count: number
  tasks: BeTask[]
}
type BeFrequency = "daily" | "weekdays" | "custom"
interface BeHabit {
  id: number
  title: string
  frequency: BeFrequency
  days: number[]
  time: string
  auto_task: boolean
  is_active: boolean
}

const freqToFe = (f: BeFrequency): Habit["frequency"] =>
  f === "daily" ? "everyday" : f
const freqToBe = (f: Habit["frequency"]): BeFrequency =>
  f === "everyday" ? "daily" : f

function toTask(t: BeTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? undefined,
    time: t.time,
    deadlineAt: t.deadline_at ? Date.parse(t.deadline_at) : undefined,
    estimatedMinutes: t.estimated_minutes ?? undefined,
    priority: t.priority ?? "medium",
    categoryId: t.category_id ?? undefined,
    categoryName: t.category_name ?? undefined,
    done: t.is_completed,
    ai: t.is_ai_generated,
    steps: t.steps.length > 0 ? t.steps : undefined,
    autoHabitId: t.habit_id ?? undefined,
    starred: t.is_starred,
    completedAt: t.completed_at ? Date.parse(t.completed_at) : undefined,
  }
}

function toPlaced(t: BeTask): SearchResult {
  const { week, day } = dateToWeekDay(t.due_date)
  return { task: toTask(t), week, day }
}

function toHabit(h: BeHabit): Habit {
  return {
    id: h.id,
    title: h.title,
    frequency: freqToFe(h.frequency),
    days: h.days,
    time: h.time,
    autoTask: h.auto_task,
    active: h.is_active,
  }
}

// ---------------------------------------------------------------------------
// Xác thực
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string
  password: string
  fullName?: string
}
export interface UserInfo {
  id: number
  email: string
  fullName: string | null
  createdAt: string
}
interface BeUser {
  id: number
  email: string
  full_name: string | null
  created_at: string
}
const toUser = (u: BeUser): UserInfo => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  createdAt: u.created_at,
})

/** Đăng ký không trả token: sau khi thành công, đưa người dùng về trang Login. */
export async function register(input: RegisterInput): Promise<UserInfo> {
  const u = await request<BeUser>("POST", "/auth/register", {
    auth: false,
    body: {
      email: input.email,
      password: input.password,
      full_name: input.fullName || null,
    },
  })
  return toUser(u)
}

export async function login(email: string, password: string): Promise<void> {
  const r = await request<{ access_token: string }>("POST", "/auth/login", {
    auth: false,
    body: { email, password },
  })
  token = r.access_token
  await store.set(token)
}

export async function getMe(): Promise<UserInfo> {
  return toUser(await request<BeUser>("GET", "/auth/me"))
}

/** Cập nhật tên hiển thị hồ sơ cá nhân */
export async function updateProfile(
  fullName: string | null,
): Promise<UserInfo> {
  const u = await request<BeUser>("PATCH", "/me/profile", {
    body: { full_name: fullName },
  })
  return toUser(u)
}

/** Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu */
export async function deleteAccount(): Promise<void> {
  await request<void>("DELETE", "/me")
  await logout()
}

export interface TodayInfo {
  date: Ymd
  /** độ lệch tuần so với BASE_MONDAY */
  week: number
  /** 0 = thứ Hai */
  day: number
  isoYear: number
  isoWeek: number
}

/** Ngày hôm nay theo múi giờ của BE (không dựa vào đồng hồ máy). */
export async function getToday(): Promise<TodayInfo> {
  const r = await request<{ date: Ymd; iso_year: number; iso_week: number }>(
    "GET",
    "/today",
  )
  return {
    date: r.date,
    ...dateToWeekDay(r.date),
    isoYear: r.iso_year,
    isoWeek: r.iso_week,
  }
}

// ---------------------------------------------------------------------------
// Dữ liệu một tuần
// ---------------------------------------------------------------------------

export interface DayStat {
  done: number
  total: number
  percent: number
}
export interface HabitWeek
  extends Habit {
  /** 7 phần tử: ngày đó có lịch hay không */
  /** 7 phần tử: log hoàn thành từng ngày */
  scheduled: boolean[]
  logs: boolean[]
  doneCount: number
  scheduledCount: number
  progress: number
}
export interface WeekData {
  week: number
  isoYear: number
  isoWeek: number
  startDate: Ymd
  endDate: Ymd
  today: Ymd
  /** 7 mảng task, theo thứ tự thứ Hai đến Chủ nhật */
  tasksByDay: Task[][]
  days: DayStat[]
  stats: DayStat
  habits: HabitWeek[]
}
interface BeWeek {
  iso_year: number
  iso_week: number
  start_date: Ymd
  end_date: Ymd
  today: Ymd
  tasks: BeTask[]
  days: { day: number; date: Ymd; total: number; done: number; percent: number }[]
  stats: { total: number; done: number; percent: number }
  habits: (BeHabit & {
    scheduled: boolean[]
    logs: boolean[]
    done_count: number
    scheduled_count: number
    progress: number
  })[]
}

/**
 * Lấy dữ liệu một tuần. Mặc định sinh trước các task habit còn thiếu (POST /habits/generate),
 * rồi mới đọc, để tuần không thiếu task.
 */
export async function getWeek(
  week: number,
  opts: { generate?: boolean } = {},
): Promise<WeekData> {
  const iso = weekToIso(week)
  if (opts.generate !== false) {
    await request("POST", "/habits/generate", {
      body: { iso_year: iso.year, iso_week: iso.week },
    })
  }
  const w = await request<BeWeek>("GET", `/weeks/${iso.year}/${iso.week}`)
  const tasksByDay: Task[][] = [[], [], [], [], [], [], []]
  for (const t of w.tasks) tasksByDay[t.day].push(toTask(t))
  return {
    week,
    isoYear: w.iso_year,
    isoWeek: w.iso_week,
    startDate: w.start_date,
    endDate: w.end_date,
    today: w.today,
    tasksByDay,
    days: w.days.map((d) => ({
      done: d.done,
      total: d.total,
      percent: d.percent,
    })),
    stats: {
      done: w.stats.done,
      total: w.stats.total,
      percent: w.stats.percent,
    },
    habits: w.habits.map((h) => ({
      ...toHabit(h),
      scheduled: h.scheduled,
      logs: h.logs,
      doneCount: h.done_count,
      scheduledCount: h.scheduled_count,
      progress: h.progress,
    })),
  }
}

export interface WeeklyReviewStats {
  taskTotal: number
  taskDone: number
  taskCompletionRate: number
  habitTotal: number
  habitScheduledDays: number
  habitCompletedDays: number
  habitCompletionRate: number
  habits: {
    title: string
    scheduledDays: number[]
    completedDays: number[]
    doneCount: number
    scheduledCount: number
  }[]
}

export interface SavedWeeklyReview {
  id: number
  year: number
  weekNumber: number
  summaryText: string
  completionRate: number
  createdAt: number
}

interface BeWeeklyReview {
  id: number
  year: number
  week_number: number
  summary_text: string
  completion_rate: number
  created_at: string
}

interface BeWeeklyReviewStats {
  task_total: number
  task_done: number
  task_completion_rate: number
  habit_total: number
  habit_scheduled_days: number
  habit_completed_days: number
  habit_completion_rate: number
  habits: {
    title: string
    scheduled_days: number[]
    completed_days: number[]
    done_count: number
    scheduled_count: number
  }[]
}

function reviewStatsToFe(stats: BeWeeklyReviewStats): WeeklyReviewStats {
  return {
    taskTotal: stats.task_total,
    taskDone: stats.task_done,
    taskCompletionRate: stats.task_completion_rate,
    habitTotal: stats.habit_total,
    habitScheduledDays: stats.habit_scheduled_days,
    habitCompletedDays: stats.habit_completed_days,
    habitCompletionRate: stats.habit_completion_rate,
    habits: stats.habits.map((habit) => ({
      title: habit.title,
      scheduledDays: habit.scheduled_days,
      completedDays: habit.completed_days,
      doneCount: habit.done_count,
      scheduledCount: habit.scheduled_count,
    })),
  }
}

function weeklyReviewToFe(review: BeWeeklyReview): SavedWeeklyReview {
  return {
    id: review.id,
    year: review.year,
    weekNumber: review.week_number,
    summaryText: review.summary_text,
    completionRate: review.completion_rate,
    createdAt: Date.parse(review.created_at),
  }
}

export async function getWeeklyReview(
  week: number,
): Promise<{ review: SavedWeeklyReview | null; stats: WeeklyReviewStats }> {
  const iso = weekToIso(week)
  const response = await request<{
    review: BeWeeklyReview | null
    stats: BeWeeklyReviewStats
  }>("GET", `/weeks/${iso.year}/${iso.week}/review`)
  return {
    review: response.review ? weeklyReviewToFe(response.review) : null,
    stats: reviewStatsToFe(response.stats),
  }
}

export async function generateWeeklyReview(
  week: number,
): Promise<{
  summaryText: string
  completionRate: number
  provider: string
  stats: WeeklyReviewStats
}> {
  const iso = weekToIso(week)
  const response = await request<{
    summary_text: string
    completion_rate: number
    provider: string
    stats: BeWeeklyReviewStats
  }>("POST", `/weeks/${iso.year}/${iso.week}/review/generate`)
  return {
    summaryText: response.summary_text,
    completionRate: response.completion_rate,
    provider: response.provider,
    stats: reviewStatsToFe(response.stats),
  }
}

export async function saveWeeklyReview(
  week: number,
  summaryText: string,
): Promise<SavedWeeklyReview> {
  const iso = weekToIso(week)
  const response = await request<BeWeeklyReview>(
    "PUT",
    `/weeks/${iso.year}/${iso.week}/review`,
    { body: { summary_text: summaryText } },
  )
  return weeklyReviewToFe(response)
}

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  week: number
  day: number
  title: string
  /** "HH:mm" hoặc "" nếu không có giờ */
  time?: string
  starred?: boolean
  description?: string
  /** Local datetime string from datetime-local; the backend interprets it in APP_TIMEZONE. */
  deadlineAt?: string
  estimatedMinutes?: number
  priority?: TaskPriority
  categoryId?: number
  clientRequestId?: string
  steps?: string[]
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const t = await request<BeTask>("POST", "/tasks", {
    body: {
      title: input.title,
      due_date: dayToDate(input.week, input.day),
      time: input.time ?? "",
      is_starred: input.starred ?? false,
      description: input.description ?? null,
      deadline_at: input.deadlineAt || null,
      estimated_minutes: input.estimatedMinutes ?? null,
      priority: input.priority ?? "medium",
      category_id: input.categoryId ?? null,
      client_request_id: input.clientRequestId ?? null,
      steps: input.steps ?? [],
    },
  })
  return toTask(t)
}

export interface UpdateTaskInput {
  title?: string
  /** dời sang ngày khác (task của thói quen không dời được, BE trả lỗi 400) */
  move?: { week: number; day: number }
  /** "" để xóa giờ */
  time?: string
  starred?: boolean
  done?: boolean
  description?: string | null
  deadlineAt?: string | null
  estimatedMinutes?: number | null
  priority?: TaskPriority
  categoryId?: number | null
  steps?: string[]
}

export async function updateTask(
  id: number,
  patch: UpdateTaskInput,
): Promise<SearchResult> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.move !== undefined)
    body.due_date = dayToDate(patch.move.week, patch.move.day)
  if (patch.time !== undefined) body.time = patch.time
  if (patch.starred !== undefined) body.is_starred = patch.starred
  if (patch.done !== undefined) body.is_completed = patch.done
  if (patch.description !== undefined) body.description = patch.description
  if (patch.deadlineAt !== undefined) body.deadline_at = patch.deadlineAt
  if (patch.estimatedMinutes !== undefined)
    body.estimated_minutes = patch.estimatedMinutes
  if (patch.priority !== undefined) body.priority = patch.priority
  if (patch.categoryId !== undefined) body.category_id = patch.categoryId
  if (patch.steps !== undefined) body.steps = patch.steps
  return toPlaced(await request<BeTask>("PATCH", `/tasks/${id}`, { body }))
}

interface BeCategory {
  id: number
  name: string
}

export async function listCategories(): Promise<Category[]> {
  return request<BeCategory[]>("GET", "/categories")
}

export async function createCategory(name: string): Promise<Category> {
  return request<BeCategory>("POST", "/categories", { body: { name } })
}

/** Chuyển task vào thùng rác (subtask đi theo). */
export async function trashTask(id: number): Promise<void> {
  await request<void>("DELETE", `/tasks/${id}`)
}

export async function getTrash(): Promise<DeletedTask[]> {
  const items = await request<BeTrashItem[]>("GET", "/tasks/trash")
  return items.map((t) => {
    const p = toPlaced(t)
    return {
      task: p.task,
      week: p.week,
      day: p.day,
      deletedAt: Date.parse(t.deleted_at),
    }
  })
}

export async function restoreTask(id: number): Promise<SearchResult> {
  return toPlaced(await request<BeTask>("POST", `/tasks/${id}/restore`))
}

export async function purgeTask(id: number): Promise<void> {
  await request<void>("DELETE", `/tasks/${id}/purge`)
}

/** "Dọn thùng rác". Trả về số task đã xóa. */
export async function emptyTrash(): Promise<number> {
  return (await request<{ count: number }>("DELETE", "/tasks/trash")).count
}

export async function searchTasks(q: string): Promise<SearchResult[]> {
  const query = q.trim()
  if (!query) return []
  const list = await request<BeTask[]>("GET", "/tasks/search", {
    query: { q: query },
  })
  return list.map(toPlaced)
}

export async function getOverdue(): Promise<OverdueTask[]> {
  const r = await request<BeTaskList>("GET", "/tasks/overdue")
  return r.tasks.map((t) => {
    const p = toPlaced(t)
    return {
      task: p.task,
      week: p.week,
      day: p.day,
      due: t.deadline_at ? new Date(t.deadline_at) : ymdToLocalDate(t.due_date),
    }
  })
}

/** "Auto Carry-Over": dời mọi task quá hạn sang hôm nay. */
export async function carryOver(): Promise<{
  count: number
  tasks: SearchResult[]
}> {
  const r = await request<BeTaskList>("POST", "/tasks/carry-over")
  return { count: r.count, tasks: r.tasks.map(toPlaced) }
}

/** Lưu danh sách bước đề xuất đã được người dùng chỉnh sửa và xác nhận (week = tuần đang xem). */
export async function saveBreakdown(
  week: number,
  items: BreakdownItem[],
): Promise<SearchResult[]> {
  const iso = weekToIso(week)
  const r = await request<BeTaskList>("POST", "/tasks/bulk", {
    body: {
      iso_year: iso.year,
      iso_week: iso.week,
      items: items.map((i) => ({
        title: i.title.trim(),
        day: i.day,
        time: i.time ? i.time.trim() : null,
        is_starred: Boolean(i.starred),
        steps: i.steps ?? [],
      })),
    },
  })
  return r.tasks.map(toPlaced)
}

// ---------------------------------------------------------------------------
// AI Breakdown & Priority Suggestions
// ---------------------------------------------------------------------------

export interface BreakdownPreviewInput {
  prompt: string
  week: number
  startDay: number
  deadlineDay?: number
  dueTime?: string
}

export interface BreakdownPreviewResult {
  isPrototype: boolean
  provider: string | null
  notice: string
  topic: string
  items: BreakdownItem[]
}

interface BeBreakdownStep {
  id: number
  title: string
  day: number
  time: string
  is_starred: boolean
  priority_reason: string | null
}

interface BeBreakdownResponse {
  is_prototype: boolean
  provider: string | null
  notice: string
  topic: string
  items: BeBreakdownStep[]
}

/** Gọi BE sinh kế hoạch phân rã mẫu (Prototype). */
export async function previewBreakdown(
  input: BreakdownPreviewInput,
): Promise<BreakdownPreviewResult> {
  const iso = weekToIso(input.week)
  const r = await request<BeBreakdownResponse>("POST", "/ai/breakdown", {
    body: {
      prompt: input.prompt,
      iso_year: iso.year,
      iso_week: iso.week,
      start_day: input.startDay,
      deadline_day: input.deadlineDay,
      due_time: input.dueTime ?? "16:00",
    },
  })
  return {
    isPrototype: r.is_prototype,
    provider: r.provider,
    notice: r.notice,
    topic: r.topic,
    items: r.items.map((item) => ({
      id: item.id,
      title: item.title,
      day: item.day,
      time: item.time,
      starred: item.is_starred,
      priorityReason: item.priority_reason ?? undefined,
    })),
  }
}

interface BePrioritySuggestionItem {
  task_id: number
  title: string
  due_date: Ymd
  day: number
  time: string
  currently_starred: boolean
  recommended_star: boolean
  score: number
  reason: string
}

interface BePrioritySuggestionResponse {
  is_prototype: boolean
  provider: string | null
  notice: string
  suggestions: BePrioritySuggestionItem[]
}

/** Lấy gợi ý ưu tiên (⭐) từ BE cho tuần đang xem. */
export async function getPrioritySuggestions(
  week: number,
  day?: number,
): Promise<PrioritySuggestionBundle> {
  const iso = weekToIso(week)
  const r = await request<BePrioritySuggestionResponse>(
    "POST",
    "/ai/priority-suggestions",
    {
      body: {
        iso_year: iso.year,
        iso_week: iso.week,
        day,
      },
    },
  )
  return {
    isPrototype: r.is_prototype,
    provider: r.provider,
    notice: r.notice,
    suggestions: r.suggestions.map((s) => ({
      taskId: s.task_id,
      title: s.title,
      dueDate: s.due_date,
      day: s.day,
      time: s.time,
      currentlyStarred: s.currently_starred,
      recommendedStar: s.recommended_star,
      score: s.score,
      reason: s.reason,
    })),
  }
}

/** Xác nhận áp dụng đánh dấu sao (⭐) cho các task được chọn. */
export async function confirmPrioritySuggestions(
  taskIds: number[],
  isStarred = true,
): Promise<SearchResult[]> {
  const r = await request<BeTaskList>("POST", "/ai/priority-confirm", {
    body: {
      task_ids: taskIds,
      is_starred: isStarred,
    },
  })
  return r.tasks.map(toPlaced)
}

// ---------------------------------------------------------------------------
// Habit
// ---------------------------------------------------------------------------

export type HabitInput = Omit<Habit, "id">

export async function listHabits(): Promise<Habit[]> {
  return (await request<BeHabit[]>("GET", "/habits")).map(toHabit)
}

export async function createHabit(h: HabitInput): Promise<Habit> {
  return toHabit(
    await request<BeHabit>("POST", "/habits", {
      body: {
        title: h.title,
        frequency: freqToBe(h.frequency),
        days: h.days,
        time: h.time,
        auto_task: h.autoTask,
        is_active: h.active,
      },
    }),
  )
}

export interface AiQuotaInfo {
  limit: number
  used: number
  remaining: number
  resetInSeconds: number
  windowSeconds: number
  provider: string
}

/** Lấy thông tin hạn mức sử dụng AI hiện tại */
export async function getAiQuota(): Promise<AiQuotaInfo> {
  const r = await request<{
    limit: number
    used: number
    remaining: number
    reset_in_seconds: number
    window_seconds: number
    provider: string
  }>("GET", "/ai/quota")
  return {
    limit: r.limit,
    used: r.used,
    remaining: r.remaining,
    resetInSeconds: r.reset_in_seconds,
    windowSeconds: r.window_seconds,
    provider: r.provider,
  }
}

// ---------------------------------------------------------------------------
// AI Assistant (Hỏi đáp và nhập liệu bằng giọng nói / văn bản)
// ---------------------------------------------------------------------------

export interface AssistantActionTask {
  title: string
  date?: string | null
  day?: number | null
  time?: string | null
  isStarred?: boolean
  priority?: "low" | "medium" | "high"
}

export interface AssistantAction {
  type: "create_task" | "none"
  task?: AssistantActionTask | null
}

export interface AIAssistantResponse {
  reply: string
  action?: AssistantAction | null
  provider: string
}

export async function askAssistant(
  message: string,
  context?: { currentDay?: number; todayDate?: string; weekOffset?: number },
): Promise<AIAssistantResponse> {
  const r = await request<{
    reply: string
    action?: {
      type: "create_task" | "none"
      task?: {
        title: string
        date?: string | null
        day?: number | null
        time?: string | null
        is_starred?: boolean
        priority?: "low" | "medium" | "high"
      } | null
    } | null
    provider: string
  }>("POST", "/ai/assistant", {
    body: {
      message,
      current_day: context?.currentDay,
      today_date: context?.todayDate,
      week_offset: context?.weekOffset,
    },
  })

  return {
    reply: r.reply,
    provider: r.provider,
    action: r.action
      ? {
          type: r.action.type,
          task: r.action.task
            ? {
                title: r.action.task.title,
                date: r.action.task.date,
                day: r.action.task.day,
                time: r.action.task.time,
                isStarred: r.action.task.is_starred,
                priority: r.action.task.priority,
              }
            : null,
        }
      : null,
  }
}

export interface HabitRecognitionSuggestion {
  title: string
  frequency: "daily" | "weekdays" | "custom"
  days: number[]
  time: string | null
  reason: string
  confidence: number
}

export async function recognizeHabits(
  text: string,
): Promise<{
  suggestions: HabitRecognitionSuggestion[]
  notice: string
  provider: string
}> {
  return request<{
    suggestions: HabitRecognitionSuggestion[]
    notice: string
    provider: string
  }>("POST", "/ai/habits/recognize", { body: { text } })
}

export async function updateHabit(
  id: number,
  patch: Partial<HabitInput>,
): Promise<Habit> {
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.frequency !== undefined) body.frequency = freqToBe(patch.frequency)
  if (patch.days !== undefined) body.days = patch.days
  if (patch.time !== undefined) body.time = patch.time
  if (patch.autoTask !== undefined) body.auto_task = patch.autoTask
  if (patch.active !== undefined) body.is_active = patch.active
  return toHabit(await request<BeHabit>("PATCH", `/habits/${id}`, { body }))
}

/** Xóa mềm, không khôi phục được qua API. */
export async function deleteHabit(id: number): Promise<void> {
  await request<void>("DELETE", `/habits/${id}`)
}

/** Đánh dấu habit cho ngày hôm nay (BE từ chối ngày khác). Trả về task cùng ngày nếu có. */
export async function setHabitLog(
  habitId: number,
  date: Ymd,
  done: boolean,
): Promise<{ done: boolean; task: Task | null }> {
  const r = await request<{ is_completed: boolean; task: BeTask | null }>(
    "PUT",
    `/habits/${habitId}/logs/${date}`,
    { body: { is_completed: done } },
  )
  return { done: r.is_completed, task: r.task ? toTask(r.task) : null }
}

export interface HeatmapHabit {
  id: number
  title: string
  frequency: Habit["frequency"]
  days: number[]
  time: string
  active: boolean
  deleted: boolean
  createdDate: Ymd
  scheduledCount: number
  doneCount: number
  percent: number
  /** một phần tử cho mỗi ngày của năm: 0 = trống, 1 = bỏ lỡ, 2 = đã làm */
  cells: number[]
}
export interface Heatmap {
  year: number
  startDate: Ymd
  endDate: Ymd
  today: Ymd
  availableYears: number[]
  daysTracked: number
  habitCount: number
  consistency: number
  habits: HeatmapHabit[]
}

export async function getHeatmap(year?: number): Promise<Heatmap> {
  const r = await request<{
    year: number
    start_date: Ymd
    end_date: Ymd
    today: Ymd
    available_years: number[]
    days_tracked: number
    habit_count: number
    consistency: number
    habits: (BeHabit & {
      is_deleted: boolean
      created_date: Ymd
      scheduled_count: number
      done_count: number
      percent: number
      cells: number[]
    })[]
  }>("GET", "/habits/heatmap", { query: { year } })
  return {
    year: r.year,
    startDate: r.start_date,
    endDate: r.end_date,
    today: r.today,
    availableYears: r.available_years,
    daysTracked: r.days_tracked,
    habitCount: r.habit_count,
    consistency: r.consistency,
    habits: r.habits.map((h) => ({
      id: h.id,
      title: h.title,
      frequency: freqToFe(h.frequency),
      days: h.days,
      time: h.time,
      active: h.is_active,
      deleted: h.is_deleted,
      createdDate: h.created_date,
      scheduledCount: h.scheduled_count,
      doneCount: h.done_count,
      percent: h.percent,
      cells: h.cells,
    })),
  }
}

// ---------------------------------------------------------------------------
// Cài đặt và nhắc nhở
// ---------------------------------------------------------------------------

export interface Settings {
  /** "HH:mm" */
  reminderTime: string
  /** 5, 10, 15, 30 hoặc null (tắt) */
  reminderLeadMinutes: number | null
}

export async function getSettings(): Promise<Settings> {
  const r = await request<{
    reminder_time: string
    reminder_lead_minutes: number | null
  }>("GET", "/me/settings")
  return {
    reminderTime: r.reminder_time,
    reminderLeadMinutes: r.reminder_lead_minutes,
  }
}

/** Chỉ gửi các trường có trong patch. reminderLeadMinutes: null để tắt nhắc trước giờ. */
export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const body: Record<string, unknown> = {}
  if (patch.reminderTime !== undefined) body.reminder_time = patch.reminderTime
  if (patch.reminderLeadMinutes !== undefined)
    body.reminder_lead_minutes = patch.reminderLeadMinutes
  const r = await request<{
    reminder_time: string
    reminder_lead_minutes: number | null
  }>("PUT", "/me/settings", { body })
  return {
    reminderTime: r.reminder_time,
    reminderLeadMinutes: r.reminder_lead_minutes,
  }
}

export interface Reminders {
  today: Ymd
  /** thời điểm của máy chủ (ms) */
  now: number
  reminderTime: string
  reminderLeadMinutes: number | null
  pendingTasks: number
  pendingHabits: number
  upcoming: {
    id: number
    title: string
    time: string
    minutesUntil: number
    habitId?: number
  }[]
}

export async function getReminders(): Promise<Reminders> {
  const r = await request<{
    today: Ymd
    now: string
    reminder_time: string
    reminder_lead_minutes: number | null
    pending_tasks: number
    pending_habits: number
    upcoming: {
      id: number
      title: string
      time: string
      minutes_until: number
      habit_id: number | null
    }[]
  }>("GET", "/reminders")
  return {
    today: r.today,
    now: Date.parse(r.now),
    reminderTime: r.reminder_time,
    reminderLeadMinutes: r.reminder_lead_minutes,
    pendingTasks: r.pending_tasks,
    pendingHabits: r.pending_habits,
    upcoming: r.upcoming.map((u) => ({
      id: u.id,
      title: u.title,
      time: u.time,
      minutesUntil: u.minutes_until,
      habitId: u.habit_id ?? undefined,
    })),
  }
}
