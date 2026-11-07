import { WEEK_ANCHOR_MONDAY } from "./week"

// Ngày được biểu diễn bằng chuỗi 'YYYY-MM-DD' và tính bằng UTC, nên không bao giờ lệch ngày do múi giờ.
export type Ymd = string

const pad = (n: number): string => String(n).padStart(2, "0")

/** Ngày địa phương của một Date -> 'YYYY-MM-DD' */
export function localYmd(d: Date = new Date()): Ymd {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Mốc của FE: week = 0 là tuần bắt đầu thứ Hai này. Lấy từ utils/week.ts để chỉ có một nguồn duy nhất.
export const BASE_MONDAY: Ymd = localYmd(WEEK_ANCHOR_MONDAY)

const MS_DAY = 86_400_000
export function parseYmd(s: Ymd): number {
  const [y, m, d] = s.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

export function formatYmd(ms: number): Ymd {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(s: Ymd, n: number): Ymd {
  return formatYmd(parseYmd(s) + n * MS_DAY)
}

export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((parseYmd(a) - parseYmd(b)) / MS_DAY)
}

/** 0 = thứ Hai ... 6 = Chủ nhật */
export function weekdayIndex(s: Ymd): number {
  return (new Date(parseYmd(s)).getUTCDay() + 6) % 7
}

/** Năm và số tuần ISO (tuần bắt đầu thứ Hai, tuần 1 chứa ngày thứ Năm đầu tiên của năm). */
export function isoWeek(s: Ymd): { year: number; week: number } {
  const thursday = addDays(s, 3 - weekdayIndex(s))
  const year = new Date(parseYmd(thursday)).getUTCFullYear()
  return { year, week: Math.floor(diffDays(thursday, `${year}-01-01`) / 7) + 1 }
}

/** week (độ lệch so với BASE_MONDAY) -> ngày thứ Hai của tuần đó */
export function weekToMonday(week: number): Ymd {
  return addDays(BASE_MONDAY, week * 7)
}

export function weekToIso(week: number): { year: number; week: number } {
  return isoWeek(weekToMonday(week))
}

export function dayToDate(week: number, day: number): Ymd {
  return addDays(weekToMonday(week), day)
}

/** ngày -> { week (độ lệch), day (0 = thứ Hai) } */
export function dateToWeekDay(s: Ymd): { week: number; day: number } {
  const day = weekdayIndex(s)
  return { week: diffDays(addDays(s, -day), BASE_MONDAY) / 7, day }
}

/** 'YYYY-MM-DD' -> Date ở 00:00 giờ địa phương (dùng để hiển thị) */
export function ymdToLocalDate(s: Ymd): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
