import React, { useEffect } from "react"
import { motion } from "framer-motion"
import Icon from "./Icon"
import type { DeletedTask } from "../types"
import { getWeekLabelForOffset } from "../utils/week"

export function TrashBinModal({
  items,
  onClose,
  onRestore,
  onDelete,
}: {
  items: DeletedTask[]
  onClose: () => void
  onRestore: (item: DeletedTask) => void
  onDelete: (item: DeletedTask) => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trash-title"
        className="flex max-h-[min(680px,calc(100dvh-32px))] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[#e8eee9] bg-white shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        <header className="flex items-start justify-between border-b border-[#edf1ee] px-5 py-4">
          <div>
            <h2
              id="trash-title"
              className="text-[17px] font-bold text-[#24392b]"
            >
              Trash bin
            </h2>
            <p className="mt-1 text-[11px] text-[#829186]">
              Deleted tasks are permanently removed after 30 days.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trash bin"
            className="rounded-lg p-2 text-[#819084] hover:bg-[#f2f6f2]"
          >
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="space-y-2 overflow-y-auto p-4">
          {items.length ? (
            items.map((item) => (
              <article
                key={`${item.week}-${item.task.id}`}
                className="flex items-center gap-3 rounded-xl border border-[#edf1ee] bg-[#fbfcfb] p-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0ef] text-[#d2756d]">
                  <Icon name="trash" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-[#35483a]">
                    {item.task.title}
                  </p>
                  <p className="mt-1 text-[10px] text-[#96a197]">
                    {getWeekLabelForOffset(item.week)} ·{" "}
                    {
                      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                        item.day
                      ]
                    }{" "}
                    · {item.task.time} · Deleted{" "}
                    {Math.max(
                      0,
                      Math.floor((Date.now() - item.deletedAt) / 86400000),
                    )}
                    d ago
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  className="rounded-lg bg-[#e7f8eb] px-2.5 py-2 text-[10px] font-bold text-[#32834d] hover:bg-[#d8f3df]"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  aria-label={`Permanently delete ${item.task.title}`}
                  className="rounded-lg p-2 text-[#ca716b] hover:bg-[#fff0ef]"
                >
                  <Icon name="trash" size={15} />
                </button>
              </article>
            ))
          ) : (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f3f6f3] text-[#91a095]">
                <Icon name="inbox" size={20} />
              </span>
              <p className="mt-3 text-[12px] font-semibold text-[#56675a]">
                Your trash is empty
              </p>
              <p className="mt-1 text-[10px] text-[#98a49a]">
                Deleted tasks will show up here.
              </p>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}
