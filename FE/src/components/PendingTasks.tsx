import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import Icon from "./Icon"
import { ReschedulePopover } from "./ReschedulePopover"
import type { OverdueTask } from "../types"
import { shortDays } from "../utils/dateHelpers"

export function PendingTasks({
  items,
  onCarry,
  onMove,
  onDismiss,
}: {
  items: OverdueTask[]
  onCarry: () => void
  onMove: (week: number, id: number, date: Date) => void
  onDismiss: (week: number, id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl border border-[#f4e6d7] bg-white shadow-[0_5px_18px_rgba(60,45,25,0.04)]"
      aria-labelledby="pending-title"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="pending-list"
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0e4] text-[#d28c4d]">
            <Icon name="clock" size={19} />
          </span>
          <span className="min-w-0">
            <span
              id="pending-title"
              className="block text-[14px] font-bold text-[#283d2d]"
            >
              Pending & Overdue Tasks{" "}
              <span className="ml-1 inline-block rounded-full bg-[#fff0e9] px-2 py-1 text-[10px] font-bold text-[#dc6651]">
                {items.length} Overdue
              </span>
            </span>
            <span className="mt-1 block text-[11px] text-[#8b9a8e]">
              Unfinished work from earlier days, all in one place.
            </span>
          </span>
          <Icon
            name="chevronDown"
            size={16}
            className={`shrink-0 text-[#a0ad9f] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          type="button"
          disabled={!items.length}
          onClick={onCarry}
          aria-label="Auto carry-over overdue tasks"
          className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#4ade80] px-3.5 py-2.5 text-[11px] font-bold text-[#19482b] transition hover:bg-[#36d871] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="refresh" size={15} />{" "}
          {expanded ? "Auto Carry-Over to Today" : "Auto Carry-Over"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="pending-list"
            key="pending-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-[#f5ece4] px-5 pb-5 pt-4 sm:px-6"
          >
            {items.length ? (
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {items.map(({ task, week, day, due }) => (
                  <div
                    key={`${week}-${task.id}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-focusflow-task",
                        JSON.stringify({ week, id: task.id }),
                      )
                    }
                    className="flex items-start gap-2 rounded-xl border border-[#fee2e2] bg-[#fff8f5] p-3.5"
                  >
                    <span
                      title="Drag onto a day column"
                      className="mt-1 cursor-grab text-[#d3a29a]"
                    >
                      <Icon name="grip" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="rounded-md bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-bold text-[#c95754]">
                          Due:{" "}
                          {due.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-[10px] text-[#a18e86]">
                          {shortDays[day]} · {task.time}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-[#423830]">
                        {task.title}
                      </p>
                      <ReschedulePopover
                        taskTitle={task.title}
                        onApply={(date) => onMove(week, task.id, date)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onDismiss(week, task.id)}
                      aria-label={`Dismiss ${task.title}`}
                      title="Delete task"
                      className="rounded-lg p-1.5 text-[#c58d88] hover:bg-[#fee2e2] hover:text-[#b94743]"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-[#f6faf6] px-4 py-5 text-center text-[12px] text-[#7c927f]">
                All caught up. No overdue tasks waiting.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function MobilePendingBanner({
  items,
  onCarry,
}: {
  items: OverdueTask[]
  onCarry: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      aria-labelledby="mobile-pending-title"
      className="mb-6 overflow-hidden rounded-2xl border border-[#f4e6d7] bg-white shadow-[0_6px_18px_rgba(31,65,39,0.04)]"
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="mobile-pending-list"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0e4] text-[#d28c4d]">
            <Icon name="clock" size={17} />
          </span>
          <span
            id="mobile-pending-title"
            className="min-w-0 truncate text-[9px] font-bold text-[#304336]"
          >
            Pending & Overdue Tasks
          </span>
          <span className="shrink-0 rounded-full bg-[#fff0e9] px-1.5 py-1 text-[8px] font-bold text-[#dc6651]">
            {items.length} Overdue
          </span>
          <Icon
            name="chevronDown"
            size={12}
            className={`shrink-0 text-[#96a397] transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </button>
        <button
          type="button"
          disabled={!items.length}
          onClick={onCarry}
          aria-label="Auto carry-over overdue tasks"
          className="flex h-8 shrink-0 items-center gap-0.5 rounded-[10px] bg-[#4ade80] px-1.5 text-[8px] font-bold text-[#19482b] disabled:opacity-50"
        >
          <Icon name="refresh" size={11} />{" "}
          {expanded ? "Auto Carry-Over to Today" : "Auto Carry-Over"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="mobile-pending-list"
            key="mobile-pending-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-[#f5ece4] p-3"
          >
            {items.length ? (
              items.map(({ task, due }) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#fff8f5] px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-[#423830]">
                      {task.title}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-[#b46c5d]">
                      Due{" "}
                      {due.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9px] font-semibold text-[#8d7a70]">
                    {task.time}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-3 text-center text-[11px] text-[#7c927f]">
                All caught up.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
