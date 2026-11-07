import { useEffect, useState } from "react"
import * as api from "../api"
import { weekToIso } from "../utils/dates"

type Props = { week: number; onClose: () => void }

export default function WeeklyReviewModal({ week, onClose }: Props) {
  const [summary, setSummary] = useState("")
  const [stats, setStats] = useState<api.WeeklyReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [isTimeout, setIsTimeout] = useState(false)
  const [notice, setNotice] = useState("")
  const [quota, setQuota] = useState<api.AiQuotaInfo | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const iso = weekToIso(week)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    api
      .getWeeklyReview(week)
      .then((result) => {
        if (!active) return
        setStats(result.stats)
        setSummary(result.review?.summaryText ?? "")
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load this review.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    // US-38: Tải hạn mức AI khi mở modal
    api
      .getAiQuota()
      .then((q) => {
        if (active) setQuota(q)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [week])

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

  // US-36 & US-37 & US-38: Xử lý Loading, Timeout, Retry, Schema Validation và Rate Limit
  async function generate() {
    if (retryCountdown !== null && retryCountdown > 0) return
    setGenerating(true)
    setError("")
    setIsTimeout(false)
    setNotice("")
    try {
      const result = await api.generateWeeklyReview(week)

      // Cập nhật lại quota sau khi gọi thành công
      api
        .getAiQuota()
        .then(setQuota)
        .catch(() => {})

      // US-37: Xác thực schema cấu trúc dữ liệu AI trước khi sử dụng
      if (
        !result ||
        typeof result.summaryText !== "string" ||
        result.summaryText.trim().length < 20
      ) {
        throw new Error(
          "Dữ liệu AI trả về không đúng cấu trúc schema yêu cầu. Kết quả đã bị từ chối.",
        )
      }

      setSummary(result.summaryText.trim())
      setStats(result.stats)
      setNotice(
        `Bản thảo đã được tạo bởi ${result.provider}. Bạn có thể chỉnh sửa trước khi lưu.`,
      )
    } catch (cause) {
      if (cause instanceof api.ApiError) {
        if (cause.status === 504) {
          setIsTimeout(true)
          setError(
            "⏱️ Quá thời gian chờ phản hồi từ AI (Timeout). Kế hoạch của bạn không bị ảnh hưởng.",
          )
        } else if (cause.status === 429) {
          // US-38 & US-38.EX1: Cảnh báo giới hạn lượt sử dụng AI, giữ nguyên dữ liệu nháp chưa lưu
          const waitTime =
            cause.retryAfter && cause.retryAfter > 0 ? cause.retryAfter : 60
          setRetryCountdown(waitTime)
          if (cause.code === "PROVIDER_QUOTA_EXCEEDED") {
            setError(
              "⚠️ Nhà cung cấp AI (Google AI / OpenAI) đang tạm thời hết hạn mức (Quota / Rate Limit). Vui lòng thử lại sau.",
            )
          } else {
            setError(
              cause.message ||
                "⚠️ Bạn đã đạt giới hạn yêu cầu AI (Rate Limit 10 yêu cầu/10 phút).",
            )
          }
          api
            .getAiQuota()
            .then(setQuota)
            .catch(() => {})
        } else if (cause.status === 502) {
          setError(
            "❌ Dữ liệu AI trả về sai cấu trúc (Schema Error) hoặc nhà cung cấp gián đoạn. Kết quả không được ghi.",
          )
        } else if (cause.status === 503) {
          setError(
            "🔧 Chưa cấu hình API key hoặc nhà cung cấp AI từ chối kết nối. Hãy kiểm tra BE/.env.",
          )
        } else {
          setError(cause.message)
        }
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể tạo bản đánh giá tuần. Bạn vẫn có thể tự viết thủ công.",
        )
      }
    } finally {
      setGenerating(false)
    }
  }

  function copyDraft() {
    if (!summary) return
    navigator.clipboard
      .writeText(summary)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  async function save() {
    setSaving(true)
    setError("")
    setNotice("")
    try {
      await api.saveWeeklyReview(week, summary)
      setNotice("Đã lưu bản đánh giá tuần thành công.")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể lưu bản đánh giá. Vui lòng thử lại.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-review-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-emerald-50 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              TUẦN {iso.week} · {iso.year}
            </p>
            <h2
              id="weekly-review-title"
              className="mt-1 text-lg font-bold text-slate-800"
            >
              Báo cáo hiệu suất tuần (AI)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Tạo bản thảo tự động từ tiến độ công việc và thói quen trong tuần.
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
              aria-label="Close weekly review"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Đang tải dữ liệu tiến độ tuần…
            </p>
          ) : (
            stats && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Việc đã xong"
                  value={`${stats.taskDone}/${stats.taskTotal}`}
                  detail={`${stats.taskCompletionRate}%`}
                />
                <Stat
                  label="Thói quen"
                  value={`${stats.habitTotal}`}
                  detail="đang hoạt động"
                />
                <Stat
                  label="Ngày thói quen"
                  value={`${stats.habitCompletedDays}/${stats.habitScheduledDays}`}
                  detail={`${stats.habitCompletionRate}%`}
                />
                <Stat
                  label="Mốc tuần"
                  value={`Tuần ${iso.week}`}
                  detail={String(iso.year)}
                />
              </div>
            )
          )}
          {stats?.habits.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {stats.habits.map((habit) => (
                <span
                  key={habit.title}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] text-emerald-800"
                >
                  {habit.title}: {habit.doneCount}/{habit.scheduledCount}
                </span>
              ))}
            </div>
          ) : null}

          {/* US-36: Loading state khi AI đang xử lý */}
          {generating && (
            <div className="my-5 flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p className="text-xs font-semibold text-emerald-800 animate-pulse">
                AI đang tổng hợp và phân tích hiệu suất tuần...
              </p>
            </div>
          )}

          <label
            htmlFor="weekly-review-text"
            className="mt-5 block text-xs font-semibold text-slate-700"
          >
            Nội dung báo cáo đánh giá tuần
            <textarea
              id="weekly-review-text"
              maxLength={4000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Tự viết hoặc bấm nút Tạo báo cáo với AI bên dưới…"
              className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <p className="mt-1 text-[10px] text-slate-400">
            AI chỉ nhận tiêu đề công việc và số lần hoàn thành thói quen để đánh
            giá. Không gửi thông tin nhạy cảm.
          </p>

          {/* US-36 & US-38: Hiển thị lỗi, Timeout, Quota Warning và nút Thử lại (Retry) */}
          {error && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">⚠️</span>
                <div className="flex-1">
                  <p className="font-bold">Cảnh báo yêu cầu AI (US-38)</p>
                  <p className="mt-1 leading-relaxed text-rose-700">{error}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    🛡️ <strong>Bảo toàn dữ liệu (EX1):</strong> Toàn bộ nội dung
                    báo cáo bạn đang viết được bảo toàn nguyên vẹn. Bạn vẫn có
                    thể tiếp tục chỉnh sửa và bấm <strong>"Lưu báo cáo"</strong>{" "}
                    thủ công độc lập với AI.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 pt-2 border-t border-rose-200/60">
                <button
                  type="button"
                  disabled={retryCountdown !== null && retryCountdown > 0}
                  onClick={() => void generate()}
                  className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryCountdown !== null && retryCountdown > 0
                    ? `⏳ Thử lại sau ${retryCountdown}s`
                    : isTimeout
                      ? "🔄 Thử lại kết nối AI"
                      : "🔄 Thử lại ngay"}
                </button>
                {summary.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    {copied ? "✓ Đã sao chép" : "📋 Sao chép bản nháp"}
                  </button>
                )}
              </div>
            </div>
          )}

          {notice && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"
            >
              {notice}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={
                generating ||
                loading ||
                (retryCountdown !== null && retryCountdown > 0)
              }
              onClick={() => void generate()}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating
                ? "Đang tổng hợp…"
                : retryCountdown !== null && retryCountdown > 0
                  ? `Đạt giới hạn AI (Chờ ${retryCountdown}s)`
                  : "✨ Tạo báo cáo với AI"}
            </button>
            <button
              type="button"
              disabled={saving || loading || !summary.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Lưu báo cáo"}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-emerald-700">{detail}</p>
    </div>
  )
}
