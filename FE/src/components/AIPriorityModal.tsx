import type { Task } from '../types'

type Props = {
  weekOffset: number
  todayWeek: number
  todayDay: number
  tasks: Task[]
  getTaskDay: (taskId: number) => number
  onClose: () => void
  onConfirmStars: (taskIds: number[]) => Promise<boolean>
}

export default function AIPriorityModal({ tasks, todayDay, onClose }: Props) {
  const openTasks = tasks.filter((task) => !task.done).length

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
        aria-labelledby="ai-priority-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
          Day {todayDay + 1} · {openTasks} open tasks
        </p>
        <h2 id="ai-priority-title" className="mt-2 text-lg font-bold text-slate-800">
          AI priority suggestions are unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You can set priority directly when creating a task. Completing and reopening tasks
          works without AI.
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
