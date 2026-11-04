import type { BreakdownItem } from '../types'

type Props = {
  initialDay: number
  monday: Date
  onClose: () => void
  onSave: (items: BreakdownItem[]) => Promise<boolean>
}

export default function AIBreakdownModal({ initialDay, monday, onClose }: Props) {
  const date = new Date(monday)
  date.setDate(date.getDate() + initialDay)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10231a]/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-breakdown-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
          {date.toLocaleDateString()}
        </p>
        <h2 id="ai-breakdown-title" className="mt-2 text-lg font-bold text-slate-800">
          AI task breakdown is unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This project does not currently include the AI backend route. You can still create
          tasks with the Add task form.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Close
        </button>
      </section>
    </div>
  )
}
