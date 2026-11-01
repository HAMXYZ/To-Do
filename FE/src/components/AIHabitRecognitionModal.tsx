import { useState, type FormEvent } from 'react'
import * as api from '../api'
import type { Habit } from '../types'

type HabitDraft = Omit<Habit, 'id'>

type Props = {
  onClose: () => void
  onCreate: (habit: HabitDraft) => Promise<boolean>
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AIHabitRecognitionModal({ onClose, onCreate }: Props) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<api.HabitRecognitionSuggestion[]>([])
  const [draft, setDraft] = useState<HabitDraft | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function recognize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setDraft(null)
    try {
      const result = await api.recognizeHabits(text)
      setSuggestions(result.suggestions)
      setNotice(result.notice)
      if (!result.suggestions.length && !result.notice) {
        setNotice('Không nhận diện được habit lặp lại. Hãy mô tả rõ tần suất và ngày thực hiện.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không nhận diện được habit. Hãy thử lại.')
    } finally {
      setLoading(false)
    }
  }

  function selectSuggestion(suggestion: api.HabitRecognitionSuggestion) {
    setDraft({
      title: suggestion.title,
      frequency: suggestion.frequency === 'daily' ? 'everyday' : suggestion.frequency,
      days: suggestion.frequency === 'custom' ? suggestion.days : [],
      time: suggestion.time ?? '',
      autoTask: false,
      active: true,
    })
    setError('')
  }

  async function addDraft() {
    if (!draft?.title.trim()) {
      setError('Habit name is required.')
      return
    }
    if (draft.frequency === 'custom' && !draft.days.length) {
      setError('Choose at least one day for a custom habit.')
      return
    }
    setSaving(true)
    setError('')
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">AI HABIT HELPER</p>
            <h2 id="recognize-habit-title" className="mt-1 text-lg font-bold text-slate-800">Describe a routine</h2>
            <p className="mt-1 text-xs text-slate-500">AI suggests a draft. Nothing is saved until you confirm it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">Close</button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <form onSubmit={recognize}>
            <label htmlFor="habit-description" className="text-xs font-semibold text-slate-700">What would you like to do regularly?</label>
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
            <p className="mt-1 text-[10px] text-slate-400">This description is sent to the configured AI provider. Avoid entering private information.</p>
            <button type="submit" disabled={loading || text.trim().length < 3} className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? 'Recognizing…' : 'Recognize habits'}
            </button>
          </form>

          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{notice}</p>}

          {suggestions.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-xs font-bold text-slate-700">Review an AI suggestion</h3>
              {suggestions.map((suggestion, index) => (
                <button key={`${suggestion.title}-${index}`} type="button" onClick={() => selectSuggestion(suggestion)} className={`block w-full rounded-xl border p-3 text-left ${draft?.title === suggestion.title ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}>
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800"><span>{suggestion.title}</span><span className="text-[10px] text-emerald-700">{suggestion.confidence}% match</span></span>
                  <span className="mt-1 block text-xs text-slate-500">{suggestion.reason}</span>
                </button>
              ))}
            </div>
          )}

          {draft && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h3 className="text-xs font-bold text-slate-700">Edit before adding</h3>
              <label className="mt-3 block text-[11px] font-semibold text-slate-600">Name
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={100} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </label>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-slate-600">Frequency
                  <select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as Habit['frequency'], days: event.target.value === 'custom' ? draft.days : [] })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="everyday">Every day</option><option value="weekdays">Weekdays</option><option value="custom">Selected days</option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-600">Time (optional)
                  <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
                </label>
              </div>
              {draft.frequency === 'custom' && <div className="mt-3 flex flex-wrap gap-1.5">{weekdays.map((day, index) => <button key={day} type="button" aria-pressed={draft.days.includes(index)} onClick={() => setDraft({ ...draft, days: draft.days.includes(index) ? draft.days.filter((value) => value !== index) : [...draft.days, index] })} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${draft.days.includes(index) ? 'bg-emerald-500 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{day}</button>)}</div>}
              <label className="mt-3 flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={draft.autoTask} onChange={(event) => setDraft({ ...draft, autoTask: event.target.checked })} />Generate a daily task for this habit</label>
              <button type="button" disabled={saving} onClick={() => void addDraft()} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving…' : 'Confirm and add habit'}</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
