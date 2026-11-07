export interface User {
  id: number
  email: string
  name?: string
  is_active: boolean
}

export interface Task {
  id: number
  userId: number
  title: string
  description?: string
  time: string
  deadlineAt?: string
  estimatedMinutes?: number
  priority?: "high" | "medium" | "low"
  categoryId?: number
  done: boolean
  ai: boolean
  starred: boolean
}
