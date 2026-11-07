import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import Icon from "./Icon"
import type { SearchResult } from "../types"
import { getWeekLabelForOffset } from "../utils/week"

export function SearchDropdown({
  query,
  current,
  other,
  completedCurrent,
  completedOther,
  onSelect,
}: {
  query: string
  current: SearchResult[]
  other: SearchResult[]
  completedCurrent: SearchResult[]
  completedOther: SearchResult[]
  onSelect: (result: SearchResult) => void
}) {
  const [showOther, setShowOther] = React.useState(false)
  const [showCompletedCurrent, setShowCompletedCurrent] = React.useState(false)
  const [showCompletedOther, setShowCompletedOther] = React.useState(false)
  const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const renderResult = (result: SearchResult) => (
    <button
      key={`${result.week}-${result.task.id}`}
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#f2faf3]"
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          result.task.done
            ? "bg-[#f1f5f1] text-[#95a397]"
            : "bg-[#e9f8ec] text-[#4eaa68]"
        }`}
      >
        <Icon name={result.task.done ? "check" : "list"} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[11px] font-semibold ${
            result.task.done ? "text-[#849188] line-through" : "text-[#354a3b]"
          }`}
        >
          {result.task.title}
        </span>
        <span className="mt-0.5 block text-[9px] text-[#91a094]">
          {getWeekLabelForOffset(result.week)} · {shortDays[result.day]} ·{" "}
          {result.task.time}
        </span>
      </span>
      {result.task.starred && (
        <Icon
          name="star"
          size={13}
          className="shrink-0 fill-current text-[#f59e0b]"
        />
      )}
    </button>
  )

  return (
    <AnimatePresence>
      {query.trim() && (
        <motion.div
          role="dialog"
          aria-label="Task search results"
          className="absolute right-0 top-full z-50 mt-2 w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#e6eee7] bg-white p-2 shadow-[0_16px_45px_rgba(29,66,43,0.16)]"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
        >
          <div className="px-2.5 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#92a196]">
            Search results for “{query.trim()}”
          </div>
          {!current.length &&
            !other.length &&
            !completedCurrent.length &&
            !completedOther.length && (
              <p className="px-3 py-5 text-center text-[11px] text-[#89978c]">
                No matching tasks found.
              </p>
            )}
          {current.length > 0 && (
            <section className="border-t border-[#eff3ef] py-1.5">
              <h3 className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#56a56c]">
                Tasks in current week · {current.length}
              </h3>
              {current.map(renderResult)}
            </section>
          )}
          {other.length > 0 && (
            <section className="border-t border-[#eff3ef] py-1.5">
              <h3 className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#748a79]">
                Tasks in other weeks · {other.length}
              </h3>
              {(showOther ? other : other.slice(0, 2)).map(renderResult)}
              {other.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowOther((value) => !value)}
                  className="w-full px-2.5 py-2 text-left text-[10px] font-bold text-[#399859] hover:bg-[#f4faf5]"
                >
                  {showOther
                    ? "Show fewer"
                    : `View ${other.length - 2} more tasks`}
                </button>
              )}
            </section>
          )}
          {(completedCurrent.length > 0 || completedOther.length > 0) && (
            <section className="border-t border-[#eff3ef] py-1.5">
              <h3 className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-[#748a79]">
                Completed tasks ·{" "}
                {completedCurrent.length + completedOther.length}
              </h3>
              {completedCurrent.length > 0 && (
                <>
                  <h4 className="px-2.5 py-1 text-[9px] font-semibold text-[#8b9c8f]">
                    This week
                  </h4>
                  {(showCompletedCurrent
                    ? completedCurrent
                    : completedCurrent.slice(0, 2)
                  ).map(renderResult)}
                  {completedCurrent.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowCompletedCurrent((value) => !value)}
                      className="w-full px-2.5 py-2 text-left text-[10px] font-bold text-[#399859] hover:bg-[#f4faf5]"
                    >
                      {showCompletedCurrent
                        ? "Show fewer"
                        : `View ${completedCurrent.length - 2} more`}
                    </button>
                  )}
                </>
              )}
              {completedOther.length > 0 && (
                <>
                  <h4 className="px-2.5 py-1 text-[9px] font-semibold text-[#8b9c8f]">
                    Other weeks
                  </h4>
                  {(showCompletedOther
                    ? completedOther
                    : completedOther.slice(0, 3)
                  ).map(renderResult)}
                  {completedOther.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowCompletedOther((value) => !value)}
                      className="w-full px-2.5 py-2 text-left text-[10px] font-bold text-[#399859] hover:bg-[#f4faf5]"
                    >
                      {showCompletedOther
                        ? "Show fewer"
                        : `View ${completedOther.length - 3} more`}
                    </button>
                  )}
                </>
              )}
            </section>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
