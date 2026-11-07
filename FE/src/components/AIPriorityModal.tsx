import React, { useEffect, useState } from "react"
import Icon from "./Icon"
import * as api from "../api"
import {
  computeLocalPrioritySuggestions,
  type PrioritySuggestion,
  type Task,
} from "../utils/aiBreakdown"

const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export interface AIPriorityModalProps {
  weekOffset: number
  todayWeek: number
  todayDay: number
  tasks: Task[]
  getTaskDay: (id: number) => number
  onClose: () => void
  onConfirmStars: (taskIds: number[]) => Promise<boolean>
}

export function AIPriorityModal({
  weekOffset,
  todayWeek,
  todayDay,
  tasks,
  getTaskDay,
  onClose,
  onConfirmStars,
}: AIPriorityModalProps) {
  const [suggestions, setSuggestions] = useState<PrioritySuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !applying) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, applying])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const loadFn = (api as any).getPrioritySuggestions
    if (typeof loadFn === "function") {
      loadFn(weekOffset)
        .then((bundle: any) => {
          if (cancelled) return
          setSuggestions(bundle.suggestions || [])
          const preselected = (bundle.suggestions || [])
            .filter(
              (s: PrioritySuggestion) =>
                s.recommendedStar && !s.currentlyStarred,
            )
            .map((s: PrioritySuggestion) => s.taskId)
          setSelectedIds(preselected)
        })
        .catch(() => {
          if (cancelled) return
          const local = computeLocalPrioritySuggestions(
            tasks,
            getTaskDay,
            weekOffset,
            todayWeek,
            todayDay,
          )
          setSuggestions(local.suggestions)
          const preselected = local.suggestions
            .filter((s) => s.recommendedStar && !s.currentlyStarred)
            .map((s) => s.taskId)
          setSelectedIds(preselected)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    } else {
      const local = computeLocalPrioritySuggestions(
        tasks,
        getTaskDay,
        weekOffset,
        todayWeek,
        todayDay,
      )
      setSuggestions(local.suggestions)
      const preselected = local.suggestions
        .filter((s) => s.recommendedStar && !s.currentlyStarred)
        .map((s) => s.taskId)
      setSelectedIds(preselected)
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [weekOffset, tasks, getTaskDay, todayWeek, todayDay])

  function toggleSelection(taskId: number) {
    setError(null)
    setSelectedIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    )
  }

  async function handleConfirm() {
    if (!selectedIds.length) {
      onClose()
      return
    }
    setApplying(true)
    setError(null)
    try {
      const ok = await onConfirmStars(selectedIds)
      if (ok) {
        onClose()
      } else {
        setError("Không thể cập nhật đánh dấu sao ưu tiên. Vui lòng thử lại.")
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể áp dụng gợi ý ưu tiên.",
      )
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !applying) onClose()
      }}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onMouseDown={() => {
          if (!applying) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="priority-modal-title"
        className="relative z-10 my-auto flex max-h-[calc(100dvh-32px)] w-full max-w-[580px] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(9,37,21,0.28)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ecf1eb] px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#fff7e0] text-[#d98b0e]">
              <Icon name="star" size={22} className="fill-current" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#b87e14]">
                FOCUS ON WHAT MATTERS
              </span>
              <h2
                id="priority-modal-title"
                className="text-[20px] font-bold tracking-[-0.04em] text-[#1b3325] sm:text-[22px]"
              >
                AI Gợi ý ưu tiên công việc
              </h2>
              <p className="mt-1 text-[12px] text-[#8b9b8e]">
                Chọn các công việc quan trọng để đánh dấu sao (⭐) và ưu tiên
                thực hiện trước.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={applying}
            onClick={onClose}
            aria-label="Close priority suggestions"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#e9eee9] text-[#77897b] transition hover:bg-[#f4f8f4] disabled:opacity-50"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {loading ? (
            <div className="py-10 text-center text-[12px] font-medium text-[#7e9183]">
              Đang phân tích các công việc chưa hoàn thành trong tuần...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-2xl border border-[#e9f0ea] bg-[#f8fbf8] px-5 py-9 text-center">
              <p className="text-[13px] font-bold text-[#2d4736]">
                Không có công việc chưa hoàn thành trong tuần
              </p>
              <p className="mt-1 text-[11px] text-[#859889]">
                Hãy thêm công việc hoặc phân rã mục tiêu trước để xem gợi ý ưu
                tiên.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-[#4a6352]">
                <span>CÔNG VIỆC CHƯA HOÀN THÀNH ({suggestions.length})</span>
                <span>Đã chọn {selectedIds.length} việc để gắn sao (⭐)</span>
              </div>
              {suggestions.map((item) => {
                const isSelected = selectedIds.includes(item.taskId)
                return (
                  <label
                    key={item.taskId}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                      item.currentlyStarred
                        ? "border-[#e5ece6] bg-[#f9fbf9] opacity-80"
                        : isSelected
                          ? "border-[#f4cf72] bg-[#fffdf7] shadow-[0_3px_10px_rgba(245,158,11,0.08)]"
                          : "border-[#e7efe8] bg-white hover:border-[#cde4d1]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.currentlyStarred || isSelected}
                      disabled={item.currentlyStarred || applying}
                      onChange={() => toggleSelection(item.taskId)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#f59e0b]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-[#243b2c]">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {item.currentlyStarred ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff5d6] px-2 py-0.5 text-[9px] font-bold text-[#a37014]">
                              <Icon
                                name="star"
                                size={10}
                                className="fill-current text-[#f59e0b]"
                              />{" "}
                              Đã gắn sao
                            </span>
                          ) : item.recommendedStar ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f7eb] px-2 py-0.5 text-[9px] font-bold text-[#2b874b]">
                              <Icon name="sparkle" size={10} /> Đề xuất ưu tiên
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-[#6d8273]">
                        {item.reason}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold text-[#899c8e]">
                        <span>{shortDays[item.day]}</span>
                        {item.time && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 text-[#4c8c60]">
                              <Icon name="clock" size={11} /> {item.time}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-[#f5c2bf] bg-[#fff2f1] px-3.5 py-2.5 text-[11px] font-semibold text-[#bf433d]"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#ecf1eb] bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            disabled={applying}
            onClick={onClose}
            className="rounded-[10px] border border-[#e3eae4] bg-white px-4 py-2.5 text-[12px] font-bold text-[#617467] transition hover:bg-[#f5f8f5] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={applying || selectedIds.length === 0}
            onClick={() => void handleConfirm()}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-[#4ade80] px-4 py-2.5 text-[12px] font-bold text-[#174f2e] shadow-[0_5px_12px_rgba(74,222,128,0.2)] transition hover:bg-[#37d973] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="check" size={14} />
            {applying
              ? "Đang lưu..."
              : `Xác nhận gắn sao (${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIPriorityModal
