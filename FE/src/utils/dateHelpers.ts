import { WEEK_ANCHOR_MONDAY } from "./week"
import type { Habit } from "../types"

export const startMonday = WEEK_ANCHOR_MONDAY
export const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
export const shortDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function dateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function weekOffsetForDate(date: Date): number {
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return Math.round((monday.getTime() - startMonday.getTime()) / (7 * 86400000))
}

export function habitApplies(habit: Habit, day: number): boolean {
  return (
    habit.frequency === "everyday" ||
    (habit.frequency === "weekdays" ? day < 5 : habit.days.includes(day))
  )
}
