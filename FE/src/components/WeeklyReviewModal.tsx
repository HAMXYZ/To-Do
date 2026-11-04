import { useEffect, useState } from 'react'
import * as api from '../api'
import { weekToIso } from '../utils/dates'

type Props = { week: number; onClose: () => void }

export default function WeeklyReviewModal({ week, onClose }: Props) {
  const [summary, setSummary] = useState('')
  const [stats, setStats] = useState<api.WeeklyReviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const iso = weekToIso(week)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.getWeeklyReview(week)
      .then((result) => {
        if (!active) return
        setStats(result.stats)
        setSummary(result.review?.summaryText ?? '')
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load this review.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [week])

  async function generate() {
    setGenerating(true)
    setError('')
    setNotice('')
    try {
      const result = await api.generateWeeklyReview(week)
      setSummary(result.summaryText)
      setStats(result.stats)
      setNotice(`Draft created by ${result.provider}. Review and edit it before saving.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate a review. You can still write one manually.')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.saveWeeklyReview(week, summary)
      setNotice('Weekly review saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the review. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="weekly-review-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-emerald-50 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">WEEK {iso.week} · {iso.year}</p><h2 id="weekly-review-title" className="mt-1 text-lg font-bold text-slate-800">Weekly review</h2><p className="mt-1 text-xs text-slate-500">Generate an editable draft from this week’s task and habit progress.</p></div>
          <button type="button" onClick={onClose} aria-label="Close weekly review" className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">Close</button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading weekly progress…</p> : stats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Tasks done" value={`${stats.taskDone}/${stats.taskTotal}`} detail={`${stats.taskCompletionRate}%`} />
              <Stat label="Habits" value={`${stats.habitTotal}`} detail="active this week" />
              <Stat label="Habit days" value={`${stats.habitCompletedDays}/${stats.habitScheduledDays}`} detail={`${stats.habitCompletionRate}%`} />
              <Stat label="Week" value={`W${iso.week}`} detail={String(iso.year)} />
            </div>
          )}
          {stats?.habits.length ? <div className="mt-4 flex flex-wrap gap-2">{stats.habits.map((habit) => <span key={habit.title} className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] text-emerald-800">{habit.title}: {habit.doneCount}/{habit.scheduledCount}</span>)}</div> : null}
          <label htmlFor="weekly-review-text" className="mt-5 block text-xs font-semibold text-slate-700">Review draft
            <textarea id="weekly-review-text" maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Write or generate a review of your week…" className="mt-2 min-h-40 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <p className="mt-1 text-[10px] text-slate-400">When generating, the AI receives task titles and completion states plus habit names and completion counts for this week. It does not receive your email or password.</p>
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={generating || loading} onClick={() => void generate()} className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{generating ? 'Generating…' : 'Generate with AI'}</button>
            <button type="button" disabled={saving || loading || !summary.trim()} onClick={() => void save()} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save review'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className="mt-1 text-base font-bold text-slate-800">{value}</p><p className="text-[10px] text-emerald-700">{detail}</p></div>
}
