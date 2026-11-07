import React, { useState } from "react"
import Icon from "./Icon"
import type { Task } from "../types"

export function PlannerTaskCard({
  task,
  pending = false,
  isPast = false,
  compact,
  editMode,
  expanded,
  onToggle,
  onToggleStar,
  onDelete,
  onSaveTitle,
  onToggleSteps,
  focusMode,
}: {
  task: Task
  pending?: boolean
  isPast?: boolean
  compact: boolean
  editMode: boolean
  expanded: boolean
  onToggle: () => void
  onToggleStar: () => void
  onDelete: () => void
  onSaveTitle: (title: string) => void
  onToggleSteps: () => void
  focusMode: boolean
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)

  function saveTitle() {
    const nextTitle = draftTitle.trim()
    if (nextTitle) onSaveTitle(nextTitle)
    else setDraftTitle(task.title)
    setEditingTitle(false)
  }

  return (
    <div
      className={`group flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-[11px] border p-3 transition hover:border-[#d3e9d6] hover:shadow-[0_4px_10px_rgba(30,65,43,0.05)] ${
        task.done
          ? "border-emerald-100 bg-emerald-50/60"
          : "border-[#edf0ec] bg-white"
      } ${compact ? "!p-2" : ""} ${
        focusMode && !task.starred ? "pointer-events-none opacity-30" : ""
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <label
            className="mt-0.5 shrink-0"
            title={
              isPast
                ? "Không thể thay đổi trạng thái công việc trong quá khứ"
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={task.done}
              disabled={pending || isPast}
              aria-busy={pending}
              onChange={isPast ? undefined : onToggle}
              aria-label={`Mark ${task.title} ${
                task.done ? "incomplete" : "complete"
              }`}
              className="sr-only peer"
            />
            <span
              className={`flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border text-white transition ${
                isPast
                  ? "cursor-not-allowed border-slate-300 bg-slate-100 peer-checked:border-slate-400 peer-checked:bg-slate-400"
                  : "cursor-pointer border-[#cbdccd] peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80] hover:border-[#4ade80] peer-disabled:cursor-wait peer-disabled:opacity-60"
              } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#339e5e]`}
            >
              {task.done && <Icon name="check" size={11} />}
            </span>
          </label>
          <div className="min-w-0 flex-1 overflow-hidden">
            {editingTitle ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    saveTitle()
                  }
                  if (event.key === "Escape") {
                    setDraftTitle(task.title)
                    setEditingTitle(false)
                  }
                }}
                aria-label={`Edit title for ${task.title}`}
                className="w-full rounded-md border border-[#a9e9ba] bg-[#f8fdf8] px-1.5 py-1 text-[11px] font-semibold leading-[1.45] text-[#344639] outline-none focus:ring-2 focus:ring-[#4ade80]/20"
              />
            ) : editMode ? (
              <button
                type="button"
                onClick={() => {
                  setDraftTitle(task.title)
                  setEditingTitle(true)
                }}
                className={`w-full cursor-text text-left text-[11px] leading-[1.45] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#4ade80] ${
                  task.done
                    ? "font-normal text-slate-400 line-through"
                    : "font-semibold text-[#344639]"
                }`}
              >
                {task.title}
              </button>
            ) : (
              <p
                className={`text-[11px] leading-[1.45] ${
                  task.done
                    ? "font-normal text-slate-400 line-through"
                    : "font-semibold text-[#344639]"
                }`}
              >
                {task.title}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={`${
            task.starred ? "Remove star from" : "Star"
          } ${task.title}`}
          aria-pressed={Boolean(task.starred)}
          title={task.starred ? "Remove star" : "Star task"}
          className={`shrink-0 rounded-lg p-1.5 transition ${
            task.starred
              ? "text-[#f59e0b]"
              : "text-[#c8d1c9] hover:text-[#f59e0b]"
          }`}
        >
          <Icon
            name="star"
            size={15}
            className={task.starred ? "fill-current" : ""}
          />
        </button>
        {editMode && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${task.title}`}
            title={`Delete ${task.title}`}
            className="shrink-0 rounded-lg p-1.5 text-[#dc7770] transition hover:bg-[#fee2e2] hover:text-[#b94743] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#dc7770]"
          >
            <Icon name="trash" size={15} />
          </button>
        )}
      </div>
      {task.description && !compact && (
        <p className="w-full break-words border-t border-[#edf1ed] pt-2 text-[10px] leading-relaxed text-[#738677]">
          {task.description}
        </p>
      )}
      {!compact && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-[#f6f8f5] px-2 text-[10px] font-medium text-[#738677]">
            <Icon name="clock" size={11} />
            {task.time}
          </span>
          {task.categoryName && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-indigo-50 px-2 text-[10px] font-medium text-indigo-700">
              {task.categoryName}
            </span>
          )}
          {task.priority && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-[#f6f8f5] px-2 text-[10px] font-medium capitalize text-[#738677]">
              {task.priority}
            </span>
          )}
          {task.deadlineAt && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-amber-50 px-2 text-[10px] font-medium text-amber-800">
              Deadline {new Date(task.deadlineAt).toLocaleString()}
            </span>
          )}
          {task.estimatedMinutes && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-[#f6f8f5] px-2 text-[10px] font-medium text-[#738677]">
              {task.estimatedMinutes} min
            </span>
          )}
          {task.steps?.length ? (
            <span className="inline-flex h-6 max-w-full shrink items-center justify-center gap-1 overflow-hidden rounded-md bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
              <Icon name="list" size={11} className="shrink-0" />
              <span className="truncate">{task.steps.length} subtasks</span>
            </span>
          ) : null}
          {task.ai && (
            <button
              type="button"
              onClick={onToggleSteps}
              title="View AI-suggested steps"
              aria-label={`View suggested steps for ${task.title}`}
              className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700 hover:bg-[#ddf4e3]"
            >
              <Icon name="sparkle" size={11} /> AI
            </button>
          )}
        </div>
      )}
      {expanded && task.steps && !compact && (
        <ul className="w-full min-w-0 space-y-1.5 border-t border-[#edf1ed] pt-2.5">
          {task.steps.map((step) => (
            <li
              key={step}
              className="flex min-w-0 gap-1.5 break-words text-[10px] leading-snug text-[#738677]"
            >
              <span className="shrink-0 text-[#57b676]">•</span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MobileTaskCard({
  task,
  pending = false,
  isPast = false,
  onToggle,
  onToggleStar,
  onDelete,
  onReschedule,
  focusMode,
}: {
  task: Task
  pending?: boolean
  isPast?: boolean
  onToggle: () => void
  onToggleStar: () => void
  onDelete: () => void
  onReschedule: () => void
  focusMode: boolean
}) {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)

  function finishSwipe() {
    if (offset > 72) {
      if (!task.done && !isPast) onToggle()
      setOffset(0)
    } else if (offset < -58) {
      setOffset(-126)
    } else {
      setOffset(0)
    }
    setTouchStart(null)
  }

  const completeReveal = Math.max(0, offset)
  const actionReveal = Math.max(0, -offset)
  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl"
      data-mobile-task={task.id}
    >
      {!isPast && (
        <div
          className="absolute inset-y-0 left-0 z-20 overflow-hidden bg-emerald-100 text-emerald-700"
          style={{ width: completeReveal }}
        >
          <button
            type="button"
            onClick={() => {
              if (!task.done) onToggle()
              setOffset(0)
            }}
            aria-label={`Mark ${task.title} complete`}
            className="flex h-full w-full items-center gap-3 whitespace-nowrap px-4 text-xs font-medium text-emerald-600"
          >
            <Icon name="check" size={16} />
            Complete
          </button>
        </div>
      )}
      <div
        className="absolute inset-y-0 right-0 z-20 flex overflow-hidden"
        style={{ width: actionReveal }}
      >
        <button
          type="button"
          onClick={onReschedule}
          className="flex h-full w-[68px] shrink-0 flex-col items-center justify-center gap-1 bg-amber-100 text-[9px] font-bold text-[#9a6913]"
        >
          <Icon name="calendar" size={15} />
          Tomorrow
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-full w-[58px] shrink-0 flex-col items-center justify-center gap-1 bg-rose-100 text-[9px] font-bold text-[#be4545]"
        >
          <Icon name="trash" size={15} />
          Delete
        </button>
      </div>
      <article
        onTouchStart={(event) => setTouchStart(event.touches[0].clientX)}
        onTouchMove={(event) => {
          if (touchStart !== null) {
            const delta = event.touches[0].clientX - touchStart
            setOffset(
              isPast
                ? Math.max(-126, Math.min(0, delta))
                : Math.max(-126, Math.min(96, delta)),
            )
          }
        }}
        onTouchEnd={finishSwipe}
        style={{ transform: `translateX(${offset}px)` }}
        className={`relative z-10 rounded-2xl border px-4 py-4 shadow-[0_6px_18px_rgba(31,65,39,0.045)] transition-transform ${
          task.done
            ? "border-emerald-100 bg-emerald-50/60"
            : "border-[#eaf0e8] bg-white"
        } ${
          focusMode && !task.starred ? "pointer-events-none opacity-30" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <label
            className="shrink-0"
            title={
              isPast
                ? "Không thể thay đổi trạng thái công việc trong quá khứ"
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={task.done}
              disabled={pending || isPast}
              aria-busy={pending}
              onChange={isPast ? undefined : onToggle}
              aria-label={`Mark ${task.title} ${
                task.done ? "incomplete" : "complete"
              }`}
              className="peer sr-only"
            />
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-[8px] border-[1.5px] text-white transition ${
                isPast
                  ? "cursor-not-allowed border-slate-300 bg-slate-100 peer-checked:border-slate-400 peer-checked:bg-slate-400"
                  : "cursor-pointer border-[#cbdccf] peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80] peer-disabled:cursor-wait peer-disabled:opacity-60"
              } peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#339e5e]`}
            >
              <Icon
                name="check"
                size={15}
                className={task.done ? "" : "opacity-0"}
              />
            </span>
          </label>
          <div className="z-10 min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`min-w-0 text-[14px] leading-snug ${
                  task.done
                    ? "font-normal text-slate-400 line-through"
                    : "font-semibold text-[#253d2e]"
                }`}
              >
                {task.title}
              </h3>
              <button
                type="button"
                onClick={onToggleStar}
                aria-label={`${
                  task.starred ? "Remove star from" : "Star"
                } ${task.title}`}
                aria-pressed={Boolean(task.starred)}
                title={task.starred ? "Remove star" : "Star task"}
                className={`shrink-0 ${
                  task.starred ? "text-[#f59e0b]" : "text-[#c8d1c9]"
                }`}
              >
                <Icon
                  name="star"
                  size={16}
                  className={task.starred ? "fill-current" : ""}
                />
              </button>
            </div>
            {task.description && (
              <p className="mt-1 break-words text-[10px] leading-relaxed text-[#738677]">
                {task.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex h-6 items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                <Icon name="list" size={12} />
                {task.steps?.length ?? 0} subtasks
              </span>
              <span className="inline-flex h-6 items-center justify-center gap-1 rounded-md bg-[#f8f7f0] px-2 text-[10px] font-medium text-[#9b9277]">
                <Icon name="clock" size={12} />
                {task.time}
              </span>
              {task.categoryName && (
                <span className="inline-flex h-6 items-center rounded-md bg-indigo-50 px-2 text-[10px] font-medium text-indigo-700">
                  {task.categoryName}
                </span>
              )}
              {task.priority && (
                <span className="inline-flex h-6 items-center rounded-md bg-[#f6f8f5] px-2 text-[10px] font-medium capitalize text-[#738677]">
                  {task.priority}
                </span>
              )}
              {task.deadlineAt && (
                <span className="inline-flex h-6 items-center rounded-md bg-amber-50 px-2 text-[10px] font-medium text-amber-800">
                  Deadline {new Date(task.deadlineAt).toLocaleString()}
                </span>
              )}
              {task.estimatedMinutes && (
                <span className="inline-flex h-6 items-center rounded-md bg-[#f6f8f5] px-2 text-[10px] font-medium text-[#738677]">
                  {task.estimatedMinutes} min
                </span>
              )}
              {task.ai && (
                <span className="inline-flex h-6 items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                  <Icon name="sparkle" size={12} />
                  AI
                </span>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
