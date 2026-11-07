import React, { useState, useEffect, useRef } from "react"
import Icon from "./Icon"
import { InlineTimePicker } from "./InlineAddTask"
import type { Habit } from "../types"
import { shortDays } from "../utils/dateHelpers"

const emptyHabit = (): Omit<Habit, "id"> => ({
  title: "",
  frequency: "everyday",
  days: [],
  time: "08:00",
  autoTask: false,
  active: true,
})

function HabitFields({
  value,
  onChange,
}: {
  value: Omit<Habit, "id">
  onChange: (value: Omit<Habit, "id">) => void
}) {
  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-bold text-[#385140]">
        Habit name
        <input
          required
          value={value.title}
          onChange={(event) =>
            onChange({ ...value, title: event.target.value })
          }
          placeholder="Read 10 pages"
          className="mt-1.5 w-full rounded-[10px] border border-[#deebe0] bg-white px-3 py-2.5 text-[12px] font-medium outline-none placeholder:text-[#a3b3a6] focus:border-[#4ade80]"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-bold text-[#385140]">
          Frequency
          <select
            value={value.frequency}
            onChange={(event) =>
              onChange({
                ...value,
                frequency: event.target.value as Habit["frequency"],
              })
            }
            className="mt-1.5 w-full rounded-[10px] border border-[#deebe0] bg-white px-2 py-2.5 text-[11px] outline-none focus:border-[#4ade80]"
          >
            <option value="everyday">Everyday</option>
            <option value="weekdays">Weekdays</option>
            <option value="custom">Custom Days</option>
          </select>
        </label>
        <label className="text-[11px] font-bold text-[#385140]">
          Preferred time
          <div className="mt-1.5">
            <InlineTimePicker
              value={value.time}
              onChange={(time) => onChange({ ...value, time: time || "08:00" })}
              variant="field"
              placeholder="Preferred time"
              className="!h-[41px] !rounded-[10px] !border-[#deebe0] !bg-white !px-3 !text-[11px]"
            />
          </div>
        </label>
      </div>
      {value.frequency === "custom" && (
        <div>
          <p className="mb-2 text-[11px] font-bold text-[#385140]">Repeat on</p>
          <div className="flex flex-wrap gap-1.5">
            {shortDays.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    days: value.days.includes(index)
                      ? value.days.filter((item) => item !== index)
                      : [...value.days, index],
                  })
                }
                aria-pressed={value.days.includes(index)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                  value.days.includes(index)
                    ? "bg-[#4ade80] text-[#1b4c2c]"
                    : "border border-[#deebe0] bg-white text-[#778d7b]"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e5eee6] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#385140]">
        Auto-generate daily task
        <input
          type="checkbox"
          checked={value.autoTask}
          onChange={(event) =>
            onChange({ ...value, autoTask: event.target.checked })
          }
          className="h-4 w-4 accent-[#4ade80]"
        />
      </label>
    </div>
  )
}

export function HabitManagementModal({
  habits,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  onRecognize,
  onClose,
}: {
  habits: Habit[]
  onAdd: (habit: Omit<Habit, "id">) => void
  onUpdate: (habit: Habit) => void
  onRemove: (id: number) => void
  onReorder: (from: number, to: number) => void
  onRecognize: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(emptyHabit)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function valid(habit: Omit<Habit, "id">) {
    if (habit.frequency === "custom" && !habit.days.length) {
      setError("Choose at least one day for a custom routine.")
      return false
    }
    setError("")
    return Boolean(habit.title.trim() && habit.time)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-[8px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-habits-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(9,37,21,0.3)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e9f0ea] px-5 py-5 sm:px-7">
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5db779]">
              BUILD YOUR ROUTINE
            </div>
            <h2
              id="manage-habits-title"
              className="text-[21px] font-bold tracking-[-0.04em] text-[#1e3828]"
            >
              Habit Settings & Management
            </h2>
            <p className="mt-1 text-[12px] text-[#8a9d8f]">
              Create, edit, or toggle habit routines.
            </p>
            <button
              type="button"
              onClick={onRecognize}
              className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
            >
              Recognize from a description with AI
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close habit management"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5ece6] text-[#829585] hover:bg-[#f2f9f3]"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (valid(draft)) {
                onAdd({ ...draft, title: draft.title.trim() })
                setDraft(emptyHabit())
              }
            }}
            className="rounded-2xl border border-[#dcefe1] bg-[#f6fcf7] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#329a55]">
                <Icon name="plus" size={16} />
              </span>
              <h3 className="text-[13px] font-bold text-[#2c4935]">
                Create a new habit
              </h3>
            </div>
            <HabitFields value={draft} onChange={setDraft} />
            {error && (
              <p role="alert" className="mt-2 text-[11px] text-[#c95754]">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="mt-4 flex items-center gap-1.5 rounded-[10px] bg-[#4ade80] px-4 py-2.5 text-[11px] font-bold text-[#174b2b] hover:bg-[#36d871]"
            >
              <Icon name="plus" size={15} /> Add to Tracker
            </button>
          </form>
          <div className="mb-3 mt-6 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#2c4935]">
              Your habits
            </h3>
            <span className="rounded-full bg-[#edf8ef] px-2.5 py-1 text-[10px] font-bold text-[#519b63]">
              {habits.length} ROUTINES
            </span>
          </div>
          <div className="space-y-2">
            {habits.map((habit, index) => (
              <div
                key={habit.id}
                draggable
                onDragStart={(event) =>
                  event.dataTransfer.setData(
                    "application/x-focusflow-habit",
                    String(index),
                  )
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const from = Number(
                    event.dataTransfer.getData("application/x-focusflow-habit"),
                  )
                  if (
                    Number.isInteger(from) &&
                    from >= 0 &&
                    from < habits.length
                  )
                    onReorder(from, index)
                }}
                className="rounded-xl border border-[#e6eee7] bg-white p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    title="Drag to reorder"
                    className="cursor-grab text-[#a6b7aa]"
                  >
                    <Icon name="grip" size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[12px] font-semibold ${
                        habit.active ? "text-[#2c4434]" : "text-[#9ba89e]"
                      }`}
                    >
                      {habit.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#92a394]">
                      {habit.frequency === "everyday"
                        ? "Everyday"
                        : habit.frequency === "weekdays"
                          ? "Weekdays"
                          : habit.days
                              .map((day) => shortDays[day])
                              .join(", ")}{" "}
                      · {habit.time}
                      {habit.autoTask ? " · Daily task on" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate({ ...habit, active: !habit.active })
                    }
                    role="switch"
                    aria-checked={habit.active}
                    aria-label={`${
                      habit.active ? "Pause" : "Activate"
                    } ${habit.title}`}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                      habit.active ? "bg-[#4ade80]" : "bg-[#dbe4dd]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                        habit.active ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(habit)
                      setError("")
                    }}
                    aria-label={`Edit ${habit.title}`}
                    className="rounded-lg p-1.5 text-[#7fa489] hover:bg-[#edf9ef]"
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(habit.id)
                      if (editing?.id === habit.id) setEditing(null)
                    }}
                    aria-label={`Delete ${habit.title}`}
                    className="rounded-lg p-1.5 text-[#dc7770] hover:bg-[#fff0ef]"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                {editing?.id === habit.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (valid(editing)) {
                        onUpdate({ ...editing, title: editing.title.trim() })
                        setEditing(null)
                      }
                    }}
                    className="mt-3 border-t border-[#e9f0ea] pt-3"
                  >
                    <HabitFields
                      value={editing}
                      onChange={(value) => setEditing({ ...editing, ...value })}
                    />
                    {error && (
                      <p
                        role="alert"
                        className="mt-2 text-[11px] text-[#c95754]"
                      >
                        {error}
                      </p>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="px-2 py-2 text-[11px] font-semibold text-[#829585]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-[#4ade80] px-3 py-2 text-[11px] font-bold text-[#174b2b]"
                      >
                        Save changes
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
            {!habits.length && (
              <p className="rounded-xl border border-dashed border-[#dcebdd] p-5 text-center text-[12px] text-[#859a8a]">
                No habits yet. Add one above to begin.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
