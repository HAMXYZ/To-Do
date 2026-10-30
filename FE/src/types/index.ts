export type Task = { id: number; title: string; time: string; done: boolean; category: 'work' | 'personal' | 'wellness'; ai?: boolean; steps?: string[]; autoHabitId?: number; starred?: boolean; completedAt?: number; reminderTime?: string; }
export type DeletedTask = { task: Task; week: number; day: number; deletedAt: number }
export type BreakdownItem = { id: number; title: string; day: number; time: string }
export type Habit = { id: number; title: string; frequency: 'everyday' | 'weekdays' | 'custom'; days: number[]; time: string; autoTask: boolean; active: boolean }
export type OverdueTask = { task: Task; week: number; day: number; due: Date }
export type SearchResult = { task: Task; week: number; day: number }


export type WeeklyReport = {
  id: number;
  weekRange: string;
  totalCompleted: number;
  totalOverdue: number;
  summary: string;
  suggestions: string[];
};
export type AIResponseState<T> = {
  isLoading: boolean;
  error: string | null;
  isTimeout: boolean;
  data: T | null;
};