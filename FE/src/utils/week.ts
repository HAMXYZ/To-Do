export const WEEK_ANCHOR_MONDAY = new Date(2026, 8, 28)

function getIsoWeekInfo(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)

  const year = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const lastWeekDate = new Date(Date.UTC(year, 11, 28))
  const lastWeekDay = lastWeekDate.getUTCDay() || 7
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() + 4 - lastWeekDay)
  const lastWeekYearStart = new Date(Date.UTC(lastWeekDate.getUTCFullYear(), 0, 1))
  const weeksInYear = Math.ceil(((lastWeekDate.getTime() - lastWeekYearStart.getTime()) / 86400000 + 1) / 7)

  return { week, weeksInYear }
}

export function getWeekLabelForOffset(offset: number) {
  const monday = new Date(WEEK_ANCHOR_MONDAY)
  monday.setDate(monday.getDate() + offset * 7)
  const { week, weeksInYear } = getIsoWeekInfo(monday)
  return `Week ${String(week).padStart(2, '0')}/${weeksInYear}`
}
