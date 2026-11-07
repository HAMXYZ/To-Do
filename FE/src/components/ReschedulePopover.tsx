import React, { useState, useEffect, useRef, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import Icon from "./Icon"
import { dayNames, addDays, dateForInput } from "../utils/dateHelpers"

export function ReschedulePopover({
  taskTitle,
  onApply,
}: {
  taskTitle: string
  onApply: (date: Date) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelWidth = 248
  const panelHeight = 365

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = addDays(today, 1)
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const weekDates = dayNames.map((_, index) => addDays(monday, index))
  const nextMonday = addDays(monday, 7)
  const tomorrowValue = dateForInput(tomorrow)

  useLayoutEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - panelWidth - 8),
      )
      const top =
        rect.bottom + panelHeight + 8 <= window.innerHeight
          ? rect.bottom + 8
          : Math.max(8, rect.top - panelHeight - 8)
      setPosition({ left, top })
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      )
        setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function apply() {
    if (!selectedDate) return
    const [year, month, day] = selectedDate.split("-").map(Number)
    onApply(new Date(year, month - 1, day))
    setSelectedDate("")
    setOpen(false)
  }

  function choose(date: Date) {
    setSelectedDate(dateForInput(date))
  }

  function dateLabel(date: Date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Quick reschedule ${taskTitle}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4ade80] ${
            open || selectedDate
              ? "border-[#bce8c7] bg-[#dcfce7] text-[#39784b]"
              : "border-[#f1ddd2] bg-white text-[#715c50] hover:border-[#bce8c7] hover:bg-[#f2fbf3]"
          }`}
        >
          <Icon name="calendar" size={12} />
          <span className="truncate">
            {selectedDate
              ? dateLabel(new Date(`${selectedDate}T12:00:00`))
              : "Quick reschedule"}
          </span>
          <Icon
            name="chevronDown"
            size={11}
            className={`shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!selectedDate}
          aria-label={`Apply reschedule for ${taskTitle}`}
          title="Apply reschedule"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"
        >
          <Icon name="check" size={14} />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Reschedule ${taskTitle}`}
            className="fixed z-[100] w-[248px] rounded-2xl border border-[#e7eee9] bg-white p-3 text-[#243c2d] shadow-[0_16px_48px_rgba(22,52,32,0.2)]"
            style={{ left: position.left, top: position.top }}
          >
            <div className="mb-2 px-1 text-[11px] font-bold text-[#385140]">
              Move task to
            </div>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              <section>
                <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {[today, tomorrow].map((date) => {
                    const value = dateForInput(date)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => choose(date)}
                        aria-pressed={selectedDate === value}
                        className={`rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                          selectedDate === value
                            ? "bg-[#dcfce7] text-[#287342]"
                            : "text-[#617467] hover:bg-[#f2fbf3]"
                        }`}
                      >
                        {dateLabel(date)} ·{" "}
                        {value === dateForInput(today) ? "Today" : "Tomorrow"}
                      </button>
                    )
                  })}
                </div>
              </section>
              <section>
                <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">
                  This Week
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {weekDates.map((date, index) => {
                    const value = dateForInput(date)
                    const disabled = date < today
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(date)}
                        aria-pressed={selectedDate === value}
                        className={`rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                          selectedDate === value
                            ? "bg-[#dcfce7] text-[#287342]"
                            : "text-[#617467] hover:bg-[#f2fbf3]"
                        } disabled:cursor-not-allowed disabled:opacity-35`}
                      >
                        {dayNames[index]} · {dateLabel(date)}
                      </button>
                    )
                  })}
                </div>
              </section>
              <section>
                <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">
                  Next Week
                </h3>
                <button
                  type="button"
                  onClick={() => choose(nextMonday)}
                  aria-pressed={selectedDate === dateForInput(nextMonday)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${
                    selectedDate === dateForInput(nextMonday)
                      ? "bg-[#dcfce7] text-[#287342]"
                      : "text-[#617467] hover:bg-[#f2fbf3]"
                  }`}
                >
                  <Icon name="calendar" size={12} /> Next Monday ·{" "}
                  {dateLabel(nextMonday)}
                </button>
                <label
                  className={`mt-1 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                    selectedDate &&
                    selectedDate !== dateForInput(today) &&
                    selectedDate !== dateForInput(tomorrow) &&
                    !weekDates.some(
                      (date) => dateForInput(date) === selectedDate,
                    ) &&
                    selectedDate !== dateForInput(nextMonday)
                      ? "bg-[#dcfce7] text-[#287342]"
                      : "text-[#617467] hover:bg-[#f2fbf3]"
                  }`}
                >
                  <Icon name="calendar" size={12} />
                  <span>Custom Date...</span>
                  <input
                    type="date"
                    min={tomorrowValue}
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    aria-label={`Custom reschedule date for ${taskTitle}`}
                    className="ml-auto w-[22px] cursor-pointer text-transparent outline-none"
                  />
                </label>
              </section>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#edf1ee] pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("")
                  setOpen(false)
                }}
                className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!selectedDate}
                aria-label={`Confirm reschedule for ${taskTitle}`}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="check" size={14} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
