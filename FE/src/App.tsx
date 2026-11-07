import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"

import Icon, { type IconName } from "./components/Icon"
import { QuickAddTask, InlineTimePicker } from "./components/InlineAddTask"
import AIBreakdownModal from "./components/AIBreakdownModal"
import AIAssistantModal from "./components/AIAssistantModal"
import AIPriorityModal from "./components/AIPriorityModal"
import AIHabitRecognitionModal from "./components/AIHabitRecognitionModal"
import WeeklyReviewModal from "./components/WeeklyReviewModal"
import AIDropdown from "./components/AIDropdown"
import {
  PlannerTaskCard,
  MobileTaskCard as MobileTaskCardExternal,
} from "./components/TaskCard"
import { SearchDropdown } from "./components/SearchDropdown"
import { TrashBinModal as TrashBinModalExternal } from "./components/TrashBinModal"
import type {
  Task,
  BreakdownItem,
  Habit,
  OverdueTask,
  SearchResult,
} from "./types"
import * as api from "./api"
import {
  useAppData,
  type QuickTaskDraft,
  type SignedOutReason,
} from "./hooks/useAppData"
import { sortTasksByPriorityAndTime } from "./utils/aiBreakdown"
import { localYmd, ymdToLocalDate, dayToDate, dateToWeekDay } from "./utils/dates"
import { getWeekLabelForOffset, WEEK_ANCHOR_MONDAY } from "./utils/week"
import {
  showAppNotification,
  getNotificationPermission,
  requestNotificationPermission,
} from "./utils/notifications"
import { useReminderNotifications } from "./hooks/useReminderNotifications"


import { Ring } from "./components/Ring"
import { WeekPicker } from "./components/WeekPicker"
import { HabitReviewModal } from "./components/HabitReviewModal"
import { ProfileMenu } from "./components/ProfileMenu"
import { PendingTasks, MobilePendingBanner } from "./components/PendingTasks"
import { HabitManagementModal } from "./components/HabitManagementModal"
import {
  startMonday,
  dayNames,
  shortDays,
  addDays,
  dateForInput,
  weekOffsetForDate,
  habitApplies,
} from "./utils/dateHelpers"


const INSPIRING_QUOTES = [
  {
    text: "“I am capable of creating a week I feel good about.”",
    author: "Mindful Living",
  },
  {
    text: "“Thành công là tổng hòa của những nỗ lực nhỏ, lặp đi lặp lại mỗi ngày.”",
    author: "Robert Collier",
  },
  {
    text: "“Tập trung vào hiệu quả thực tế thay vì chỉ tỏ ra bận rộn.”",
    author: "Tim Ferriss",
  },
  {
    text: "“Kỷ luật là chiếc cầu nối vững chắc giữa mục tiêu và thành tựu.”",
    author: "Jim Rohn",
  },
  {
    text: "“Mọi tiến trình vĩ đại đều bắt đầu từ một bước đi nhỏ hôm nay.”",
    author: "Lão Tử",
  },
  {
    text: "“Done is better than perfect. Hãy tự tin tiến bước!”",
    author: "Sheryl Sandberg",
  },
  {
    text: "“Hãy làm cho tuần này trở thành một tuần đáng tự hào của bạn.”",
    author: "FocusFlow",
  },
  {
    text: "“Thói quen tốt được xây dựng từng ngày, không phải trong một ngày.”",
    author: "Atomic Habits",
  },
  {
    text: "“Năng lượng tích cực đến từ sự rõ ràng và hành động kiên định.”",
    author: "Robin Sharma",
  },
]

export default function App({ onSignedOut }: {
  onSignedOut?: (reason: SignedOutReason) => void
} = {}) {
  const [searchQuery, setSearchQuery] = useState("")
  const data = useAppData(searchQuery, onSignedOut)
  const {
    weekOffset,
    setWeekOffset,
    tasksByWeek,
    getTaskDay,
    habitDefinitions,
    overdue,
    undoItem,
    deletedTasks,
  } = data

  // US-27 & US-28: Lắng nghe nhắc việc và tổng kết ngày (click thông báo mở tuần hiện tại)
  useReminderNotifications({
    enabled: true,
    playSound: true,
    onNavigateCurrentWeek: () => setWeekOffset(0),
    onSignedOut,
  })
  const {
    toggleTask,
    updateTaskTitle,
    toggleTaskStar,
    toggleHabit,
    addHabit,
    updateHabit,
    removeHabit,
    reorderHabit,
    moveTask,
    carryOverdue,
    dismissTask,
    restoreTask,
    undoDelete,
    permanentlyDeleteTask,
  } = data
  const [habitModalOpen, setHabitModalOpen] = useState(false)
  const [habitRecognitionOpen, setHabitRecognitionOpen] = useState(false)
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false)
  const [priorityModalOpen, setPriorityModalOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [showHabits, setShowHabits] = useState(true)
  const [compactCards, setCompactCards] = useState(false)
  const [weekStartsSunday, setWeekStartsSunday] = useState(false)
  const [darkDashboard, setDarkDashboard] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [quickAddDay, setQuickAddDay] = useState<number | null>(null)
  const [editModeByDay, setEditModeByDay] = useState<Record<number, boolean>>(
    {},
  )
  const [focusMode, setFocusMode] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [newDay, setNewDay] = useState(data.today.day)
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState(data.today.day)

  const [weeklyFocus, setWeeklyFocus] = useState(() => {
    return (
      localStorage.getItem("focusflow_weekly_focus") ||
      "Make space for deep work and mindful moments."
    )
  })
  const [editingFocus, setEditingFocus] = useState(false)
  const [focusDraft, setFocusDraft] = useState(weeklyFocus)

  function saveWeeklyFocus(newFocus: string) {
    const val =
      newFocus.trim() || "Make space for deep work and mindful moments."
    setWeeklyFocus(val)
    localStorage.setItem("focusflow_weekly_focus", val)
    setEditingFocus(false)
  }

  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * INSPIRING_QUOTES.length),
  )
  const currentQuote = INSPIRING_QUOTES[quoteIndex]
  function shuffleQuote() {
    setQuoteIndex((prev) => (prev + 1) % INSPIRING_QUOTES.length)
  }

  const monday = addDays(startMonday, weekOffset * 7)
  const sunday = addDays(monday, 6)
  const tasks = tasksByWeek[weekOffset] ?? []
  const habitChecks = data.habitsByWeek[weekOffset] ?? {}
  const currentWeek = data.today.week
  const todayDay = data.today.day
  const doneCount = tasks.filter((task) => task.done).length
  const percent = tasks.length
    ? Math.round((doneCount / tasks.length) * 100)
    : 0
  const selectedDate = addDays(monday, selectedDay)
  const selectedTasks = sortTasksByPriorityAndTime(
    tasks.filter((task) => getTaskDay(task.id) === selectedDay),
  )
  const selectedDone = selectedTasks.filter((task) => task.done).length
  const selectedPercent = selectedTasks.length
    ? Math.round((selectedDone / selectedTasks.length) * 100)
    : 0
  const dayOrder = weekStartsSunday
    ? [6, 0, 1, 2, 3, 4, 5]
    : [0, 1, 2, 3, 4, 5, 6]

  function openTrash() {
    setTrashOpen(true)
    void data.refreshTrash()
  }

  const matchingTasks: SearchResult[] = data.matchingTasks
  const currentMatches = matchingTasks.filter(
    (result) => result.week === weekOffset && !result.task.done,
  )
  const otherMatches = matchingTasks.filter(
    (result) => result.week !== weekOffset && !result.task.done,
  )
  const completedCurrentMatches = matchingTasks
    .filter((result) => result.week === weekOffset && result.task.done)
    .sort((a, b) => (b.task.completedAt ?? 0) - (a.task.completedAt ?? 0))
  const completedOtherMatches = matchingTasks
    .filter((result) => result.week !== weekOffset && result.task.done)
    .sort((a, b) => (b.task.completedAt ?? 0) - (a.task.completedAt ?? 0))

  function addQuickTask(day: number, draft: QuickTaskDraft): Promise<boolean> {
    const isPast = dayToDate(weekOffset, day) < data.today.date
    if (isPast) {
      showAppNotification({
        title: "FocusFlow AI",
        body: "Không thể tạo công việc cho ngày trong quá khứ.",
      })
      return Promise.resolve(false)
    }
    return data.addTask(day, draft).then((ok) => {
      if (ok) setQuickAddDay(null)
      return ok
    })
  }

  async function saveBreakdown(items: BreakdownItem[]): Promise<boolean> {
    const ok = await data.saveBreakdown(items)
    if (ok) setBreakdownModalOpen(false)
    return ok
  }

  async function handleLogout() {
    await api.logout()
    onSignedOut?.("logout")
  }

  useEffect(() => {
    if (!data.me) return
    setProfileName(data.me.fullName || data.me.email.split("@")[0])
    setProfileEmail(data.me.email)
  }, [data.me])

  const streak = useMemo(() => {
    let count = 0
    for (let day = 0; day < 7; day++) {
      const hasTaskDone = tasks.some((t) => getTaskDay(t.id) === day && t.done)
      const hasHabitDone = Object.values(habitChecks).some((arr) => arr[day])
      if (hasTaskDone || hasHabitDone) count++
    }
    return Math.max(1, count)
  }, [tasks, habitChecks])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Chào buổi sáng"
    if (hour < 18) return "Chào buổi chiều"
    return "Chào buổi tối"
  }, [])

  const progressSentiment = useMemo(() => {
    if (percent >= 80)
      return "Phong độ xuất sắc! Bạn đã gần hoàn thành tuần này 🚀"
    if (percent >= 50)
      return "Tuyệt vời! Đã vượt qua nửa chặng đường tuần này ✨"
    if (percent > 0) return "Mỗi bước nhỏ đều tạo nên thay đổi lớn 🌱"
    return "Stay intentional, celebrate the small wins, and make this week yours."
  }, [percent])

  function handleAISuggestFocus() {
    const taskTitles = tasks.map((t) => t.title).slice(0, 5)
    if (taskTitles.length > 0) {
      const suggestions = [
        `Tập trung dứt điểm "${taskTitles[0]}" và duy trì nhịp làm việc sâu.`,
        `Ưu tiên giải quyết các mục tiêu quan trọng và tối ưu năng suất tuần này.`,
        `Giữ kỷ luật với ${tasks.length} đầu việc trọng tâm và hoàn thành đúng hạn.`,
        `Thực hiện từng bước vững chắc để hoàn thành các mục tiêu tuần này.`,
      ]
      const chosen =
        suggestions[Math.floor(Math.random() * suggestions.length)]
      saveWeeklyFocus(chosen)
      setFocusDraft(chosen)
    } else {
      const general = [
        "Lên kế hoạch chủ động và sẵn sàng cho các cột mốc quan trọng tuần này.",
        "Dành trọn sự tập trung cho công việc có giá trị cao nhất mỗi ngày.",
        "Make space for deep work and mindful moments.",
      ]
      const chosen = general[Math.floor(Math.random() * general.length)]
      saveWeeklyFocus(chosen)
      setFocusDraft(chosen)
    }
  }

  return (
    <div
      className={`min-h-screen bg-[#f8fafc] text-[#182a23] ${
        darkDashboard ? "dashboard-dark" : ""
      }`}
    >
      <div className="dashboard-mobile min-h-screen bg-[#fafbf5] pb-32 md:hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#eaf8e8] to-transparent" />
        <div className="relative mx-auto max-w-[480px]">
          <header className="relative z-50 flex items-center justify-between gap-3 px-5 pt-7">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#5da775]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> DAILY
                FOCUS
              </div>
              <h1 className="text-[22px] font-bold tracking-[-0.055em] text-[#193729]">
                FocusFlow <span className="text-[#31b963]">AI</span>
              </h1>
              <p className="mt-1 text-[11px] font-medium text-[#829689]">
                Good morning, {profileName.split(" ")[0]} ·{" "}
                {selectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Ring value={selectedPercent} size={52} stroke={5}>
                <span className="text-[11px] font-extrabold text-[#2c9353]">
                  {selectedPercent}%
                </span>
              </Ring>
              <ProfileMenu
                dark={darkDashboard}
                setDark={setDarkDashboard}
                showHabits={showHabits}
                setShowHabits={setShowHabits}
                compactCards={compactCards}
                setCompactCards={setCompactCards}
                weekStartsSunday={weekStartsSunday}
                setWeekStartsSunday={setWeekStartsSunday}
                name={profileName}
                setName={setProfileName}
                email={profileEmail}
                setEmail={setProfileEmail}
                onOpenTrash={() => openTrash()}
                onLogout={handleLogout}
              />
            </div>
          </header>

          <div className="mt-6 px-5">
            <div className="relative z-30 mb-3">
              <WeekPicker
                weekOffset={weekOffset}
                onChange={setWeekOffset}
                tasksByWeek={tasksByWeek}
                getTaskDay={getTaskDay}
              />
            </div>
            <div className="relative z-20 mb-3 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#90a297]"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tasks or time..."
                  aria-label="Search tasks"
                  className="h-10 w-full rounded-xl border border-[#e2e8f0] bg-white pl-9 pr-3 text-[11px] text-[#334e3c] outline-none focus:border-[#62d786] focus:ring-2 focus:ring-[#4ade80]/15"
                />
                <SearchDropdown
                  query={searchQuery}
                  current={currentMatches}
                  other={otherMatches}
                  completedCurrent={completedCurrentMatches}
                  completedOther={completedOtherMatches}
                  onSelect={(result) => {
                    setWeekOffset(result.week)
                    setSelectedDay(result.day)
                    setSearchQuery("")
                    document
                      .getElementById(`day-${result.day}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                  }}
                />
              </div>
              <AIDropdown
                onOpenBreakdown={() => {
                  setNewDay(selectedDay)
                  setBreakdownModalOpen(true)
                }}
                onOpenPriority={() => setPriorityModalOpen(true)}
                onOpenAssistant={() => {
                  setNewDay(selectedDay)
                  setModalOpen(true)
                }}
              />
              <button
                type="button"
                onClick={() => setFocusMode((value) => !value)}
                aria-pressed={focusMode}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-bold ${
                  focusMode
                    ? "border-[#f5cf76] bg-[#fff8e7] text-[#9a6d12]"
                    : "border-[#e2e8f0] bg-white text-[#64776c]"
                }`}
              >
                <Icon
                  name="star"
                  size={14}
                  className={focusMode ? "fill-current" : ""}
                />
                Focus
              </button>
            </div>
            <div className="rounded-2xl border border-[#e9f0e7] bg-white p-3.5 shadow-[0_8px_24px_rgba(31,65,39,0.045)]">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#9aa99c]">
                  CHOOSE A DAY
                </span>
                <span className="text-[10px] font-semibold text-[#74a680]">
                  {monday.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  –{" "}
                  {sunday.toLocaleDateString("en-US", {
                    day: "numeric",
                    month:
                      monday.getMonth() === sunday.getMonth()
                        ? undefined
                        : "short",
                  })}
                </span>
              </div>
              <div
                className="mobile-date-strip flex gap-1 overflow-x-auto pb-1"
                aria-label="Choose a day"
              >
                {shortDays.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(index)}
                    aria-pressed={selectedDay === index}
                    className="flex min-w-[36px] flex-1 flex-col items-center gap-2 rounded-xl py-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-[#4ade80]"
                  >
                    <span
                      className={`text-[10px] font-semibold ${
                        selectedDay === index
                          ? "text-[#27864a]"
                          : "text-[#9baaa0]"
                      }`}
                    >
                      {day}
                    </span>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold transition ${
                        selectedDay === index
                          ? "bg-[#4ade80] text-[#164b2a] shadow-[0_5px_10px_rgba(74,222,128,0.26)]"
                          : "bg-[#f3f7f0] text-[#596c5d]"
                      }`}
                    >
                      {addDays(monday, index).getDate()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <main className="px-5 pb-20 pt-6">
            <MobilePendingBanner
              items={overdue.slice(0, 3)}
              onCarry={carryOverdue}
            />
            <div className="mb-5 flex items-end justify-between gap-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#66ad78]">
                  ONE STEP AT A TIME
                </p>
                <h2 className="text-[23px] font-bold tracking-[-0.05em] text-[#193729]">
                  Today’s tasks<span className="text-[#4ade80]">.</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeeklyReviewOpen(true)}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10px] font-bold text-emerald-800"
                >
                  Weekly review
                </button>
                <span className="mb-0.5 rounded-full bg-[#e8f7e9] px-3 py-1.5 text-[11px] font-bold text-[#408b56]">
                  {selectedDone} of {selectedTasks.length} done
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {selectedTasks.length === 0 && (
                <div className="rounded-2xl border border-[#eaf0e8] bg-white px-5 py-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf9ed] text-[#55b472]">
                    <Icon name="list" size={22} />
                  </div>
                  <p className="text-[14px] font-semibold text-[#355440]">
                    A little breathing room.
                  </p>
                  <p className="mt-1 text-[12px] text-[#8a9b8d]">
                    Tap the button below to add your first task.
                  </p>
                </div>
              )}
              {selectedTasks.map((task) => {
                const isPast =
                  dayToDate(weekOffset, selectedDay) < data.today.date
                return (
                  <MobileTaskCardExternal
                    key={task.id}
                    task={task}
                    pending={data.pendingTaskIds.has(task.id)}
                    isPast={isPast}
                    focusMode={focusMode}
                    onToggle={() => toggleTask(task.id)}
                    onToggleStar={() => toggleTaskStar(task.id)}
                    onDelete={() => dismissTask(weekOffset, task.id)}
                    onReschedule={() =>
                      moveTask(
                        weekOffset,
                        task.id,
                        selectedDay === 6 ? weekOffset + 1 : weekOffset,
                        selectedDay === 6 ? 0 : selectedDay + 1,
                      )
                    }
                  />
                )
              })}
              {dayToDate(weekOffset, selectedDay) < data.today.date ? (
                <button
                  type="button"
                  disabled
                  title="Không thể tạo công việc cho ngày trong quá khứ"
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-dashed border-[#dcdfdc] bg-[#f4f6f4] py-3.5 text-[12px] font-bold text-[#9ba69d] opacity-65"
                >
                  <Icon name="plus" size={16} /> Add task for today
                </button>
              ) : quickAddDay === selectedDay ? (
                <QuickAddTask
                  key={`mobile-${weekOffset}-${selectedDay}`}
                  day={dayNames[selectedDay]}
                  categories={data.categories}
                  onCancel={() => setQuickAddDay(null)}
                  onAdd={(draft) => addQuickTask(selectedDay, draft)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickAddDay(selectedDay)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#bcdcc4] bg-[#f5fbf6] py-3.5 text-[12px] font-bold text-[#459661]"
                >
                  <Icon name="plus" size={16} /> Add task for today
                </button>
              )}
            </div>
            {selectedTasks.length > 0 && (
              <p className="mt-5 text-center text-[10px] font-medium text-[#9aad9c]">
                Swipe right to complete · Swipe left for actions
              </p>
            )}

            {showHabits && (
              <section
                aria-labelledby="mobile-habits-title"
                className="mt-7 rounded-2xl border border-[#e5eee7] bg-white p-4 shadow-[0_6px_18px_rgba(31,65,39,0.04)]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#69ad7b]">
                      DAILY RHYTHM
                    </p>
                    <h2
                      id="mobile-habits-title"
                      className="mt-0.5 text-[16px] font-bold text-[#253d2e]"
                    >
                      Quick habits
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHabitModalOpen(true)}
                    className="flex items-center gap-1 rounded-[10px] bg-[#e9f9ed] px-2.5 py-2 text-[10px] font-bold text-[#388b55]"
                  >
                    <Icon name="plus" size={13} /> Habit
                  </button>
                </div>
                <div className="space-y-2">
                  {habitDefinitions
                    .filter(
                      (habit) =>
                        habit.active && habitApplies(habit, selectedDay),
                    )
                    .slice(0, 3)
                    .map((habit) => {
                      const checked = Boolean(
                        habitChecks[habit.id]?.[selectedDay],
                      )
                      return (
                        <label
                          key={habit.id}
                          className="flex items-center gap-3 rounded-xl bg-[#f5f9f4] px-3 py-2.5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleHabit(habit.id, selectedDay)}
                            className="peer sr-only"
                          />
                          <span className="flex h-5 w-5 items-center justify-center rounded-md border border-[#cadbcd] bg-white text-white peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80]">
                            {checked && <Icon name="check" size={12} />}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${
                              checked
                                ? "text-[#8b9c8f] line-through"
                                : "text-[#354b3b]"
                            }`}
                          >
                            {habit.title}
                          </span>
                          <span className="text-[9px] text-[#91a295]">
                            {habit.time}
                          </span>
                        </label>
                      )
                    })}
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-[#edf2ed] pt-3 text-[10px] font-bold text-[#3ca662]"
                >
                  View habit review <Icon name="arrow" size={12} />
                </button>
              </section>
            )}
          </main>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewDay(selectedDay)
            setModalOpen(true)
          }}
          aria-label="Open AI Assistant & Voice"
          title="Trợ lý FocusFlow AI & Giọng nói"
          className="fixed bottom-6 right-6 z-50 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#4ade80] text-[#164c2b] shadow-lg shadow-[#39b15b]/30 transition active:scale-95"
        >
          <Icon name="mic" size={25} />
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-[#fafbf5] bg-white text-[#3db76b]">
            <Icon name="sparkle" size={13} />
          </span>
        </button>
      </div>
      <div className="dashboard-desktop hidden md:block">
        <header className="sticky top-0 z-50 border-b border-[#e9eeeb] bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex h-[72px] max-w-[1640px] items-center justify-between gap-4 px-6 lg:px-10 xl:px-12">
            {/* Cụm trái: Logo và WeekPicker cố định cạnh nhau - không bao giờ bị nhảy/trôi vị trí */}
            <div className="flex shrink-0 items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#4ade80] text-[#155b34] shadow-[0_5px_12px_rgba(74,222,128,0.2)]">
                  <Icon name="sparkle" size={22} />
                </div>
                <span className="text-[20px] font-bold tracking-[-0.05em] whitespace-nowrap">
                  FocusFlow <span className="text-[#31b963]">AI</span>
                </span>
              </div>

              <div className="h-6 w-px bg-[#e3eae4]" />

              {/* Thanh chọn tuần được fixed cứng ở vị trí này, không bị trôi khi resize */}
              <div className="shrink-0">
                <WeekPicker
                  weekOffset={weekOffset}
                  onChange={setWeekOffset}
                  tasksByWeek={tasksByWeek}
                  getTaskDay={getTaskDay}
                />
              </div>
            </div>

            {/* Cụm giữa: Ô tìm kiếm mở rộng cân đối, lấp đầy khoảng cách để không bị trống trải */}
            <div className="relative mx-2 flex-1 max-w-[420px]">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#90a297]"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm kiếm công việc hoặc thời gian..."
                aria-label="Search tasks"
                className="h-10 w-full rounded-xl border border-[#e2e8f0] bg-[#f8faf9] pl-10 pr-4 text-[12px] text-[#334e3c] outline-none transition focus:border-[#62d786] focus:bg-white focus:ring-2 focus:ring-[#4ade80]/15"
              />
              <SearchDropdown
                query={searchQuery}
                current={currentMatches}
                other={otherMatches}
                completedCurrent={completedCurrentMatches}
                completedOther={completedOtherMatches}
                onSelect={(result) => {
                  setWeekOffset(result.week)
                  setSelectedDay(result.day)
                  setSearchQuery("")
                  document.getElementById(`day-${result.day}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "center",
                  })
                }}
              />
            </div>

            {/* Cụm phải: Công cụ tinh gọn (Focus Mode, AI Dropdown, Settings, Profile) */}
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setFocusMode((value) => !value)}
                aria-pressed={focusMode}
                title={focusMode ? "Tắt Focus Mode" : "Bật Focus Mode"}
                className={`flex h-10 items-center gap-1.5 rounded-[10px] border px-3 text-[11px] font-bold transition ${
                  focusMode
                    ? "border-[#f5cf76] bg-[#fff8e7] text-[#9a6d12]"
                    : "border-[#e8eeea] bg-white text-[#64776c] hover:bg-[#f4faf5]"
                }`}
              >
                <Icon
                  name="star"
                  size={14}
                  className={focusMode ? "fill-current" : ""}
                />
                <span className="hidden xl:inline">Focus Mode</span>
              </button>

              {/* Nút AI gộp 3 tính năng: Breakdown, Priority, Voice Assistant */}
              <AIDropdown
                onOpenBreakdown={() => {
                  setNewDay(selectedDay)
                  setBreakdownModalOpen(true)
                }}
                onOpenPriority={() => setPriorityModalOpen(true)}
                onOpenAssistant={() => {
                  setNewDay(selectedDay)
                  setModalOpen(true)
                }}
              />

              <ProfileMenu
                dark={darkDashboard}
                setDark={setDarkDashboard}
                showHabits={showHabits}
                setShowHabits={setShowHabits}
                compactCards={compactCards}
                setCompactCards={setCompactCards}
                weekStartsSunday={weekStartsSunday}
                setWeekStartsSunday={setWeekStartsSunday}
                name={profileName}
                setName={setProfileName}
                email={profileEmail}
                setEmail={setProfileEmail}
                onOpenTrash={openTrash}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1640px] px-6 pb-16 pt-9 lg:px-10 xl:px-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4aaf70]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> YOUR
                WEEKLY SPACE
              </div>
              <h1 className="text-[30px] font-bold tracking-[-0.055em] text-[#1d3025] sm:text-[36px]">
                {greeting}, {profileName ? profileName.split(" ")[0] : "bạn"}
                <span className="text-[#43c873]">.</span>
              </h1>
              <p className="mt-1 text-[14px] text-[#839087]">
                {progressSentiment}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3.5 py-1.5 text-[12px] font-bold text-amber-800 shadow-xs transition hover:bg-amber-100/90"
                title={`Chuỗi duy trì hoạt động: ${streak} ngày`}
              >
                <span className="text-[14px]">🔥</span>
                <span>{streak} ngày liên tục</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#e7eee9] bg-white px-4 py-2 text-[12px] font-medium text-[#62776a] shadow-xs">
                <Icon name="sun" size={16} className="text-[#dcae56]" /> Make room
                for what matters
              </div>
            </div>
          </div>

          <div
            className={`grid gap-5 ${
              showHabits ? "xl:grid-cols-[1.15fr_0.85fr]" : ""
            }`}
          >
            <section
              className="flex flex-col justify-between rounded-2xl border border-[#edf1ee] bg-white p-5 shadow-[0_5px_18px_rgba(30,65,43,0.05)] sm:p-6"
              aria-labelledby="overview-title"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">
                    THE BIG PICTURE
                  </div>
                  <h2
                    id="overview-title"
                    className="text-[18px] font-bold tracking-[-0.035em]"
                  >
                    Weekly overview
                  </h2>
                </div>
                <span className="rounded-full bg-[#effbf2] px-3 py-1.5 text-[11px] font-semibold text-[#37895a]">
                  {getWeekLabelForOffset(weekOffset)}
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
                <div className="flex flex-col gap-3">
                  <div className="relative min-h-[125px] overflow-hidden rounded-[14px] border border-[#cbeed4]/70 bg-gradient-to-br from-[#eaf9ed] to-[#dcfce7]/60 p-4 shadow-xs transition-all hover:shadow-sm">
                    <div className="absolute -bottom-10 -right-8 h-32 w-32 rounded-full border-[17px] border-white/30 pointer-events-none" />
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-[#36aa61] shadow-2xs">
                          <Icon name="target" size={16} />
                        </div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4c9b64]">
                          WEEKLY FOCUS
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleAISuggestFocus}
                          title="AI gợi ý mục tiêu tuần dựa trên công việc"
                          className="flex h-6.5 items-center gap-1 rounded-md border border-[#c1e8cb] bg-white/70 px-2 text-[10px] font-bold text-[#2e7d4c] transition hover:bg-white hover:shadow-2xs"
                        >
                          <Icon name="sparkle" size={11} /> AI Gợi ý
                        </button>
                        {!editingFocus && (
                          <button
                            type="button"
                            onClick={() => {
                              setFocusDraft(weeklyFocus)
                              setEditingFocus(true)
                            }}
                            title="Chỉnh sửa mục tiêu tuần"
                            className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-[#c1e8cb] bg-white/70 text-[#2e7d4c] transition hover:bg-white hover:shadow-2xs"
                          >
                            <Icon name="edit" size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    {editingFocus ? (
                      <div className="relative z-10 mt-1">
                        <input
                          type="text"
                          value={focusDraft}
                          onChange={(e) => setFocusDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveWeeklyFocus(focusDraft)
                            if (e.key === "Escape") setEditingFocus(false)
                          }}
                          autoFocus
                          maxLength={120}
                          placeholder="Nhập mục tiêu trọng tâm của tuần..."
                          className="w-full rounded-lg border border-[#36aa61] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[#183d29] outline-none shadow-xs"
                        />
                        <div className="mt-2 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingFocus(false)}
                            className="rounded-md border border-[#dae8dd] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#617769] hover:bg-[#f3f7f4]"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => saveWeeklyFocus(focusDraft)}
                            className="rounded-md bg-[#34aa61] px-2.5 py-0.5 text-[10px] font-bold text-white hover:bg-[#2c9353]"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        onClick={() => {
                          setFocusDraft(weeklyFocus)
                          setEditingFocus(true)
                        }}
                        title="Bấm để chỉnh sửa mục tiêu tuần"
                        className="group relative mt-1 cursor-pointer text-[14px] font-semibold leading-snug text-[#25563a] transition hover:text-[#183f29]"
                      >
                        {weeklyFocus}
                        <span className="ml-1.5 inline-block opacity-0 text-[11px] text-[#4c9b64] transition group-hover:opacity-100">
                          ✎
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex min-h-[88px] items-start gap-3 rounded-[14px] border border-[#f0efea] bg-[#fffdf8] p-4 shadow-2xs transition-all hover:shadow-xs">
                    <Icon
                      name="quote"
                      size={16}
                      className="mt-0.5 shrink-0 text-[#d4a55d]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ba945b]">
                          A LITTLE REMINDER
                        </p>
                        <button
                          type="button"
                          onClick={shuffleQuote}
                          title="Đổi câu truyền cảm hứng ngẫu nhiên"
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[#9d896e] transition hover:bg-[#f6efe1] hover:text-[#785f3e]"
                        >
                          <Icon name="refresh" size={12} />
                        </button>
                      </div>
                      <p className="text-[12px] font-medium italic leading-relaxed text-[#5e5a4e]">
                        {currentQuote.text}
                      </p>
                      {currentQuote.author && (
                        <p className="mt-1 text-right text-[10px] font-semibold not-italic text-[#a89679]">
                          — {currentQuote.author}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-[14px] border border-[#edf1ee] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-bold">Your progress</p>
                      <p className="mt-0.5 text-[11px] text-[#9aa69d]">
                        One step at a time
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#7a8a7e]">
                      {doneCount} of {tasks.length} tasks done
                    </span>
                  </div>
                  <div className="flex items-center gap-5 sm:gap-7">
                    <div className="relative">
                      <Ring value={percent} size={104} stroke={10}>
                        <div className="text-center">
                          <div className="text-[24px] font-bold tracking-[-0.06em]">
                            {percent}%
                          </div>
                          <div className="text-[9px] font-semibold text-[#9aa69d]">
                            DONE
                          </div>
                        </div>
                      </Ring>
                    </div>
                    <div className="flex h-[118px] min-w-0 flex-1 items-end justify-between gap-1.5">
                      {shortDays.map((day, index) => {
                        const dayTasks = tasks.filter(
                          (task) => getTaskDay(task.id) === index,
                        )
                        const completed = dayTasks.filter(
                          (task) => task.done,
                        ).length
                        const dayPercent = dayTasks.length
                          ? Math.round((completed / dayTasks.length) * 100)
                          : 0
                        const height = dayTasks.length
                          ? Math.max(
                              12,
                              Math.round((completed / dayTasks.length) * 90),
                            )
                          : 8
                        return (
                          <div
                            key={day}
                            onClick={() => {
                              document
                                .getElementById(`day-${index}`)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                })
                            }}
                            className="group relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-2 select-none"
                          >
                            {/* Hover tooltip */}
                            <div className="pointer-events-none absolute -top-12 left-1/2 z-30 -translate-x-1/2 opacity-0 transition-all duration-150 group-hover:-top-13 group-hover:opacity-100">
                              <div className="whitespace-nowrap rounded-lg bg-[#182a21] px-2.5 py-1 text-center text-white shadow-xl">
                                <p className="text-[10px] font-bold tracking-wide">
                                  {dayNames[index]}
                                </p>
                                <p className="text-[9px] text-[#9ee6b3]">
                                  {dayTasks.length
                                    ? `${completed}/${dayTasks.length} việc (${dayPercent}%)`
                                    : "Chưa có việc"}
                                </p>
                                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#182a21]" />
                              </div>
                            </div>

                            <div className="flex h-[90px] w-full max-w-[27px] items-end overflow-hidden rounded-t-[5px] bg-[#f0f5f0] transition-colors group-hover:bg-[#e3ede4]">
                              <div
                                className="w-full rounded-t-[5px] bg-[#79de96] transition-all duration-500 group-hover:brightness-105"
                                style={{ height: `${height}px` }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-[#8a9a8f] transition-colors group-hover:text-[#27643e]">
                              {day}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {showHabits && (
              <section
                className="flex flex-col justify-between rounded-2xl border border-[#edf1ee] bg-white p-5 shadow-[0_5px_18px_rgba(30,65,43,0.05)] sm:p-6"
                aria-labelledby="habit-title"
              >
                <div>
                  <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">
                        CONSISTENCY IS KEY
                      </div>
                      <h2
                        id="habit-title"
                        className="text-[18px] font-bold tracking-[-0.035em]"
                      >
                        Habit tracker
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHabitModalOpen(true)}
                        className="flex h-9 items-center gap-1 rounded-[10px] bg-[#4ade80] px-3 text-[11px] font-bold text-[#164c2b] hover:bg-[#36d871]"
                      >
                        <Icon name="plus" size={14} /> Add Habit
                      </button>
                      <button
                        type="button"
                        onClick={() => setHabitModalOpen(true)}
                        aria-label="Manage habits"
                        title="Manage habits"
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#dcebdd] bg-[#f3fbf4] text-[#43a962] hover:bg-[#e5f7e9]"
                      >
                        <Icon name="settings" size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="custom-scrollbar max-h-[195px] overflow-auto">
                    <div className="min-w-[420px]">
                      <div className="sticky top-0 z-10 grid grid-cols-[minmax(140px,1fr)_repeat(7,31px)_68px] items-center gap-1 border-b border-[#eff2ef] bg-white pb-2.5 text-center text-[10px] font-bold text-[#a1aba3]">
                        <span className="text-left">HABIT</span>
                        {shortDays.map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                        <span>PROGRESS</span>
                      </div>
                      <div className="divide-y divide-[#f1f3f1]">
                        {habitDefinitions.map((habit) => {
                          const checks =
                            habitChecks[habit.id] ?? Array(7).fill(false)
                          const eligible = dayNames.map((_, day) =>
                            habitApplies(habit, day),
                          )
                          const count = checks.filter(
                            (checked, day) => checked && eligible[day],
                          ).length
                          const total = eligible.filter(Boolean).length
                          const progress = total
                            ? Math.round((count / total) * 100)
                            : 0
                          return (
                            <div
                              key={habit.id}
                              className={`grid grid-cols-[minmax(140px,1fr)_repeat(7,31px)_68px] items-center gap-1 py-2.5 ${
                                habit.active ? "" : "opacity-50"
                              }`}
                            >
                              <span
                                className="truncate pr-2 text-[11px] font-semibold leading-snug text-[#344a3a]"
                                title={habit.title}
                              >
                                {habit.title}
                                {!habit.active && (
                                  <span className="block text-[9px] font-medium text-[#98a79a]">
                                    Paused
                                  </span>
                                )}
                              </span>
                              {checks.map((checked, day) => (
                                <label key={day} className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(checked)}
                                    disabled={!habit.active || !eligible[day]}
                                    onChange={() => toggleHabit(habit.id, day)}
                                    aria-label={`${habit.title}, ${dayNames[day]}`}
                                    className="sr-only peer"
                                  />
                                  <span className="flex h-[19px] w-[19px] items-center justify-center rounded-[5px] border border-[#dae5db] bg-white text-white transition peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#339e5e] hover:border-[#4ade80] peer-disabled:cursor-not-allowed peer-disabled:bg-[#eef2ee]">
                                    {checked && <Icon name="check" size={12} />}
                                  </span>
                                </label>
                              ))}
                              <div className="pl-2">
                                <div className="mb-1 text-right text-[10px] font-bold text-[#438c59]">
                                  {progress}%
                                </div>
                                <div className="h-[5px] overflow-hidden rounded-full bg-[#ebf2eb]">
                                  <div
                                    className="h-full rounded-full bg-[#73da92] transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {!habitDefinitions.length && (
                          <p className="py-7 text-center text-[11px] text-[#91a294]">
                            No habits yet. Add your first routine to get started.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[#3ca662] hover:text-[#207b44]"
                >
                  View long-term progress <Icon name="arrow" size={13} />
                </button>
              </section>
            )}
          </div>

          <div className="mt-9">
            <PendingTasks
              items={overdue}
              onCarry={carryOverdue}
              onMove={(week, id, date) =>
                moveTask(
                  week,
                  id,
                  weekOffsetForDate(date),
                  (date.getDay() + 6) % 7,
                )
              }
              onDismiss={dismissTask}
            />
          </div>
          <div className="mb-5 mt-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">
                DAY BY DAY
              </div>
              <h2 className="text-[22px] font-bold tracking-[-0.045em]">
                Your weekly plan
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[#e5eee7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6e8875]">
                {tasks.length} tasks this week
              </span>
              <button
                type="button"
                onClick={() => setWeeklyReviewOpen(true)}
                className="rounded-full bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-600"
              >
                Weekly review
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-5">
            <div className="grid min-w-[1190px] grid-cols-7 gap-3.5 lg:gap-4">
              {dayOrder.map((index) => {
                const day = dayNames[index]
                const dayTasks = sortTasksByPriorityAndTime(
                  tasks.filter((task) => getTaskDay(task.id) === index),
                )
                const complete = dayTasks.filter((task) => task.done).length
                const dayPercent = dayTasks.length
                  ? Math.round((complete / dayTasks.length) * 100)
                  : 0
                const date = addDays(monday, index)
                const featured =
                  weekOffset === currentWeek && index === todayDay
                const editMode = Boolean(editModeByDay[index])
                const isPast = dayToDate(weekOffset, index) < data.today.date

                return (
                  <section
                    key={day}
                    id={`day-${index}`}
                    className={`flex min-h-[470px] flex-col rounded-2xl border bg-white p-3 shadow-[0_5px_18px_rgba(30,65,43,0.05)] ${
                      featured ? "border-[#a9e9ba]" : "border-[#edf1ee]"
                    }`}
                    aria-label={`${day} tasks`}
                    onDragOver={(event) => {
                      if (
                        event.dataTransfer.types.includes(
                          "application/x-focusflow-task",
                        )
                      )
                        event.preventDefault()
                    }}
                    onDrop={(event) => {
                      const data = event.dataTransfer.getData(
                        "application/x-focusflow-task",
                      )
                      if (!data) return
                      event.preventDefault()
                      try {
                        const { week, id } = JSON.parse(data)
                        if (Number.isInteger(week) && Number.isInteger(id))
                          moveTask(week, id, weekOffset, index)
                      } catch {
                        // Ignore unrelated drops.
                      }
                    }}
                  >
                    <div
                      className={`mb-3 rounded-[12px] p-3 ${
                        featured ? "bg-[#e5f9e9]" : "bg-[#f5f9f5]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h3 className="text-[13px] font-bold text-[#283d2d]">
                            {day}
                          </h3>
                          <p className="mt-1 text-[10px] font-medium text-[#86a18b]">
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <Ring value={dayPercent} size={31} stroke={3}>
                          <span className="text-[8px] font-bold text-[#48985f]">
                            {dayPercent}
                          </span>
                        </Ring>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#dcebdd] pt-2">
                        <span className="text-[10px] font-semibold text-[#5e9e6c]">
                          Done {complete}/{dayTasks.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditModeByDay((current) => ({
                              ...current,
                              [index]: !current[index],
                            }))
                          }
                          aria-label={`${
                            editMode ? "Exit" : "Enter"
                          } edit mode for ${day}`}
                          aria-pressed={editMode}
                          title={
                            editMode
                              ? `Finish editing ${day}`
                              : `Edit ${day} tasks`
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] ${
                            editMode
                              ? "bg-[#4ade80] text-[#164c2b]"
                              : "text-[#8a9a8f] hover:bg-[#e9f8ec] hover:text-[#368a52]"
                          }`}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {dayTasks.length === 0 && (
                        <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-[#9aa99d]">
                          A fresh page for this day.
                        </p>
                      )}
                      {dayTasks.map((task) => {
                        const isPast =
                          dayToDate(weekOffset, index) < data.today.date
                        return (
                          <PlannerTaskCard
                            key={task.id}
                            task={task}
                            pending={data.pendingTaskIds.has(task.id)}
                            isPast={isPast}
                            compact={compactCards}
                            editMode={editMode}
                            expanded={expandedTask === task.id}
                            onToggle={() => toggleTask(task.id)}
                            onToggleStar={() => toggleTaskStar(task.id)}
                            onDelete={() => dismissTask(weekOffset, task.id)}
                            onSaveTitle={(title) =>
                              updateTaskTitle(task.id, title)
                            }
                            onToggleSteps={() =>
                              setExpandedTask((value) =>
                                value === task.id ? null : task.id,
                              )
                            }
                            focusMode={focusMode}
                          />
                        )
                      })}
                    </div>
                    <div className="mt-auto pt-3">
                      {isPast ? (
                        <button
                          type="button"
                          disabled
                          title="Không thể tạo task cho các ngày trong quá khứ"
                          className="flex w-full cursor-not-allowed items-center justify-center gap-1 rounded-[9px] border border-dashed border-[#dcdfdc] bg-[#f4f6f4] py-2 text-[10px] font-semibold text-[#9ba69d] opacity-65"
                        >
                          <Icon name="plus" size={13} /> Add task
                        </button>
                      ) : quickAddDay === index ? (
                        <QuickAddTask
                          key={`${weekOffset}-${index}`}
                          day={day}
                          categories={data.categories}
                          onCancel={() => setQuickAddDay(null)}
                          onAdd={(draft) => addQuickTask(index, draft)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuickAddDay(index)}
                          className="flex w-full items-center justify-center gap-1 rounded-[9px] border border-dashed border-[#d7e8da] py-2 text-[10px] font-semibold text-[#7baa85] transition hover:border-[#4ade80] hover:bg-[#f4fbf5] hover:text-[#318d52]"
                        >
                          <Icon name="plus" size={13} /> Add task
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-[#a4b0a6]">
            A calmer way to get things done. One day at a time.
          </p>
        </main>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <AIAssistantModal
            currentDay={data.today.day}
            todayDate={data.today.date}
            weekOffset={weekOffset}
            onClose={() => setModalOpen(false)}
            onAddTask={async (task) => {
              let targetWeek = weekOffset
              let targetDay =
                task.day !== null && task.day !== undefined
                  ? task.day
                  : data.today.day

              if (task.date) {
                const wd = dateToWeekDay(task.date)
                targetWeek = wd.week
                targetDay = wd.day
              } else {
                // Nếu chưa có date cụ thể nhưng ngày chọn rơi vào quá khứ của tuần đang xem:
                const checkDate = dayToDate(targetWeek, targetDay)
                if (checkDate < data.today.date && targetWeek === data.today.week) {
                  targetWeek = data.today.week + 1
                }
              }

              const taskDate = dayToDate(targetWeek, targetDay)
              if (taskDate < data.today.date) {
                showAppNotification({
                  title: "FocusFlow AI",
                  body: "Không thể tạo công việc cho ngày trong quá khứ.",
                })
                return false
              }
              const success = await data.addTask(
                targetDay,
                {
                  title: task.title,
                  time: task.time ?? "",
                  starred: task.isStarred ?? false,
                  priority: task.priority ?? "medium",
                  description: "",
                  deadlineAt: "",
                  categoryName: "",
                  clientRequestId: `ai-voice-${Date.now()}`,
                },
                targetWeek,
              )
              if (success && targetWeek !== weekOffset) {
                setWeekOffset(targetWeek)
              }
              return success
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {breakdownModalOpen && (
          <AIBreakdownModal
            initialDay={newDay}
            monday={monday}
            onClose={() => setBreakdownModalOpen(false)}
            onSave={saveBreakdown}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {priorityModalOpen && (
          <AIPriorityModal
            weekOffset={weekOffset}
            todayWeek={currentWeek}
            todayDay={todayDay}
            tasks={tasks}
            getTaskDay={getTaskDay}
            onClose={() => setPriorityModalOpen(false)}
            onConfirmStars={data.applyPriorityStars}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {trashOpen && (
          <TrashBinModalExternal
            items={deletedTasks}
            onClose={() => setTrashOpen(false)}
            onRestore={restoreTask}
            onDelete={permanentlyDeleteTask}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {undoItem && (
          <motion.div
            role="status"
            className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-4 rounded-xl bg-[#20382a] px-4 py-3 text-white shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-[12px] font-medium">Task moved to trash</span>
            <button
              type="button"
              onClick={undoDelete}
              className="text-[11px] font-bold text-[#8cf0a5] hover:text-white"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {data.error && (
          <motion.div
            role="alert"
            className="fixed bottom-20 left-1/2 z-[95] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-xl bg-[#7a2b26] px-4 py-3 text-white shadow-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
          >
            <span className="text-[12px] font-medium">{data.error}</span>
            <button
              type="button"
              onClick={data.clearError}
              className="text-[11px] font-bold text-[#ffd1cc] hover:text-white"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {habitModalOpen && (
        <HabitManagementModal
          habits={habitDefinitions}
          onAdd={addHabit}
          onUpdate={updateHabit}
          onRemove={removeHabit}
          onReorder={reorderHabit}
          onRecognize={() => {
            setHabitModalOpen(false)
            setHabitRecognitionOpen(true)
          }}
          onClose={() => setHabitModalOpen(false)}
        />
      )}
      {habitRecognitionOpen && (
        <AIHabitRecognitionModal
          onClose={() => setHabitRecognitionOpen(false)}
          onCreate={addHabit}
        />
      )}
      {weeklyReviewOpen && (
        <WeeklyReviewModal
          week={weekOffset}
          onClose={() => setWeeklyReviewOpen(false)}
        />
      )}
      {reviewOpen && (
        <HabitReviewModal
          selectedMonday={monday}
          weekOffset={weekOffset}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  )
}
