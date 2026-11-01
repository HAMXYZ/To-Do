import type { Task } from '../types'

const priorityOrder = { high: 0, medium: 1, low: 2 } as const

export function sortTasksByPriorityAndTime(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityDifference =
      (priorityOrder[a.priority ?? 'medium'] ?? 1) -
      (priorityOrder[b.priority ?? 'medium'] ?? 1)
    return priorityDifference || a.time.localeCompare(b.time)
  })
}
