export type Task = { id: number; title: string; time: string; done: boolean; ai?: boolean; steps?: string[]; autoHabitId?: number; starred?: boolean; completedAt?: number }
export type DeletedTask = { task: Task; week: number; day: number; deletedAt: number }
export type BreakdownItem = { id: number; title: string; day: number; time: string }
export type Habit = { id: number; title: string; frequency: 'everyday' | 'weekdays' | 'custom'; days: number[]; time: string; autoTask: boolean; active: boolean }
export type OverdueTask = { task: Task; week: number; day: number; due: Date }
export type SearchResult = { task: Task; week: number; day: number }
