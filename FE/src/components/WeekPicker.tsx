import React, { useState, useEffect, useRef, useLayoutEffect } from "react"
import Icon from "./Icon"
import type { Task } from "../types"
import { getWeekLabelForOffset } from "../utils/week"
import {
  startMonday,
  dayNames,
  shortDays,
  addDays,
  dateForInput,
  weekOffsetForDate,
} from "../utils/dateHelpers"

function CustomCalendarPopover({
  initialDate,
  onSelectDate,
  onClose,
}: {
  initialDate: Date
  onSelectDate: (date: Date) => void
  onClose: () => void
}) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const startingDay = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const days: { date: Date; currentMonth: boolean }[] = []
  for (let i = startingDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i),
      currentMonth: false,
    })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(viewYear, viewMonth, d),
      currentMonth: true,
    })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: new Date(viewYear, viewMonth + 1, d),
      currentMonth: false,
    })
  }

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Calendar date picker"
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[290px] rounded-2xl border border-[#e5ede7] bg-white p-3.5 text-[#253d2e] shadow-[0_16px_45px_rgba(21,51,31,0.18)]"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-[#274431]">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#667c6c] transition hover:bg-[#edf9ef] hover:text-[#27844b]"
          >
            <Icon name="chevronLeft" size={13} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#667c6c] transition hover:bg-[#edf9ef] hover:text-[#27844b]"
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 text-center">
        {dayHeaders.map((dh) => (
          <span
            key={dh}
            className="text-[10px] font-bold uppercase text-[#8fa093]"
          >
            {dh}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          const isToday = isSameDay(item.date, today)
          const isSelected = isSameDay(item.date, initialDate)
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(item.date)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-medium transition ${
                isSelected
                  ? "bg-[#4ade80] font-bold text-[#144727] shadow-sm"
                  : isToday
                    ? "border border-[#4ade80] font-bold text-[#237744] hover:bg-[#dcfce7]"
                    : item.currentMonth
                      ? "text-[#253d2e] hover:bg-[#edf9ef]"
                      : "text-[#c2cec5] hover:bg-[#f6faf7]"
              }`}
            >
              {item.date.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#eef2ef] px-1 pt-2.5 text-[11px] font-semibold">
        <button
          type="button"
          onClick={onClose}
          className="text-[#849688] transition hover:text-[#e11d48]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onSelectDate(today)}
          className="text-[#2ca258] transition hover:underline"
        >
          Today
        </button>
      </div>
    </div>
  )
}

export function CustomYearDropdown({
  year,
  availableYears,
  onChange,
  dark,
  surface,
}: {
  year: number
  availableYears: number[]
  onChange: (year: number) => void
  dark: boolean
  surface: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Select year"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[12px] font-semibold transition ${surface} focus-visible:outline-2 focus-visible:outline-[#4ade80]`}
      >
        <Icon name="calendar" size={15} className="text-[#64c48b]" />
        <span>{year}</span>
        <Icon
          name="chevronDown"
          size={13}
          className={`text-[#7f9684] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available years"
          className={`absolute right-0 top-full mt-1.5 z-50 min-w-[130px] overflow-hidden rounded-xl border p-1 shadow-[0_12px_36px_rgba(20,50,30,0.18)] ${
            dark
              ? "border-[#2d4739] bg-[#1a2d23] text-[#e0fae8]"
              : "border-[#e2ece4] bg-white text-[#243c2d]"
          }`}
        >
          {availableYears.map((option) => {
            const isSelected = option === year
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition ${
                  isSelected
                    ? dark
                      ? "bg-[#2a4d3a] text-[#8aebb1]"
                      : "bg-[#dcfce7] text-[#1c6439]"
                    : dark
                      ? "text-[#c0dec9] hover:bg-[#233c2f]"
                      : "text-[#324b3a] hover:bg-[#f1f7f3]"
                }`}
              >
                <span>{option}</span>
                {isSelected && <span className="text-[11px] font-bold">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function WeekPicker({
  weekOffset,
  onChange,
  tasksByWeek,
  getTaskDay,
}: {
  weekOffset: number
  onChange: (offset: number) => void
  tasksByWeek: Record<number, Task[]>
  getTaskDay: (id: number) => number
}) {
  const [open, setOpen] = useState(false)
  const [showBacklog, setShowBacklog] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const monday = addDays(startMonday, weekOffset * 7)
  const sunday = addDays(monday, 6)

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setCalendarOpen(false)
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        setCalendarOpen(false)
      }
    }
    document.addEventListener("pointerdown", dismiss)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", dismiss)
      document.removeEventListener("keydown", escape)
    }
  }, [])

  function selectWeek(offset: number) {
    onChange(offset)
    setOpen(false)
    setShowBacklog(false)
    setCalendarOpen(false)
  }

  function offsetForDate(date: Date) {
    const mondayOfDate = addDays(date, -((date.getDay() + 6) % 7))
    return Math.round(
      (mondayOfDate.getTime() - startMonday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    )
  }

  const firstOffset = weekOffset < -4 || weekOffset > 10 ? weekOffset - 4 : -4
  const visibleWeeks = Array.from(
    { length: 16 },
    (_, index) => firstOffset + index,
  )

  const backlog = (tasksByWeek[weekOffset] ?? [])
    .filter((task) => !task.done)
    .sort(
      (a, b) =>
        getTaskDay(a.id) - getTaskDay(b.id) || a.time.localeCompare(b.time),
    )
  const monthDay = (date: Date) =>
    `${date.toLocaleDateString("en-US", { month: "short" })} ${String(date.getDate()).padStart(2, "0")}`

  return (
    <div
      ref={containerRef}
      className="relative flex w-full items-center gap-1.5 sm:w-auto sm:gap-2"
    >
      <button
        type="button"
        onClick={() => onChange(weekOffset - 1)}
        aria-label="Previous week"
        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#66776c] transition hover:border-[#95d9a8] hover:text-[#27844b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] sm:w-10"
      >
        <Icon name="chevronLeft" size={17} />
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setShowBacklog(false)
        }}
        aria-label="Choose a week"
        aria-expanded={open}
        aria-controls="week-picker-menu"
        className={`flex h-10 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg border bg-white px-2 text-[10px] font-semibold text-[#344739] transition sm:min-w-[280px] sm:px-4 sm:text-[13px] ${
          open
            ? "border-[#91dda6] shadow-[0_0_0_3px_rgba(74,222,128,0.12)]"
            : "border-[#e2e8f0] hover:border-[#b4d9bd]"
        } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]`}
      >
        <span className="truncate whitespace-nowrap">
          {getWeekLabelForOffset(weekOffset)}: {monthDay(monday)} -{" "}
          {monthDay(sunday)}, {sunday.getFullYear()}
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={`shrink-0 text-[#7f9684] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <button
        type="button"
        onClick={() => onChange(weekOffset + 1)}
        aria-label="Next week"
        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#66776c] transition hover:border-[#95d9a8] hover:text-[#27844b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] sm:w-10"
      >
        <Icon name="chevronRight" size={17} />
      </button>

      {open && (
        <div
          id="week-picker-menu"
          role="dialog"
          aria-label="Choose a week"
          className="absolute left-1/2 top-[calc(100%+12px)] z-40 w-[min(380px,calc(100vw-32px))] -translate-x-1/2 overflow-visible rounded-2xl border border-[#e5ede7] bg-white p-4 shadow-[0_18px_45px_rgba(20,55,30,0.14)]"
        >
          {/* Header popover: Tiêu đề + Nút lịch + Nút đóng */}
          <div className="mb-3.5 flex items-center justify-between border-b border-[#f0f4f1] pb-3">
            <div>
              <h3 className="text-[13px] font-bold text-[#233d2c]">
                Chọn tuần làm việc
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-[#7a9081]">
                Đang xem:{" "}
                <span className="font-semibold text-[#27864a]">
                  {getWeekLabelForOffset(weekOffset)}
                </span>{" "}
                ({monthDay(monday)} - {monthDay(sunday)})
              </p>
            </div>
            <div className="relative flex items-center gap-1.5">
              {/* Nút icon cuốn lịch mở popover lịch chọn ngày */}
              <button
                type="button"
                onClick={() => setCalendarOpen((prev) => !prev)}
                aria-label="Mở lịch chọn ngày"
                aria-expanded={calendarOpen}
                title="Mở lịch chọn ngày bất kỳ"
                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                  calendarOpen
                    ? "border-[#4ade80] bg-[#eefbf1] text-[#2eae60] shadow-xs"
                    : "border-[#e8eeea] text-[#5c7a65] hover:border-[#a3e5b6] hover:bg-[#f4faf5] hover:text-[#2eae60]"
                }`}
              >
                <Icon name="calendar" size={15} />
              </button>

              {calendarOpen && (
                <CustomCalendarPopover
                  initialDate={monday}
                  onSelectDate={(date) => {
                    selectWeek(offsetForDate(date))
                    setCalendarOpen(false)
                  }}
                  onClose={() => setCalendarOpen(false)}
                />
              )}

              {/* Nút đóng */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setCalendarOpen(false)
                }}
                aria-label="Đóng bảng chọn tuần"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e8eeea] text-[#7a8e80] hover:bg-[#f4faf5] hover:text-[#233d2c]"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          </div>

          {/* Hai nút hành động nhanh: Về tuần này & Chưa xong */}
          <div className="mb-3 grid grid-cols-2 gap-2 border-b border-[#f0f4f1] pb-3">
            <button
              type="button"
              onClick={() => selectWeek(offsetForDate(new Date()))}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#eaf8ee] px-2.5 py-2 text-[11px] font-bold text-[#1f733e] transition hover:bg-[#dbf3e2] active:scale-[0.98]"
            >
              <Icon name="target" size={14} /> Về tuần này
            </button>
            <button
              type="button"
              onClick={() => setShowBacklog((value) => !value)}
              aria-pressed={showBacklog}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition active:scale-[0.98] ${
                showBacklog
                  ? "border-[#93dca7] bg-[#edf9ef] text-[#2f9050]"
                  : "border-[#e5ebe6] bg-[#fafcfb] text-[#55705e] hover:bg-[#f1f5f9]"
              }`}
            >
              <Icon name="inbox" size={14} /> Chưa xong ({backlog.length})
            </button>
          </div>

          {/* Danh sách các tuần hoặc danh sách backlog */}
          <div
            className="max-h-[290px] overflow-y-auto pr-1"
            role="listbox"
            aria-label={showBacklog ? "Backlog tasks" : "Danh sách các tuần"}
          >
            {showBacklog ? (
              <>
                <div className="px-1 pb-2 pt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8ea394]">
                  Việc chưa hoàn thành trong tuần ({backlog.length})
                </div>
                {backlog.length ? (
                  <div className="space-y-1">
                    {backlog.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          document
                            .getElementById(`day-${getTaskDay(task.id)}`)
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "nearest",
                              inline: "center",
                            })
                        }}
                        className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-[#edf3ee] bg-[#fafcfb] p-2.5 text-left transition hover:border-[#c5e6cc] hover:bg-[#f3f9f4]"
                      >
                        <span className="truncate text-[12px] font-medium text-[#2d4433]">
                          {task.title}
                        </span>
                        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#638b6f] border border-[#e5ece6]">
                          {shortDays[getTaskDay(task.id)]}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-[12px] text-[#8b9b8f]">
                    Không có công việc tồn đọng cho tuần này. 🎉
                  </p>
                )}
              </>
            ) : visibleWeeks.length ? (
              visibleWeeks.map((offset, index) => {
                const first = addDays(startMonday, offset * 7)
                const last = addDays(first, 6)
                const month = first.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
                const previous = index
                  ? addDays(
                      startMonday,
                      visibleWeeks[index - 1] * 7,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : ""
                const weekTasks = tasksByWeek[offset] ?? []
                const completion = weekTasks.length
                  ? Math.round(
                      (weekTasks.filter((task) => task.done).length /
                        weekTasks.length) *
                        100,
                    )
                  : null
                const selected = offset === weekOffset
                const isCurrent = offset === offsetForDate(new Date())
                const weekLabel = getWeekLabelForOffset(offset)

                return (
                  <div key={offset}>
                    {month !== previous && (
                      <div className="px-1 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#86a18d] first:pt-0">
                        {month.toUpperCase()}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectWeek(offset)}
                      className={`mb-1 flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                        selected
                          ? "border border-[#88e09f] bg-[#eefbf1] text-[#1a5b33] shadow-sm"
                          : "border border-transparent hover:border-[#e2ede5] hover:bg-[#f6faf7] text-[#334c3a]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                          selected
                            ? "bg-[#34bc67] text-white shadow-sm"
                            : "bg-[#edf4ee] text-[#718e77]"
                        }`}
                      >
                        {selected ? (
                          <Icon name="check" size={15} />
                        ) : (
                          weekLabel.match(/\d+/)?.[0] || "#"
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block text-[12px] font-bold leading-tight">
                            {weekLabel}
                          </span>
                          {isCurrent && (
                            <span className="rounded bg-[#dcfce7] px-1.5 py-0.5 text-[9px] font-bold text-[#1e7841]">
                              Tuần này
                            </span>
                          )}
                        </span>
                        <span
                          className={`mt-0.5 block text-[10px] ${
                            selected ? "text-[#368b55]" : "text-[#879d8e]"
                          }`}
                        >
                          {monthDay(first)} - {monthDay(last)}
                        </span>
                      </span>
                      {completion !== null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            selected
                              ? "bg-white text-[#2a8e4f] shadow-xs"
                              : "bg-[#eaf4ec] text-[#559468]"
                          }`}
                        >
                          {completion}%
                        </span>
                      )}
                    </button>
                  </div>
                )
              })
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
