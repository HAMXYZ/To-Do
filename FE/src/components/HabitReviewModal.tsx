import React, { useState, useEffect, useRef } from "react"
import Icon from "./Icon"
import * as api from "../api"
import { CustomYearDropdown } from "./WeekPicker"
import { dayNames, addDays, shortDays } from "../utils/dateHelpers"
import { ymdToLocalDate, localYmd } from "../utils/dates"

const HABIT_COLORS = ["#60A5FA", "#FBBF24", "#F472B6", "#34D399", "#A78BFA"]
const habitColor = (id: number) => HABIT_COLORS[id % HABIT_COLORS.length]

export function HabitReviewModal({
  selectedMonday,
  weekOffset,
  onClose,
}: {
  selectedMonday: Date
  weekOffset: number
  onClose: () => void
}) {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [view, setView] = useState<"year" | "week">("year")
  const [dark, setDark] = useState(false)
  const [heatmap, setHeatmap] = useState<api.Heatmap | null>(null)
  const [weekData, setWeekData] = useState<api.WeekData | null>(null)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let cancelled = false
    api
      .getHeatmap(year)
      .then((result) => {
        if (!cancelled) {
          setHeatmap(result)
          setLoadError("")
        }
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Không tải được dữ liệu",
          )
      })
    return () => {
      cancelled = true
    }
  }, [year])

  useEffect(() => {
    let cancelled = false
    api
      .getWeek(weekOffset, { generate: false })
      .then((result) => {
        if (!cancelled) setWeekData(result)
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Không tải được dữ liệu",
          )
      })
    return () => {
      cancelled = true
    }
  }, [weekOffset])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const firstDay = new Date(year, 0, 1)
  const lastDay = new Date(year, 11, 31)
  const gridStart = addDays(firstDay, -((firstDay.getDay() + 6) % 7))
  const gridEnd = addDays(lastDay, 6 - ((lastDay.getDay() + 6) % 7))
  const gridDays = Array.from(
    {
      length:
        Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1,
    },
    (_, index) => addDays(gridStart, index),
  )
  const weekCount = gridDays.length / 7
  const hm = heatmap && heatmap.year === year ? heatmap : null
  const rows = (hm?.habits ?? []).map((habit) => ({
    ...habit,
    color: habitColor(habit.id),
  }))
  const weekRows = (weekData?.habits ?? []).map((habit) => ({
    ...habit,
    color: habitColor(habit.id),
  }))
  const todayDate = ymdToLocalDate(weekData?.today ?? localYmd())
  const weekStart = selectedMonday
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  )
  // cells: 0 = trống, 1 = bỏ lỡ, 2 = đã làm. level: -1 không theo dõi, 0 chưa làm, 4 đã làm
  const levelFor = (habit: { cells: number[] }, date: Date) => {
    if (date.getFullYear() !== year) return -1
    const cell =
      habit.cells[Math.round((date.getTime() - firstDay.getTime()) / 86400000)]
    return cell === 2 ? 4 : cell === 1 ? 0 : -1
  }
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1)
    return {
      label: date.toLocaleDateString("en-US", { month: "short" }),
      left:
        Math.floor(
          Math.round((date.getTime() - gridStart.getTime()) / 86400000) / 7,
        ) * 12,
    }
  })
  const panel = dark
    ? "border-[#314355] bg-[#111e2d] text-[#f0f7f3]"
    : "border-[#e2e8f0] bg-white text-[#0f172a]"
  const surface = dark
    ? "border-[#293b4b] bg-[#192939]"
    : "border-[#e2e8f0] bg-[#f1f5f9]"
  const statSurface = dark ? surface : "border-[#e2e8f0] bg-white shadow-sm"
  const muted = dark ? "text-[#97abba]" : "text-[#64748b]"
  const empty = dark ? "#1E293B" : "#E2E8F0"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#08170f]/65 p-3 backdrop-blur-[8px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className={`flex max-h-[calc(100dvh-24px)] w-full max-w-[940px] flex-col overflow-hidden rounded-2xl border shadow-[0_28px_90px_rgba(4,18,14,0.35)] sm:max-h-[calc(100dvh-48px)] ${panel}`}
      >
        <div
          className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-8 sm:py-6 ${
            dark ? "border-[#2a3c4d]" : "border-[#e8eeeb]"
          }`}
        >
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#69d99a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> YOUR
              CONSISTENCY, OVER TIME
            </div>
            <h2
              id="review-title"
              className="text-[22px] font-bold tracking-[-0.05em] sm:text-[27px]"
            >
              Habit In-Review{" "}
              <span className={dark ? "text-[#78928b]" : "text-[#abc0af]"}>
                /
              </span>{" "}
              Long-term Progress
            </h2>
            <p className={`mt-1.5 text-[12px] ${muted}`}>
              Every little check-in tells a bigger story.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close habit review"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition ${
              dark
                ? "border-[#334656] text-[#a5bac2] hover:bg-[#2b4051]"
                : "border-[#e4ece7] text-[#72887a] hover:bg-[#eef5ef]"
            }`}
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div
              className={`flex rounded-[10px] border p-1 ${surface}`}
              role="group"
              aria-label="Review view"
            >
              <button
                onClick={() => setView("week")}
                aria-pressed={view === "week"}
                className={`rounded-[7px] px-3 py-2 text-[11px] font-bold transition sm:px-4 ${
                  view === "week"
                    ? dark
                      ? "bg-[#2b4b42] text-[#8aebb1]"
                      : "bg-white text-[#2e9653] shadow-sm"
                    : muted
                }`}
              >
                Weekly View
              </button>
              <button
                onClick={() => setView("year")}
                aria-pressed={view === "year"}
                className={`rounded-[7px] px-3 py-2 text-[11px] font-bold transition sm:px-4 ${
                  view === "year"
                    ? dark
                      ? "bg-[#2b4b42] text-[#8aebb1]"
                      : "bg-white text-[#2e9653] shadow-sm"
                    : muted
                }`}
              >
                Yearly Heatmap View
              </button>
            </div>
            <div className="flex items-center gap-2">
              <CustomYearDropdown
                year={year}
                availableYears={
                  hm?.availableYears ?? heatmap?.availableYears ?? [year]
                }
                onChange={setYear}
                dark={false}
                surface={surface}
              />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}>
              <div className={`text-[10px] font-semibold ${muted}`}>
                DAYS TRACKED
              </div>
              <div className="mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px]">
                {hm ? hm.daysTracked : "–"}
              </div>
            </div>
            <div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}>
              <div className={`text-[10px] font-semibold ${muted}`}>
                YOUR HABITS
              </div>
              <div className="mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px]">
                {hm ? String(hm.habitCount).padStart(2, "0") : "–"}
              </div>
            </div>
            <div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}>
              <div className={`text-[10px] font-semibold ${muted}`}>
                CONSISTENCY
              </div>
              <div
                className={`mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px] ${
                  dark ? "text-[#75dfa0]" : "text-[#0f172a]"
                }`}
              >
                {hm ? hm.consistency : 0}%
              </div>
            </div>
          </div>

          {view === "year" ? (
            <div
              className={`overflow-x-auto rounded-[16px] border p-3 sm:p-4 ${surface}`}
            >
              <div className="min-w-[700px]">
                <div
                  className="relative mb-2 ml-9 h-5"
                  style={{ width: weekCount * 12 - 3 }}
                >
                  {months.map((month) => (
                    <span
                      key={month.label}
                      className={`absolute top-0 text-[10px] font-semibold ${muted}`}
                      style={{ left: month.left }}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
                {rows.length === 0 && (
                  <p className={`py-6 text-center text-[11px] ${muted}`}>
                    {loadError ||
                      (hm ? "No habit history for this year yet." : "Loading…")}
                  </p>
                )}
                {rows.map((habit) => (
                  <div
                    key={habit.id}
                    className={`border-t py-3.5 first:border-t-0 first:pt-1 ${
                      dark ? "border-[#2c3e4c]" : "border-[#e5ebec]"
                    }`}
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                          style={{
                            backgroundColor: `${habit.color}20`,
                            color: habit.color,
                          }}
                        >
                          <Icon name="check" size={16} />
                        </span>
                        <div className="text-[12px] font-bold sm:text-[13px]">
                          {habit.title}{" "}
                          {habit.deleted && (
                            <span className={`font-normal ${muted}`}>
                              · removed
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: habit.color }}
                      >
                        {habit.percent}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex w-7 shrink-0 flex-col justify-between text-[9px] font-semibold ${muted}`}
                        style={{ height: 81 }}
                      >
                        <span>M</span>
                        <span>W</span>
                        <span>F</span>
                        <span>S</span>
                      </div>
                      <div
                        className="grid grid-flow-col grid-rows-7 gap-[3px]"
                        style={{
                          gridTemplateColumns: `repeat(${weekCount}, 9px)`,
                        }}
                      >
                        {gridDays.map((date, dayIndex) => {
                          const level = levelFor(habit, date)
                          return (
                            <span
                              key={dayIndex}
                              title={`${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${
                                level < 0
                                  ? "Not tracked"
                                  : level === 0
                                    ? "Not completed"
                                    : "Completed"
                              }`}
                              className="h-[9px] w-[9px] rounded-[3px]"
                              style={{
                                backgroundColor:
                                  level > 0 ? habit.color : empty,
                                opacity:
                                  level < 0
                                    ? 0.45
                                    : level === 0
                                      ? 1
                                      : 0.38 + level * 0.155,
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className={`mb-3 text-[11px] font-medium ${muted}`}>
                {weekStart.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {addDays(weekStart, 6).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              {weekRows.length === 0 && (
                <p className={`py-6 text-center text-[11px] ${muted}`}>
                  {loadError ||
                    (weekData ? "No active habits yet." : "Loading…")}
                </p>
              )}
              {weekRows.map((habit) => {
                return (
                  <div
                    key={habit.id}
                    className={`rounded-[13px] border p-3.5 sm:p-4 ${surface}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-lg"
                          style={{
                            color: habit.color,
                            backgroundColor: `${habit.color}22`,
                          }}
                        >
                          <Icon name="check" size={16} />
                        </span>
                        <div>
                          <div className="text-[12px] font-bold">
                            {habit.title}
                          </div>
                          <div className={`text-[10px] ${muted}`}>
                            {habit.scheduledCount} days a week
                          </div>
                        </div>
                      </div>
                      <span
                        className="text-[12px] font-bold"
                        style={{ color: habit.color }}
                      >
                        {habit.doneCount}/{habit.scheduledCount} days
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((date, day) => {
                        const level = habit.logs[day]
                          ? 4
                          : habit.scheduled[day] && date <= todayDate
                            ? 0
                            : -1
                        return (
                          <div key={day} className="text-center">
                            <div
                              className="mx-auto flex h-8 w-full max-w-10 items-center justify-center rounded-[8px]"
                              style={{
                                backgroundColor:
                                  level > 0 ? `${habit.color}35` : empty,
                                color: habit.color,
                                opacity: level < 0 ? 0.55 : 1,
                              }}
                            >
                              {level > 0 && <Icon name="check" size={15} />}
                            </div>
                            <div
                              className={`mt-1.5 text-[9px] font-semibold ${muted}`}
                            >
                              {shortDays[day]}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] ${muted}`}
          >
            <span>
              Future days and days before a habit was created are unfilled
            </span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <span
                className="h-[9px] w-[9px] rounded-[3px]"
                style={{ backgroundColor: empty }}
              />
              {[0.45, 0.62, 0.8, 1].map((level) => (
                <span
                  key={level}
                  className="h-[9px] w-[9px] rounded-[3px] bg-[#34D399]"
                  style={{ opacity: level }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
