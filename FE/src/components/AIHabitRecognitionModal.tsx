import { useState, useEffect, type FormEvent } from "react"
import * as api from "../api"
import type { Habit } from "../types"
import { InlineTimePicker } from "./InlineAddTask"

type HabitDraft = Omit<Habit, "id">

type Props = {
  onClose: () => void
  onCreate: (habit: HabitDraft) => Promise<boolean>
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function AIHabitRecognitionModal({ onClose, onCreate }: Props) {
  const [text, setText] = useState("")
  const [suggestions, setSuggestions] =
    useState<api.HabitRecognitionSuggestion[]>([])
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quota, setQuota] = useState<api.AiQuotaInfo | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // US-38: Tải thông tin hạn mức AI khi mở modal
  useEffect(() => {
    api
      .getAiQuota()
      .then(setQuota)
      .catch(() => {})
  }, [])

  // US-38: Đếm ngược thời gian chờ khi đạt giới hạn yêu cầu (Rate Limit / Quota)
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return
    const timer = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [retryCountdown])

  async function recognize(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault()
    if (retryCountdown !== null && retryCountdown > 0) return
    setLoading(true)
    setError("")
    setDraft(null)
    try {
      const result = await api.recognizeHabits(text)

      // Cập nhật lại quota sau khi gọi thành công
      api
        .getAiQuota()
        .then(setQuota)
        .catch(() => {})

      // US-37: Kiểm tra cấu trúc kết quả AI (Schema Validation)
      if (!result || !Array.isArray(result.suggestions)) {
        throw new Error(
          "Dữ liệu AI trả về sai định dạng danh sách gợi ý. Kết quả đã bị từ chối.",
        )
      }

      // Xác thực từng trường của HabitSuggestion theo schema
      for (const item of result.suggestions) {
        if (!item.title || typeof item.title !== "string") {
          throw new Error("Gợi ý AI thiếu trường tên thói quen hợp lệ.")
        }
        if (!["daily", "weekdays", "custom"].includes(item.frequency)) {
          throw new Error(
            `Tần suất thói quen "${item.frequency}" không đúng schema.`,
          )
        }
      }

      setSuggestions(result.suggestions)
      setNotice(result.notice)
      if (!result.suggestions.length && !result.notice) {
        setNotice(
          "Không nhận diện được habit lặp lại. Hãy mô tả rõ tần suất và ngày thực hiện.",
        )
      }
    } catch (cause) {
      if (cause instanceof api.ApiError) {
        if (cause.status === 504) {
          setError(
            "⏱️ Quá thời gian chờ phản hồi từ AI (Timeout). Kế hoạch của bạn không bị ảnh hưởng.",
          )
        } else if (cause.status === 429) {
          // US-38 & US-38.EX1: Cảnh báo giới hạn lượt sử dụng AI, giữ nguyên dữ liệu nhập chưa lưu
          const waitTime =
            cause.retryAfter && cause.retryAfter > 0 ? cause.retryAfter : 60
          setRetryCountdown(waitTime)
          if (cause.code === "PROVIDER_QUOTA_EXCEEDED") {
            setError(
              "⚠️ Nhà cung cấp AI (Google AI / OpenAI) đang tạm thời hết hạn mức (Quota / Rate Limit). Vui lòng thử lại sau ít phút.",
            )
          } else {
            setError(
              cause.message ||
                "⚠️ Bạn đã đạt giới hạn 10 yêu cầu AI trong 10 phút (US-38).",
            )
          }
          // Refresh quota view
          api
            .getAiQuota()
            .then(setQuota)
            .catch(() => {})
        } else if (cause.status === 502) {
          setError(
            "❌ Dữ liệu AI trả về sai cấu trúc schema quy định. Kết quả không được ghi vào hệ thống.",
          )
        } else if (cause.status === 503) {
          setError(
            "🔧 Chưa cấu hình API key hoặc dịch vụ AI chưa sẵn sàng. Hãy kiểm tra file BE/.env.",
          )
        } else {
          setError(cause.message)
        }
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không nhận diện được habit. Hãy thử lại.",
        )
      }
    } finally {
      setLoading(false)
    }
  }

  function copyDraftText() {
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  function selectSuggestion(suggestion: api.HabitRecognitionSuggestion) {
    setDraft({
      title: suggestion.title,
      frequency:
        suggestion.frequency === "daily" ? "everyday" : suggestion.frequency,
      days: suggestion.frequency === "custom" ? suggestion.days : [],
      time: suggestion.time ?? "",
      autoTask: false,
      active: true,
    })
    setError("")
  }

  async function addDraft() {
    if (!draft?.title.trim()) {
      setError("Habit name is required.")
      return
    }
    if (draft.frequency === "custom" && !draft.days.length) {
      setError("Choose at least one day for a custom habit.")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (await onCreate({ ...draft, title: draft.title.trim() })) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="recognize-habit-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-emerald-50 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              AI HABIT HELPER
            </p>
            <h2
              id="recognize-habit-title"
              className="mt-1 text-lg font-bold text-slate-800"
            >
              Describe a routine
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              AI suggests a draft. Nothing is saved until you confirm it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {quota && (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  quota.remaining === 0
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : quota.remaining <= 3
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
                title={`Hạn mức AI (US-38): ${quota.remaining}/${quota.limit} lượt khả dụng trong 10 phút`}
              >
                ⚡ AI: {quota.remaining}/{quota.limit} lượt
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <form onSubmit={recognize}>
            <label
              htmlFor="habit-description"
              className="text-xs font-semibold text-slate-700"
            >
              What would you like to do regularly?
            </label>
            <textarea
              id="habit-description"
              required
              minLength={3}
              maxLength={500}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="For example: I want to read for 20 minutes every weekday at 8 PM."
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              This description is sent to the configured AI provider. Avoid
              entering private information.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={
                  loading ||
                  text.trim().length < 3 ||
                  (retryCountdown !== null && retryCountdown > 0)
                }
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Đang nhận diện…"
                  : retryCountdown !== null && retryCountdown > 0
                    ? `Đạt giới hạn lượt (Chờ ${retryCountdown}s)`
                    : "Nhận diện thói quen (AI)"}
              </button>
              {text.trim().length > 0 && (
                <button
                  type="button"
                  onClick={copyDraftText}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  title="Sao chép văn bản mô tả để không bị mất"
                >
                  {copied ? "✓ Đã sao chép" : "📋 Sao chép mô tả"}
                </button>
              )}
            </div>
          </form>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div className="flex-1">
                  <p className="font-bold">
                    Cảnh báo giới hạn lượt sử dụng AI (US-38)
                  </p>
                  <p className="mt-1 leading-relaxed text-rose-700">{error}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    🛡️ <strong>Bảo toàn dữ liệu (EX1):</strong> Văn bản mô tả
                    thói quen của bạn được giữ nguyên vẹn ở khung nhập phía
                    trên, không bị xóa mất.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-rose-200/60">
                <button
                  type="button"
                  disabled={retryCountdown !== null && retryCountdown > 0}
                  onClick={() => void recognize()}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryCountdown !== null && retryCountdown > 0
                    ? `⏳ Thử lại sau ${retryCountdown}s`
                    : "🔄 Thử lại ngay"}
                </button>
                <button
                  type="button"
                  onClick={copyDraftText}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                >
                  {copied ? "✓ Đã sao chép" : "📋 Sao chép nội dung"}
                </button>
              </div>
            </div>
          )}
          {notice && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {notice}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-xs font-bold text-slate-700">
                Review an AI suggestion
              </h3>
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.title}-${index}`}
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  className={`block w-full rounded-xl border p-3 text-left ${
                    draft?.title === suggestion.title
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                    <span>{suggestion.title}</span>
                    <span className="text-[10px] text-emerald-700">
                      {suggestion.confidence}% match
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {suggestion.reason}
                  </span>
                </button>
              ))}
            </div>
          )}

          {draft && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h3 className="text-xs font-bold text-slate-700">
                Edit before adding
              </h3>
              <label className="mt-3 block text-[11px] font-semibold text-slate-600">
                Name
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </label>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Frequency
                  <select
                    value={draft.frequency}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        frequency: event.target.value as Habit["frequency"],
                        days: event.target.value === "custom" ? draft.days : [],
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="everyday">Every day</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="custom">Selected days</option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600">
                  Time (optional)
                  <div className="mt-1">
                    <InlineTimePicker
                      value={draft.time}
                      onChange={(time) => setDraft({ ...draft, time })}
                      variant="field"
                      placeholder="Select time (optional)"
                      className="!h-[38px] !rounded-lg !border-slate-200 !bg-white !px-3 !text-sm"
                    />
                  </div>
                </label>
              </div>
              {draft.frequency === "custom" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {weekdays.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={draft.days.includes(index)}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          days: draft.days.includes(index)
                            ? draft.days.filter((value) => value !== index)
                            : [...draft.days, index],
                        })
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                        draft.days.includes(index)
                          ? "bg-emerald-500 text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
              <label className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.autoTask}
                  onChange={(event) =>
                    setDraft({ ...draft, autoTask: event.target.checked })
                  }
                />
                Generate a daily task for this habit
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void addDraft()}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Confirm and add habit"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
