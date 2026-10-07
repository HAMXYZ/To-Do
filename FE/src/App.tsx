import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'

import Icon, { IconName } from './components/Icon'
import { QuickAddTask, InlineTimePicker as InlineTimePickerExternal } from './components/InlineAddTask'
import { PlannerTaskCard, MobileTaskCard as MobileTaskCardExternal } from './components/TaskCard'
import { SearchDropdown } from './components/SearchDropdown'
import { TrashBinModal as TrashBinModalExternal } from './components/TrashBinModal'
import type { Task, DeletedTask, BreakdownItem, Habit, OverdueTask, SearchResult } from './types'

const startMonday = new Date(2026, 8, 28)
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const initialHabitDefinitions: Habit[] = [
  { id: 1, title: 'Wake up at 6:30 AM', frequency: 'everyday', days: [], time: '06:30', autoTask: false, active: true },
  { id: 2, title: 'Learn 5 English words', frequency: 'everyday', days: [], time: '09:00', autoTask: false, active: true },
  { id: 3, title: 'Drink 2L of water', frequency: 'everyday', days: [], time: '08:00', autoTask: false, active: true },
]
const initialHabits = [
  [true, true, true, true, false, false, false],
  [true, true, false, true, false, false, false],
  [true, true, true, false, false, false, false],
]
const initialTasks: Task[] = [
  { id: 1, title: 'Plan the week ahead', time: '09:00', done: true, category: 'work' },
  { id: 2, title: 'Morning movement', time: '07:30', done: true, category: 'wellness' },
  { id: 3, title: 'Inbox zero', time: '11:00', done: true, category: 'work' },
  { id: 4, title: 'Review project goals', time: '14:30', done: false, category: 'work', ai: true, starred: true, steps: ['Review milestones', 'Identify blockers', 'Set next actions'] },
  { id: 5, title: 'Read for 20 minutes', time: '20:00', done: false, category: 'personal' },
  { id: 6, title: 'Deep work session', time: '09:00', done: true, category: 'work', starred: true },
  { id: 7, title: 'Team standup', time: '10:30', done: true, category: 'work' },
  { id: 8, title: 'Work on presentation', time: '13:00', done: true, category: 'work', ai: true, steps: ['Outline key points', 'Build slides', 'Practice delivery'] },
  { id: 9, title: 'Evening walk', time: '18:30', done: false, category: 'wellness' },
  { id: 10, title: 'Journal & reflect', time: '21:00', done: false, category: 'personal' },
  { id: 11, title: 'Morning stretch', time: '07:00', done: true, category: 'wellness' },
  { id: 12, title: 'Design review', time: '10:00', done: true, category: 'work' },
  { id: 13, title: 'Write project proposal', time: '14:30', done: false, category: 'work', ai: true, steps: ['Draft outline', 'Write first version', 'Proofread & share'] },
  { id: 14, title: 'Lunch with Maya', time: '12:30', done: false, category: 'personal' },
  { id: 15, title: 'Send weekly update', time: '16:00', done: false, category: 'work' },
  { id: 16, title: 'Focus block: product', time: '09:00', done: false, category: 'work' },
  { id: 17, title: 'Catch up with the team', time: '11:30', done: false, category: 'work' },
  { id: 18, title: 'Pilates class', time: '17:30', done: false, category: 'wellness' },
  { id: 19, title: 'Creative brainstorming', time: '10:00', done: false, category: 'work', ai: true, steps: ['Collect inspiration', 'Generate ideas', 'Choose a direction'] },
  { id: 20, title: 'Wrap up loose ends', time: '15:00', done: false, category: 'work' },
  { id: 21, title: 'Weekly reflection', time: '17:00', done: false, category: 'personal' },
  { id: 22, title: 'Slow morning & coffee', time: '09:00', done: false, category: 'personal' },
  { id: 23, title: 'Go for a long walk', time: '11:00', done: false, category: 'wellness' },
  { id: 24, title: 'Try a new recipe', time: '18:00', done: false, category: 'personal' },
  { id: 25, title: 'Reset & recharge', time: '09:30', done: false, category: 'wellness' },
  { id: 26, title: 'Plan next week', time: '16:00', done: false, category: 'personal' },
]

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function dateForInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekOffsetForDate(date: Date) {
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return Math.round((monday.getTime() - startMonday.getTime()) / (7 * 86400000))
}

function habitApplies(habit: Habit, day: number) {
  return habit.frequency === 'everyday' || (habit.frequency === 'weekdays' ? day < 5 : habit.days.includes(day))
}

function Ring({ value, size = 42, stroke = 4, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e9f1eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#4ade80" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} className="transition-all duration-500" />
    </svg>
    {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
  </div>
}

function WeekPicker({ weekOffset, onChange, tasksByWeek, getTaskDay }: { weekOffset: number; onChange: (offset: number) => void; tasksByWeek: Record<number, Task[]>; getTaskDay: (id: number) => number }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showBacklog, setShowBacklog] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLInputElement>(null)
  const monday = addDays(startMonday, weekOffset * 7)
  const sunday = addDays(monday, 6)

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [])

  function selectWeek(offset: number) {
    onChange(offset)
    setOpen(false)
    setShowBacklog(false)
    setQuery('')
  }

  function offsetForDate(date: Date) {
    const mondayOfDate = addDays(date, -((date.getDay() + 6) % 7))
    return Math.round((mondayOfDate.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  }

  function dateFromSearch(value: string) {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
  }

  const searchedDate = dateFromSearch(query)
  const firstOffset = weekOffset < -3 || weekOffset > 10 ? weekOffset - 3 : -3
  const offsets = searchedDate ? [offsetForDate(searchedDate)] : Array.from({ length: 14 }, (_, index) => firstOffset + index)
  const search = query.trim().toLowerCase()
  const visibleWeeks = offsets.filter(offset => {
    if (!search || searchedDate) return true
    const first = addDays(startMonday, offset * 7)
    const last = addDays(first, 6)
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(first, index)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }).join(' ')
    return `week ${39 + offset} ${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ${first.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} ${last.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} ${dates}`.toLowerCase().includes(search)
  })
  const backlog = (tasksByWeek[weekOffset] ?? []).filter(task => !task.done).sort((a, b) => getTaskDay(a.id) - getTaskDay(b.id) || a.time.localeCompare(b.time))
  const monthDay = (date: Date) => `${date.toLocaleDateString('en-US', { month: 'short' })} ${String(date.getDate()).padStart(2, '0')}`

  return <div ref={containerRef} className="relative flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
    <button type="button" onClick={() => onChange(weekOffset - 1)} aria-label="Previous week" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#66776c] transition hover:border-[#95d9a8] hover:text-[#27844b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] sm:w-10"><Icon name="chevronLeft" size={17} /></button>
    <button type="button" onClick={() => { setOpen(value => !value); setShowBacklog(false) }} aria-label="Choose a week" aria-expanded={open} aria-controls="week-picker-menu" className={`flex h-10 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-lg border bg-white px-2 text-[10px] font-semibold text-[#344739] transition sm:min-w-[280px] sm:px-4 sm:text-[13px] ${open ? 'border-[#91dda6] shadow-[0_0_0_3px_rgba(74,222,128,0.12)]' : 'border-[#e2e8f0] hover:border-[#b4d9bd]'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]`}><span className="truncate whitespace-nowrap">Week {39 + weekOffset}: {monthDay(monday)} - {monthDay(sunday)}, {sunday.getFullYear()}</span><Icon name="chevronDown" size={14} className={`shrink-0 text-[#7f9684] transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    <button type="button" onClick={() => onChange(weekOffset + 1)} aria-label="Next week" className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#66776c] transition hover:border-[#95d9a8] hover:text-[#27844b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] sm:w-10"><Icon name="chevronRight" size={17} /></button>

    {open && <div id="week-picker-menu" role="dialog" aria-label="Choose a week" className="absolute left-1/2 top-[calc(100%+12px)] z-40 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#e5ede7] bg-white shadow-[0_12px_35px_rgba(21,51,31,0.1)]">
      <div className="border-b border-[#eef2ef] p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-[12px] font-bold text-[#314a39]">Find a week</span><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9daa9f]">WEEKLY PLANNER</span></div>
        <div className="relative flex h-11 items-center rounded-[10px] border border-[#e2e8f0] bg-[#f8faf9] transition focus-within:border-[#62d786] focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[#4ade80]/15"><Icon name="search" size={17} className="ml-3 shrink-0 text-[#90a297]" /><input type="search" value={query} onChange={event => { setQuery(event.target.value); setShowBacklog(false) }} onKeyDown={event => { if (event.key === 'Enter' && searchedDate) selectWeek(offsetForDate(searchedDate)) }} placeholder="Search date or week (e.g. 2026-09-29 or Oct 2026)" aria-label="Search date or week" className="min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-[#334e3c] outline-none placeholder:text-[#a2afa5]" /><button type="button" onClick={() => { try { calendarRef.current?.showPicker() } catch { calendarRef.current?.click() } }} aria-label="Open calendar picker" className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#69aa7c] hover:bg-[#e8f7ec]"><Icon name="calendar" size={16} /></button><input ref={calendarRef} type="date" aria-label="Jump to a date" className="absolute bottom-0 right-5 h-0 w-0 opacity-0" onChange={event => { if (event.target.value) { const date = dateFromSearch(event.target.value); if (date) selectWeek(offsetForDate(date)) } }} /></div>
      </div>
      <div className="flex gap-2 border-b border-[#eef2ef] p-3.5"><button type="button" onClick={() => selectWeek(offsetForDate(new Date()))} className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-[#4ade80] px-2 py-2.5 text-[11px] font-bold text-[#185432] transition hover:bg-[#38d875]"><Icon name="calendar" size={14} /> Jump to Current Week</button><button type="button" onClick={() => setShowBacklog(value => !value)} aria-pressed={showBacklog} className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border px-2 py-2.5 text-[11px] font-semibold transition ${showBacklog ? 'border-[#93dca7] bg-[#edf9ef] text-[#2f9050]' : 'border-[#e5ebe6] bg-white text-[#6b8070] hover:bg-[#f1f5f9]'}`}><Icon name="inbox" size={14} /> Backlog Tasks</button></div>
      <div className="max-h-[285px] overflow-y-auto p-2.5" role="listbox" aria-label={showBacklog ? 'Backlog tasks' : 'Weeks'}>
        {showBacklog ? <><div className="px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9aa99d]">Unfinished this week · {backlog.length}</div>{backlog.length ? backlog.map(task => <button key={task.id} type="button" onClick={() => { setOpen(false); document.getElementById(`day-${getTaskDay(task.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }} className="flex w-full items-center justify-between gap-3 rounded-[9px] px-2.5 py-2 text-left hover:bg-[#f1f5f9]"><span className="truncate text-[12px] font-medium text-[#3b5342]">{task.title}</span><span className="shrink-0 text-[10px] text-[#89a18f]">{shortDays[getTaskDay(task.id)]}</span></button>) : <p className="px-3 py-5 text-center text-[12px] text-[#8b9b8f]">No backlog tasks for this week.</p>}</> : visibleWeeks.length ? visibleWeeks.map((offset, index) => {
          const first = addDays(startMonday, offset * 7)
          const last = addDays(first, 6)
          const month = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          const previous = index ? addDays(startMonday, visibleWeeks[index - 1] * 7).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
          const weekTasks = tasksByWeek[offset] ?? []
          const completion = weekTasks.length ? Math.round(weekTasks.filter(task => task.done).length / weekTasks.length * 100) : null
          const selected = offset === weekOffset
          return <div key={offset}>{month !== previous && <div className="px-2.5 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#95a59a] first:pt-1">{month}</div>}<button type="button" role="option" aria-selected={selected} onClick={() => selectWeek(offset)} className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition ${selected ? 'bg-[#dcfce7] text-[#205c38]' : 'text-[#42594a] hover:bg-[#f1f5f9]'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold ${selected ? 'bg-white/75 text-[#2aaf59]' : 'bg-[#f1f5f1] text-[#91a392]'}`}>{selected ? <Icon name="check" size={16} /> : String(39 + offset).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold">Week {39 + offset}</span><span className={`mt-0.5 block text-[10px] ${selected ? 'text-[#4b9360]' : 'text-[#94a59a]'}`}>{monthDay(first)} - {monthDay(last)}</span></span>{completion !== null ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selected ? 'bg-white/70 text-[#348751]' : 'bg-[#edf8ef] text-[#65a577]'}`}>{completion}%</span> : <span className="mr-1 h-1.5 w-1.5 rounded-full bg-[#c9d9cd]" />}</button></div>
        }) : <p className="px-3 py-6 text-center text-[12px] text-[#8b9b8f]">No matching weeks. Try a date like 2026-09-29.</p>}
      </div>
      <div className="border-t border-[#eef2ef] px-4 py-2.5 text-center text-[10px] text-[#a2b0a5]">Choose a week to see its plan</div>
    </div>}
  </div>
}

const reviewHabits = [
  { title: 'Drink Water', goal: '8 cups per day', color: '#60A5FA', target: 0.86 },
  { title: 'Read a Little', goal: '20 minutes per day', color: '#FBBF24', target: 0.74 },
  { title: 'Move My Body', goal: '30 minutes per day', color: '#F472B6', target: 0.69 },
  { title: 'Practice English', goal: '5 new words per day', color: '#34D399', target: 0.9 },
  { title: 'Mindful Moments', goal: '10 minutes per day', color: '#A78BFA', target: 0.78 },
]

function habitActivity(date: Date, index: number, year: number, today: Date) {
  if (date.getFullYear() !== year || date > today) return -1
  const day = Math.round((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000)
  const noise = Math.sin(day * 12.9898 + index * 78.233 + year * 0.71) * 43758.5453
  const amount = noise - Math.floor(noise)
  if (amount > reviewHabits[index].target) return 0
  const shade = Math.sin(day * 4.123 + index * 19.47) * 9713.19
  return 1 + Math.floor((shade - Math.floor(shade)) * 4)
}

function HabitReviewModal({ selectedMonday, onClose }: { selectedMonday: Date; onClose: () => void }) {
  const [year, setYear] = useState(2026)
  const [view, setView] = useState<'year' | 'week'>('year')
  const [dark, setDark] = useState(false)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const firstDay = new Date(year, 0, 1)
  const lastDay = new Date(year, 11, 31)
  const gridStart = addDays(firstDay, -((firstDay.getDay() + 6) % 7))
  const gridEnd = addDays(lastDay, 6 - ((lastDay.getDay() + 6) % 7))
  const gridDays = Array.from({ length: Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1 }, (_, index) => addDays(gridStart, index))
  const weekCount = gridDays.length / 7
  const daysInYear = Array.from({ length: Math.round((addDays(lastDay, 1).getTime() - firstDay.getTime()) / 86400000) }, (_, index) => addDays(firstDay, index))
  const trackedDays = daysInYear.filter(date => date <= today)
  const percentages = reviewHabits.map((_, index) => trackedDays.length ? Math.round(trackedDays.filter(date => habitActivity(date, index, year, today) > 0).length / trackedDays.length * 100) : 0)
  const overall = Math.round(percentages.reduce((sum, value) => sum + value, 0) / reviewHabits.length)
  const fallbackMonday = new Date(year, 8, 28)
  const weekStart = selectedMonday.getFullYear() === year ? selectedMonday : addDays(fallbackMonday, -((fallbackMonday.getDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1)
    return { label: date.toLocaleDateString('en-US', { month: 'short' }), left: Math.floor(Math.round((date.getTime() - gridStart.getTime()) / 86400000) / 7) * 12 }
  })
  const panel = dark ? 'border-[#314355] bg-[#111e2d] text-[#f0f7f3]' : 'border-[#e2e8f0] bg-white text-[#0f172a]'
  const surface = dark ? 'border-[#293b4b] bg-[#192939]' : 'border-[#e2e8f0] bg-[#f1f5f9]'
  const statSurface = dark ? surface : 'border-[#e2e8f0] bg-white shadow-sm'
  const muted = dark ? 'text-[#97abba]' : 'text-[#64748b]'
  const empty = dark ? '#1E293B' : '#E2E8F0'

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08170f]/65 p-3 backdrop-blur-[8px] sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="review-title" className={`flex max-h-[calc(100dvh-24px)] w-full max-w-[940px] flex-col overflow-hidden rounded-2xl border shadow-[0_28px_90px_rgba(4,18,14,0.35)] sm:max-h-[calc(100dvh-48px)] ${panel}`}>
      <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-8 sm:py-6 ${dark ? 'border-[#2a3c4d]' : 'border-[#e8eeeb]'}`}>
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#69d99a]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> YOUR CONSISTENCY, OVER TIME</div><h2 id="review-title" className="text-[22px] font-bold tracking-[-0.05em] sm:text-[27px]">Habit In-Review <span className={dark ? 'text-[#78928b]' : 'text-[#abc0af]'}>/</span> Long-term Progress</h2><p className={`mt-1.5 text-[12px] ${muted}`}>Every little check-in tells a bigger story.</p></div>
        <button onClick={onClose} aria-label="Close habit review" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition ${dark ? 'border-[#334656] text-[#a5bac2] hover:bg-[#2b4051]' : 'border-[#e4ece7] text-[#72887a] hover:bg-[#eef5ef]'}`}><Icon name="close" size={17} /></button>
      </div>

      <div className="overflow-y-auto px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className={`flex rounded-[10px] border p-1 ${surface}`} role="group" aria-label="Review view">
            <button onClick={() => setView('week')} aria-pressed={view === 'week'} className={`rounded-[7px] px-3 py-2 text-[11px] font-bold transition sm:px-4 ${view === 'week' ? dark ? 'bg-[#2b4b42] text-[#8aebb1]' : 'bg-white text-[#2e9653] shadow-sm' : muted}`}>Weekly View</button>
            <button onClick={() => setView('year')} aria-pressed={view === 'year'} className={`rounded-[7px] px-3 py-2 text-[11px] font-bold transition sm:px-4 ${view === 'year' ? dark ? 'bg-[#2b4b42] text-[#8aebb1]' : 'bg-white text-[#2e9653] shadow-sm' : muted}`}>Yearly Heatmap View</button>
          </div>
          <div className="flex items-center gap-2"><label className={`flex h-10 items-center gap-2 rounded-[10px] border px-3 text-[12px] font-semibold ${surface}`}><Icon name="calendar" size={15} className="text-[#64c48b]" /><select value={year} onChange={event => setYear(Number(event.target.value))} aria-label="Select year" className="cursor-pointer bg-transparent outline-none"><option value={2024} className="text-[#1f3529]">2024</option><option value={2025} className="text-[#1f3529]">2025</option><option value={2026} className="text-[#1f3529]">2026</option><option value={2027} className="text-[#1f3529]">2027</option></select></label><button onClick={() => setDark(value => !value)} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} title={`Switch to ${dark ? 'light' : 'dark'} theme`} className={`flex h-10 w-10 items-center justify-center rounded-[10px] border transition ${surface} ${dark ? 'text-[#a9d9bd]' : 'text-[#6b9378]'}`}><Icon name={dark ? 'sun' : 'moon'} size={17} /></button></div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-3"><div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}><div className={`text-[10px] font-semibold ${muted}`}>DAYS TRACKED</div><div className="mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px]">{trackedDays.length}</div></div><div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}><div className={`text-[10px] font-semibold ${muted}`}>YOUR HABITS</div><div className="mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px]">05</div></div><div className={`rounded-2xl border p-3 sm:p-4 ${statSurface}`}><div className={`text-[10px] font-semibold ${muted}`}>CONSISTENCY</div><div className={`mt-1 text-[21px] font-bold tracking-[-0.05em] sm:text-[25px] ${dark ? 'text-[#75dfa0]' : 'text-[#0f172a]'}`}>{overall}%</div></div></div>

        {view === 'year' ? <div className={`overflow-x-auto rounded-[16px] border p-3 sm:p-4 ${surface}`}><div className="min-w-[700px]"><div className="relative mb-2 ml-9 h-5" style={{ width: weekCount * 12 - 3 }}>{months.map(month => <span key={month.label} className={`absolute top-0 text-[10px] font-semibold ${muted}`} style={{ left: month.left }}>{month.label}</span>)}</div>{reviewHabits.map((habit, index) => <div key={habit.title} className={`border-t py-3.5 first:border-t-0 first:pt-1 ${dark ? 'border-[#2c3e4c]' : 'border-[#e5ebec]'}`}><div className="mb-2.5 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: `${habit.color}20`, color: habit.color }}><Icon name="check" size={16} /></span><div className="text-[12px] font-bold sm:text-[13px]">{habit.title} <span className={`font-normal ${muted}`}>· {habit.goal}</span></div></div><span className="text-[13px] font-bold" style={{ color: habit.color }}>{percentages[index]}%</span></div><div className="flex items-center gap-2"><div className={`flex w-7 shrink-0 flex-col justify-between text-[9px] font-semibold ${muted}`} style={{ height: 81 }}><span>M</span><span>W</span><span>F</span><span>S</span></div><div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weekCount}, 9px)` }}>{gridDays.map((date, dayIndex) => { const level = habitActivity(date, index, year, today); return <span key={dayIndex} title={`${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${level < 0 ? 'Not tracked' : level === 0 ? 'Not completed' : 'Completed'}`} className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: level > 0 ? habit.color : empty, opacity: level < 0 ? 0.45 : level === 0 ? 1 : 0.38 + level * 0.155 }} /> })}</div></div></div>)}</div></div> : <div className="space-y-2.5"><div className={`mb-3 text-[11px] font-medium ${muted}`}>{weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>{reviewHabits.map((habit, index) => { const complete = weekDays.filter(date => habitActivity(date, index, year, today) > 0).length; return <div key={habit.title} className={`rounded-[13px] border p-3.5 sm:p-4 ${surface}`}><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: habit.color, backgroundColor: `${habit.color}22` }}><Icon name="check" size={16} /></span><div><div className="text-[12px] font-bold">{habit.title}</div><div className={`text-[10px] ${muted}`}>{habit.goal}</div></div></div><span className="text-[12px] font-bold" style={{ color: habit.color }}>{complete}/7 days</span></div><div className="grid grid-cols-7 gap-1.5">{weekDays.map((date, day) => { const level = habitActivity(date, index, year, today); return <div key={day} className="text-center"><div className="mx-auto flex h-8 w-full max-w-10 items-center justify-center rounded-[8px]" style={{ backgroundColor: level > 0 ? `${habit.color}35` : empty, color: habit.color, opacity: level < 0 ? 0.55 : 1 }}>{level > 0 && <Icon name="check" size={15} />}</div><div className={`mt-1.5 text-[9px] font-semibold ${muted}`}>{shortDays[day]}</div></div> })}</div></div> })}</div>}

        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] ${muted}`}><span>Sample activity for this design preview · Future days are unfilled</span><div className="flex items-center gap-1.5"><span>Less</span><span className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: empty }} />{[0.45, 0.62, 0.8, 1].map(level => <span key={level} className="h-[9px] w-[9px] rounded-[3px] bg-[#34D399]" style={{ opacity: level }} />)}<span>More</span></div></div>
      </div>
    </div>
  </div>
}

const examplePrompt = 'Prepare Q3 Revenue Presentation, Deadline: Friday 6 PM'
const exampleSteps = ['Collect Excel data', 'Analyze revenue trends', 'Draft slide outline', 'Polish & rehearse presentation']

function makeBreakdown(prompt: string, firstDay: number): BreakdownItem[] {
  const topic = prompt.split(/,|deadline:/i)[0].trim() || 'your task'
  const titles = /present|slide|pitch|revenue/i.test(topic)
    ? exampleSteps
    : ['Gather notes & resources', `Outline ${topic.toLowerCase()}`, 'Work on the first draft', 'Review & finalize']
  return titles.map((title, index) => ({ id: index + 1, title, day: Math.min(firstDay + index, 6), time: ['10:00', '09:30', '11:00', '16:00'][index] }))
}

function InlineTimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draftTime, setDraftTime] = useState(value || '09:00')
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelWidth = 240
  const panelHeight = 232

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const top = rect.bottom + panelHeight + 8 <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - panelHeight - 8)
      setPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function showPicker() {
    const nextValue = value || '09:00'
    setDraftTime(nextValue)
    setOpen(current => !current)
  }

  function choosePart(part: 'hour' | 'minute' | 'period', selected: string) {
    const [storedHour, storedMinute] = draftTime.split(':').map(Number)
    const isPm = storedHour >= 12
    const hour12 = storedHour % 12 || 12
    const hour = part === 'hour' ? Number(selected) : hour12
    const minute = part === 'minute' ? Number(selected) : storedMinute
    const period = part === 'period' ? selected === 'PM' : isPm
    const hour24 = hour % 12 + (period ? 12 : 0)
    setDraftTime(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }

  function formatTime(time: string) {
    if (!time) return ''
    const [hour, minute] = time.split(':').map(Number)
    return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  const [draftHour, draftMinute] = draftTime.split(':').map(Number)
  const selectedHour = draftHour % 12 || 12
  const selectedPeriod = draftHour >= 12 ? 'PM' : 'AM'
  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

  return <>
    <button
      ref={triggerRef}
      type="button"
      onClick={showPicker}
      aria-label={value ? `Change task time, ${formatTime(value)}` : 'Set task time'}
      aria-expanded={open}
      aria-haspopup="dialog"
      title={value ? `Task time: ${formatTime(value)}` : 'Set task time'}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] ${value || open ? 'bg-[#dcfce7] text-[#277343]' : 'bg-white text-[#718477] hover:bg-[#dcfce7]'}`}
    >
      <Icon name="clock" size={14} />
      <span className="inline-time-picker-label whitespace-nowrap">{formatTime(value)}</span>
    </button>
    {open && createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Choose task time"
        className="fixed z-[100] w-[240px] rounded-2xl border border-[#e7eee9] bg-white p-3 text-[#243c2d] shadow-[0_16px_48px_rgba(22,52,32,0.2)]"
        style={{ left: position.left, top: position.top }}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-[#385140]">Choose a time</span>
          <span className="text-[11px] font-semibold text-[#4c9b64]">{formatTime(draftTime)}</span>
        </div>
        <div className="grid grid-cols-[1fr_1fr_0.8fr] gap-2">
          {[
            { label: 'Hour', values: hours, selected: String(selectedHour).padStart(2, '0'), part: 'hour' as const },
            { label: 'Minute', values: minutes, selected: String(draftMinute).padStart(2, '0'), part: 'minute' as const },
            { label: 'AM/PM', values: ['AM', 'PM'], selected: selectedPeriod, part: 'period' as const },
          ].map(column => <div key={column.part} className="min-w-0">
            <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#91a294]">{column.label}</div>
            <div className="h-[112px] space-y-1 overflow-y-auto rounded-xl bg-[#f7faf7] p-1">
              {column.values.map(option => <button
                key={option}
                type="button"
                onClick={() => choosePart(column.part, option)}
                aria-pressed={column.selected === option}
                className={`w-full rounded-lg py-1.5 text-[11px] font-semibold transition ${column.selected === option ? 'bg-[#4ade80] text-white' : 'text-[#617467] hover:bg-[#e3f8e8]'}`}
              >{option}</button>)}
            </div>
          </div>)}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#edf1ee] pt-2.5">
          <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]">Clear time</button>
          <button type="button" onClick={() => { onChange(draftTime); setOpen(false) }} aria-label="Confirm task time" title="Confirm time" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"><Icon name="check" size={16} /></button>
        </div>
      </div>,
      document.body,
    )}
  </>
}





function BreakdownModal({ initialDay, monday, onClose, onSave }: { initialDay: number; monday: Date; onClose: () => void; onSave: (items: BreakdownItem[]) => void }) {
  const [prompt, setPrompt] = useState(examplePrompt)
  const [items, setItems] = useState(() => makeBreakdown(examplePrompt, initialDay))
  const [deadline, setDeadline] = useState(() => dateForInput(addDays(monday, Math.min(initialDay + 3, 6))))
  const [dueTime, setDueTime] = useState('16:00')
  const [voiceMessage, setVoiceMessage] = useState('')
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function startVoiceEntry() {
    type SpeechEngine = {
      lang: string
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
      onerror: (() => void) | null
      onend: (() => void) | null
      start: () => void
    }
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => SpeechEngine; webkitSpeechRecognition?: new () => SpeechEngine }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: new () => SpeechEngine }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceMessage('Voice input is unavailable here. Please type your task instead.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.onresult = event => { setPrompt(event.results[0][0].transcript); setVoiceMessage('Voice note added. Generate a new plan when ready.') }
    recognition.onerror = () => { setIsListening(false); setVoiceMessage('Could not hear you. Try again or type your task.') }
    recognition.onend = () => setIsListening(false)
    try { recognition.start(); setIsListening(true); setVoiceMessage('Listening... describe your task.') }
    catch { setVoiceMessage('Microphone access is unavailable. Please type your task instead.') }
  }

  function updateItem(id: number, changes: Partial<BreakdownItem>) {
    setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item))
  }

  function updateDeadline(value: string) {
    setDeadline(value)
    const day = dayNames.findIndex((_, index) => dateForInput(addDays(monday, index)) === value)
    if (day !== -1) setItems(current => current.map((item, index) => index === current.length - 1 ? { ...item, day } : item))
  }

  function updateDueTime(value: string) {
    setDueTime(value)
    setItems(current => current.map((item, index) => index === current.length - 1 ? { ...item, time: value } : item))
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.div
      aria-hidden="true"
      className="absolute inset-0 bg-black backdrop-blur-sm"
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.4 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    />
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-title"
      className="relative my-auto flex max-h-[calc(100dvh-32px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(9,37,21,0.28)]"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ecf1eb] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start gap-3.5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#e5f8e9] text-[#2eae60]"><Icon name="sparkle" size={23} /></div><div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-[#66b97d]">TURN IDEAS INTO ACTION</div><h2 id="breakdown-title" className="text-[21px] font-bold tracking-[-0.045em] text-[#1b3325] sm:text-[23px]">AI Task Breakdown</h2><p className="mt-1 text-[12px] leading-relaxed text-[#8b9b8e]">A clear plan, one small step at a time.</p></div></div>
        <button type="button" onClick={onClose} aria-label="Close task breakdown" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#e9eee9] text-[#77897b] transition hover:bg-[#f4f8f4] hover:text-[#2e573a]"><Icon name="close" size={17} /></button>
      </div>

      <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-3 flex items-center justify-between"><label htmlFor="task-prompt" className="text-[12px] font-bold text-[#344c3b]">What are you working on?</label><span className="text-[10px] font-medium text-[#9ba99d]">YOUR BIG IDEA</span></div>
        <div className="relative rounded-[14px] border border-[#dfeae0] bg-[#fbfdf9] transition focus-within:border-[#67d78a] focus-within:ring-[3px] focus-within:ring-[#4ade80]/10">
          <textarea id="task-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Prepare Q3 Revenue Presentation, Deadline: Friday 6 PM" rows={2} className="w-full resize-none bg-transparent px-4 pb-12 pt-4 text-[13px] font-medium leading-relaxed text-[#38503e] outline-none placeholder:text-[#a6b2a5]" />
          <div className="absolute bottom-3 left-4 text-[10px] text-[#a0afa3]">Describe your big goal to get started</div>
          <button type="button" onClick={startVoiceEntry} disabled={isListening} aria-label={isListening ? 'Listening for voice input' : 'Use voice input'} title="Use voice input" className="absolute bottom-2.5 right-3 flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#e8f8ec] text-[#39ad64] transition hover:bg-[#d9f3e0] disabled:opacity-60"><Icon name="mic" size={17} /></button>
        </div>
        {voiceMessage && <p role="status" className="mt-2 text-[11px] text-[#718b78]">{voiceMessage}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-[11px] font-bold text-[#344c3b]">Target completion date <input type="date" value={deadline} min={dateForInput(monday)} max={dateForInput(addDays(monday, 6))} onChange={event => updateDeadline(event.target.value)} className="mt-1.5 w-full rounded-[10px] border border-[#dfeae0] bg-[#fbfdf9] px-2 py-2.5 text-[12px] font-medium text-[#38503e] outline-none focus:border-[#4ade80]" /></label>
          <label className="text-[11px] font-bold text-[#344c3b]">Due time <input type="time" value={dueTime} onChange={event => updateDueTime(event.target.value)} className="mt-1.5 w-full rounded-[10px] border border-[#dfeae0] bg-[#fbfdf9] px-2 py-2.5 text-[12px] font-medium text-[#38503e] outline-none focus:border-[#4ade80]" /></label>
        </div>
        <p className="mt-2 text-[10px] text-[#92a297]">Choose a day in this week. The deadline sets the final step's day and time.</p>
        <div className="mt-3 flex items-center justify-between gap-2"><p className="text-[11px] leading-snug text-[#92a297]">Adjust every step before adding it to your week.</p><button type="button" onClick={() => { const next = makeBreakdown(prompt, initialDay); const day = dayNames.findIndex((_, index) => dateForInput(addDays(monday, index)) === deadline); next[next.length - 1] = { ...next[next.length - 1], day: day < 0 ? initialDay : day, time: dueTime }; setItems(next) }} disabled={!prompt.trim()} className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[11px] font-bold text-[#319653] hover:bg-[#edf9ef] disabled:opacity-40"><Icon name="refresh" size={14} /> Regenerate</button></div>

        <div className="mt-6 rounded-[16px] border border-[#e8f1e9] bg-[#f6faf6] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><Icon name="sparkle" size={16} className="text-[#48bf72]" /><h3 className="text-[12px] font-bold text-[#31513b]">Your suggested plan</h3></div><span className="rounded-full bg-[#e5f6e9] px-2.5 py-1 text-[10px] font-bold text-[#489b61]">{items.length} STEPS</span></div>
          <div className="space-y-2">
            {items.map((item, index) => <div key={item.id} className="flex items-start gap-2.5 rounded-[11px] border border-[#e8efe8] bg-white p-3 shadow-[0_2px_8px_rgba(35,77,42,0.035)] sm:gap-3 sm:p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#edf9ef] text-[11px] font-bold text-[#43a965]">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <input id={`step-title-${item.id}`} value={item.title} onChange={event => updateItem(item.id, { title: event.target.value })} aria-label={`Title for step ${index + 1}`} className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-[12px] font-semibold text-[#34483a] outline-none hover:border-[#d9e9dd] focus:border-[#4ade80] sm:text-[13px]" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <select value={item.day} onChange={event => updateItem(item.id, { day: Number(event.target.value) })} aria-label={`Day for step ${index + 1}`} className="max-w-[120px] rounded-lg border border-[#dcebdd] bg-[#f1faf2] px-1.5 py-1 text-[10px] font-bold text-[#4d9a60] outline-none focus:border-[#4ade80]">{dayNames.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}</select>
                  <label className="flex items-center gap-1 rounded-lg border border-[#dcebdd] bg-[#f8fcf8] px-1.5 py-1 text-[#75a783]"><Icon name="clock" size={12} /><input type="time" value={item.time} onChange={event => updateItem(item.id, { time: event.target.value })} aria-label={`Time for step ${index + 1}`} className="w-[85px] bg-transparent text-[10px] font-bold text-[#4d9a60] outline-none" /></label>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1 border-l border-[#edf1ec] pl-2 sm:flex-row"><button type="button" onClick={() => document.getElementById(`step-title-${item.id}`)?.focus()} aria-label={`Edit ${item.title}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#95a79a] hover:bg-[#eef8ef] hover:text-[#319454]"><Icon name="edit" size={14} /></button><button type="button" onClick={() => setItems(current => current.filter(step => step.id !== item.id))} aria-label={`Delete ${item.title}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a2aea4] hover:bg-[#fff0ef] hover:text-[#cb706b]"><Icon name="trash" size={14} /></button></div>
            </div>)}
            {items.length === 0 && <p className="rounded-xl bg-white px-4 py-6 text-center text-[12px] text-[#8d9e90]">No steps yet. Regenerate a plan to start again.</p>}
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#98a99b]"><Icon name="sparkle" size={13} className="text-[#65bb7c]" /> Suggested steps are a starting point — make this plan yours.</p>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#ecf1eb] bg-white px-5 py-4 sm:px-7"><button type="button" onClick={onClose} className="rounded-[10px] border border-[#e3eae4] bg-white px-4 py-2.5 text-[12px] font-bold text-[#617467] transition hover:bg-[#f5f8f5]">Cancel</button><button type="button" onClick={() => onSave(items.filter(item => item.title.trim()))} disabled={!items.some(item => item.title.trim())} className="flex items-center justify-center gap-2 rounded-[10px] bg-[#4ade80] px-4 py-2.5 text-[12px] font-bold text-[#174f2e] shadow-[0_5px_12px_rgba(74,222,128,0.2)] transition hover:bg-[#37d973] disabled:cursor-not-allowed disabled:opacity-50"><Icon name="check" size={15} /> Save to Weekly Schedule</button></div>
    </motion.div>
  </div>
}

type ProfileSection = 'profile' | 'notifications' | 'appearance' | 'settings'

function ProfileMenu({ dark, setDark, showHabits, setShowHabits, compactCards, setCompactCards, weekStartsSunday, setWeekStartsSunday, name, setName, email, setEmail, onOpenTrash }: {
  dark: boolean; setDark: (value: boolean) => void; showHabits: boolean; setShowHabits: (value: boolean) => void
  compactCards: boolean; setCompactCards: (value: boolean) => void; weekStartsSunday: boolean; setWeekStartsSunday: (value: boolean) => void
  name: string; setName: (value: string) => void; email: string; setEmail: (value: string) => void
  onOpenTrash: () => void
}) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<ProfileSection | null>(null)
  const [reminders, setReminders] = useState(true)
  const [summary, setSummary] = useState(false)
  const [message, setMessage] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const options: { section: ProfileSection; icon: IconName; title: string; description: string }[] = [
    { section: 'profile', icon: 'user', title: 'My Profile & Account', description: 'Name, email & password' },
    { section: 'notifications', icon: 'bell', title: 'Notification Preferences', description: 'Reminders & daily summary' },
    { section: 'appearance', icon: 'palette', title: 'Appearance / Theme', description: 'Pastel light or dark' },
    { section: 'settings', icon: 'settings', title: 'App Settings', description: 'Habits & week layout' },
  ]

  return <div ref={menuRef} className="relative inline-block shrink-0">
    <button type="button" onClick={() => { setOpen(value => !value); setMessage('') }} aria-label="Open user profile menu" aria-expanded={open} aria-haspopup="menu" className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#e6dbcb] text-[13px] font-bold text-[#6b594c] shadow-[0_0_0_1px_#e8eeea] transition hover:shadow-[0_0_0_2px_#4ade80]">{name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'JD'}</button>
    <AnimatePresence>
    {open && <motion.div
      className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-[#0f172a] shadow-xl"
      role="menu"
      aria-label="User profile"
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-3 px-3 py-3.5"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e6dbcb] text-[13px] font-bold text-[#6b594c]">{name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'JD'}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{name}</p><p className="truncate text-[11px] text-[#849489]">{email}</p></div><span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[9px] font-bold text-[#267c47]">PRO</span></div>
      <div className="my-1 border-t border-[#edf1ee]" />
      {options.map(option => <button type="button" key={option.section} role="menuitem" onClick={() => { setSection(current => current === option.section ? null : option.section); setMessage('') }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#f4faf5] ${section === option.section ? 'bg-[#f0faf2]' : ''}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f8f1] text-[#50a76c]"><Icon name={option.icon} size={16} /></span><span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-[#253d2e]">{option.title}</span><span className="block text-[10px] text-[#8b9c8f]">{option.description}</span></span><Icon name="chevronRight" size={14} className="text-[#96a99b]" /></button>)}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenTrash() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#fff5f4]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0ef] text-[#cf756e]"><Icon name="trash" size={16} /></span><span className="flex-1"><span className="block text-[12px] font-semibold text-[#253d2e]">Trash bin</span><span className="block text-[10px] text-[#8b9c8f]">Restore or permanently delete tasks</span></span></button>
      {section && <div className="mx-2 my-2 rounded-xl border border-[#e1efe4] bg-[#f7fcf8] p-3 text-[11px] text-[#344c3b]">
        {section === 'profile' && <div className="space-y-2"><label className="block font-semibold">Display name<input value={name} onChange={event => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfeae0] bg-white px-2 py-1.5 font-normal outline-none focus:border-[#4ade80]" /></label><label className="block font-semibold">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dfeae0] bg-white px-2 py-1.5 font-normal outline-none focus:border-[#4ade80]" /></label><p className="text-[#819486]">Password changes require an account service.</p></div>}
        {section === 'notifications' && <div className="space-y-2"><label className="flex items-center justify-between gap-2">Task reminders <input type="checkbox" checked={reminders} onChange={event => setReminders(event.target.checked)} className="accent-[#4ade80]" /></label><label className="flex items-center justify-between gap-2">End-of-day summary <input type="checkbox" checked={summary} onChange={event => setSummary(event.target.checked)} className="accent-[#4ade80]" /></label><p className="text-[#819486]">Preferences are local to this preview; notifications are not connected.</p></div>}
        {section === 'appearance' && <div className="flex gap-2">{[false, true].map(value => <button key={String(value)} type="button" onClick={() => setDark(value)} aria-pressed={dark === value} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-semibold ${dark === value ? 'border-[#4ade80] bg-[#dcfce7] text-[#276c42]' : 'border-[#e1eae3] bg-white'}`}><Icon name={value ? 'moon' : 'sun'} size={14} />{value ? 'Dark' : 'Pastel light'}</button>)}</div>}
        {section === 'settings' && <div className="space-y-2"><label className="flex items-center justify-between gap-2">Show habit tracker <input type="checkbox" checked={showHabits} onChange={event => setShowHabits(event.target.checked)} className="accent-[#4ade80]" /></label><label className="flex items-center justify-between gap-2">Compact task cards <input type="checkbox" checked={compactCards} onChange={event => setCompactCards(event.target.checked)} className="accent-[#4ade80]" /></label><label className="flex items-center justify-between gap-2">Week starts on <select value={weekStartsSunday ? 'sunday' : 'monday'} onChange={event => setWeekStartsSunday(event.target.value === 'sunday')} className="rounded-lg border border-[#dfeae0] bg-white px-2 py-1 outline-none"><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label></div>}
      </div>}
      <div className="my-1 border-t border-[#edf1ee]" />
      <button type="button" role="menuitem" onClick={() => setMessage('Sign out is unavailable in this local preview.')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-[#ef4444] hover:bg-[#fff5f4]"><Icon name="logout" size={17} /> Log Out</button>
      {message && <p role="status" className="px-3 pb-2 text-[10px] text-[#9a615c]">{message}</p>}
    </motion.div>}
    </AnimatePresence>
  </div>
}


function ReschedulePopover({ taskTitle, onApply }: { taskTitle: string; onApply: (date: Date) => void }) {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelWidth = 248
  const panelHeight = 365

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = addDays(today, 1)
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const weekDates = dayNames.map((_, index) => addDays(monday, index))
  const nextMonday = addDays(monday, 7)
  const tomorrowValue = dateForInput(tomorrow)

  useLayoutEffect(() => {
    if (!open) return
    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const top = rect.bottom + panelHeight + 8 <= window.innerHeight
        ? rect.bottom + 8
        : Math.max(8, rect.top - panelHeight - 8)
      setPosition({ left, top })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function apply() {
    if (!selectedDate) return
    const [year, month, day] = selectedDate.split('-').map(Number)
    onApply(new Date(year, month - 1, day))
    setSelectedDate('')
    setOpen(false)
  }

  function choose(date: Date) {
    setSelectedDate(dateForInput(date))
  }

  function dateLabel(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return <>
    <div className="flex items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={`Quick reschedule ${taskTitle}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex min-w-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4ade80] ${open || selectedDate ? 'border-[#bce8c7] bg-[#dcfce7] text-[#39784b]' : 'border-[#f1ddd2] bg-white text-[#715c50] hover:border-[#bce8c7] hover:bg-[#f2fbf3]'}`}
      >
        <Icon name="calendar" size={12} />
        <span className="truncate">{selectedDate ? dateLabel(new Date(`${selectedDate}T12:00:00`)) : 'Quick reschedule'}</span>
        <Icon name="chevronDown" size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={!selectedDate}
        aria-label={`Apply reschedule for ${taskTitle}`}
        title="Apply reschedule"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"
      ><Icon name="check" size={14} /></button>
    </div>
    {open && createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Reschedule ${taskTitle}`}
        className="fixed z-[100] w-[248px] rounded-2xl border border-[#e7eee9] bg-white p-3 text-[#243c2d] shadow-[0_16px_48px_rgba(22,52,32,0.2)]"
        style={{ left: position.left, top: position.top }}
      >
        <div className="mb-2 px-1 text-[11px] font-bold text-[#385140]">Move task to</div>
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          <section>
            <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-1">
              {[today, tomorrow].map(date => {
                const value = dateForInput(date)
                return <button key={value} type="button" onClick={() => choose(date)} aria-pressed={selectedDate === value} className={`rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${selectedDate === value ? 'bg-[#dcfce7] text-[#287342]' : 'text-[#617467] hover:bg-[#f2fbf3]'}`}>{dateLabel(date)} · {value === dateForInput(today) ? 'Today' : 'Tomorrow'}</button>
              })}
            </div>
          </section>
          <section>
            <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">This Week</h3>
            <div className="grid grid-cols-2 gap-1">
              {weekDates.map((date, index) => {
                const value = dateForInput(date)
                const disabled = date < today
                return <button key={value} type="button" disabled={disabled} onClick={() => choose(date)} aria-pressed={selectedDate === value} className={`rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${selectedDate === value ? 'bg-[#dcfce7] text-[#287342]' : 'text-[#617467] hover:bg-[#f2fbf3]'} disabled:cursor-not-allowed disabled:opacity-35`}>{dayNames[index]} · {dateLabel(date)}</button>
              })}
            </div>
          </section>
          <section>
            <h3 className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wide text-[#91a294]">Next Week</h3>
            <button type="button" onClick={() => choose(nextMonday)} aria-pressed={selectedDate === dateForInput(nextMonday)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold transition ${selectedDate === dateForInput(nextMonday) ? 'bg-[#dcfce7] text-[#287342]' : 'text-[#617467] hover:bg-[#f2fbf3]'}`}><Icon name="calendar" size={12} /> Next Monday · {dateLabel(nextMonday)}</button>
            <label className={`mt-1 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${selectedDate && selectedDate !== dateForInput(today) && selectedDate !== dateForInput(tomorrow) && !weekDates.some(date => dateForInput(date) === selectedDate) && selectedDate !== dateForInput(nextMonday) ? 'bg-[#dcfce7] text-[#287342]' : 'text-[#617467] hover:bg-[#f2fbf3]'}`}>
              <Icon name="calendar" size={12} />
              <span>Custom Date...</span>
              <input type="date" min={tomorrowValue} value={selectedDate} onChange={event => setSelectedDate(event.target.value)} aria-label={`Custom reschedule date for ${taskTitle}`} className="ml-auto w-[22px] cursor-pointer text-transparent outline-none" />
            </label>
          </section>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[#edf1ee] pt-2">
          <button type="button" onClick={() => { setSelectedDate(''); setOpen(false) }} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]">Cancel</button>
          <button type="button" onClick={apply} disabled={!selectedDate} aria-label={`Confirm reschedule for ${taskTitle}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-40"><Icon name="check" size={14} /></button>
        </div>
      </div>,
      document.body,
    )}
  </>
}

function PendingTasks({ items, onCarry, onMove, onDismiss }: { items: OverdueTask[]; onCarry: () => void; onMove: (week: number, id: number, date: Date) => void; onDismiss: (week: number, id: number) => void }) {
  const [expanded, setExpanded] = useState(false)

  return <section className="mb-6 overflow-hidden rounded-2xl border border-[#f4e6d7] bg-white shadow-[0_5px_18px_rgba(60,45,25,0.04)]" aria-labelledby="pending-title">
    <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="pending-list" className="flex min-w-0 items-center gap-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0e4] text-[#d28c4d]"><Icon name="clock" size={19} /></span><span className="min-w-0"><span id="pending-title" className="block text-[14px] font-bold text-[#283d2d]">Pending & Overdue Tasks <span className="ml-1 inline-block rounded-full bg-[#fff0e9] px-2 py-1 text-[10px] font-bold text-[#dc6651]">{items.length} Overdue</span></span><span className="mt-1 block text-[11px] text-[#8b9a8e]">Unfinished work from earlier days, all in one place.</span></span><Icon name="chevronDown" size={16} className={`shrink-0 text-[#a0ad9f] transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
      <button type="button" disabled={!items.length} onClick={onCarry} aria-label="Auto carry-over overdue tasks" className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[#4ade80] px-3.5 py-2.5 text-[11px] font-bold text-[#19482b] transition hover:bg-[#36d871] disabled:cursor-not-allowed disabled:opacity-50"><Icon name="refresh" size={15} /> {expanded ? 'Auto Carry-Over to Today' : 'Auto Carry-Over'}</button>
    </div>
    <AnimatePresence initial={false}>
    {expanded && <motion.div id="pending-list" key="pending-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="overflow-hidden border-t border-[#f5ece4] px-5 pb-5 pt-4 sm:px-6">{items.length ? <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">{items.map(({ task, week, day, due }) => <div key={`${week}-${task.id}`} draggable onDragStart={event => event.dataTransfer.setData('application/x-focusflow-task', JSON.stringify({ week, id: task.id }))} className="flex items-start gap-2 rounded-xl border border-[#fee2e2] bg-[#fff8f5] p-3.5"><span title="Drag onto a day column" className="mt-1 cursor-grab text-[#d3a29a]"><Icon name="grip" size={16} /></span><div className="min-w-0 flex-1"><div className="mb-1.5 flex items-center gap-1.5"><span className="rounded-md bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-bold text-[#c95754]">Due: {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span className="text-[10px] text-[#a18e86]">{shortDays[day]} · {task.time}</span></div><p className="text-[12px] font-semibold text-[#423830]">{task.title}</p><ReschedulePopover taskTitle={task.title} onApply={date => onMove(week, task.id, date)} /></div><button type="button" onClick={() => onDismiss(week, task.id)} aria-label={`Dismiss ${task.title}`} title="Delete task" className="rounded-lg p-1.5 text-[#c58d88] hover:bg-[#fee2e2] hover:text-[#b94743]"><Icon name="trash" size={15} /></button></div>)}</div> : <p className="rounded-xl bg-[#f6faf6] px-4 py-5 text-center text-[12px] text-[#7c927f]">All caught up. No overdue tasks waiting.</p>}</motion.div>}
    </AnimatePresence>
  </section>
}

function MobilePendingBanner({ items, onCarry }: { items: OverdueTask[]; onCarry: () => void }) {
  const [expanded, setExpanded] = useState(false)

  return <section aria-labelledby="mobile-pending-title" className="mb-6 overflow-hidden rounded-2xl border border-[#f4e6d7] bg-white shadow-[0_6px_18px_rgba(31,65,39,0.04)]">
    <div className="flex items-center gap-2 p-3">
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="mobile-pending-list" className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0e4] text-[#d28c4d]"><Icon name="clock" size={17} /></span>
        <span id="mobile-pending-title" className="min-w-0 truncate text-[9px] font-bold text-[#304336]">Pending & Overdue Tasks</span>
        <span className="shrink-0 rounded-full bg-[#fff0e9] px-1.5 py-1 text-[8px] font-bold text-[#dc6651]">{items.length} Overdue</span>
        <Icon name="chevronDown" size={12} className={`shrink-0 text-[#96a397] transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <button type="button" disabled={!items.length} onClick={onCarry} aria-label="Auto carry-over overdue tasks" className="flex h-8 shrink-0 items-center gap-0.5 rounded-[10px] bg-[#4ade80] px-1.5 text-[8px] font-bold text-[#19482b] disabled:opacity-50"><Icon name="refresh" size={11} /> {expanded ? 'Auto Carry-Over to Today' : 'Auto Carry-Over'}</button>
    </div>
    <AnimatePresence initial={false}>
    {expanded && <motion.div id="mobile-pending-list" key="mobile-pending-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="overflow-hidden border-t border-[#f5ece4] p-3">{items.length ? items.map(({ task, due }) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fff8f5] px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-[#423830]">{task.title}</span><span className="mt-0.5 block text-[9px] text-[#b46c5d]">Due {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></span><span className="shrink-0 text-[9px] font-semibold text-[#8d7a70]">{task.time}</span></div>) : <p className="py-3 text-center text-[11px] text-[#7c927f]">All caught up.</p>}</motion.div>}
    </AnimatePresence>
  </section>
}


const emptyHabit = (): Omit<Habit, 'id'> => ({ title: '', frequency: 'everyday', days: [], time: '08:00', autoTask: false, active: true })

function HabitFields({ value, onChange }: { value: Omit<Habit, 'id'>; onChange: (value: Omit<Habit, 'id'>) => void }) {
  return <div className="space-y-3">
    <label className="block text-[11px] font-bold text-[#385140]">Habit name<input required value={value.title} onChange={event => onChange({ ...value, title: event.target.value })} placeholder="Read 10 pages" className="mt-1.5 w-full rounded-[10px] border border-[#deebe0] bg-white px-3 py-2.5 text-[12px] font-medium outline-none placeholder:text-[#a3b3a6] focus:border-[#4ade80]" /></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-[11px] font-bold text-[#385140]">Frequency<select value={value.frequency} onChange={event => onChange({ ...value, frequency: event.target.value as Habit['frequency'] })} className="mt-1.5 w-full rounded-[10px] border border-[#deebe0] bg-white px-2 py-2.5 text-[11px] outline-none focus:border-[#4ade80]"><option value="everyday">Everyday</option><option value="weekdays">Weekdays</option><option value="custom">Custom Days</option></select></label><label className="text-[11px] font-bold text-[#385140]">Preferred time<input type="time" required value={value.time} onChange={event => onChange({ ...value, time: event.target.value })} className="mt-1.5 w-full rounded-[10px] border border-[#deebe0] bg-white px-2 py-2.5 text-[11px] outline-none focus:border-[#4ade80]" /></label></div>
    {value.frequency === 'custom' && <div><p className="mb-2 text-[11px] font-bold text-[#385140]">Repeat on</p><div className="flex flex-wrap gap-1.5">{shortDays.map((day, index) => <button key={day} type="button" onClick={() => onChange({ ...value, days: value.days.includes(index) ? value.days.filter(item => item !== index) : [...value.days, index] })} aria-pressed={value.days.includes(index)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${value.days.includes(index) ? 'bg-[#4ade80] text-[#1b4c2c]' : 'border border-[#deebe0] bg-white text-[#778d7b]'}`}>{day}</button>)}</div></div>}
    <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e5eee6] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#385140]">Auto-generate daily task<input type="checkbox" checked={value.autoTask} onChange={event => onChange({ ...value, autoTask: event.target.checked })} className="h-4 w-4 accent-[#4ade80]" /></label>
  </div>
}

function HabitManagementModal({ habits, onAdd, onUpdate, onRemove, onReorder, onClose }: { habits: Habit[]; onAdd: (habit: Omit<Habit, 'id'>) => void; onUpdate: (habit: Habit) => void; onRemove: (id: number) => void; onReorder: (from: number, to: number) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(emptyHabit)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function valid(habit: Omit<Habit, 'id'>) {
    if (habit.frequency === 'custom' && !habit.days.length) { setError('Choose at least one day for a custom routine.'); return false }
    setError('')
    return Boolean(habit.title.trim() && habit.time)
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10231a]/60 p-3 backdrop-blur-[8px] sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div role="dialog" aria-modal="true" aria-labelledby="manage-habits-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(9,37,21,0.3)]">
    <div className="flex shrink-0 items-start justify-between border-b border-[#e9f0ea] px-5 py-5 sm:px-7"><div><div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5db779]">BUILD YOUR ROUTINE</div><h2 id="manage-habits-title" className="text-[21px] font-bold tracking-[-0.04em] text-[#1e3828]">Habit Settings & Management</h2><p className="mt-1 text-[12px] text-[#8a9d8f]">Create, edit, or toggle habit routines.</p></div><button type="button" onClick={onClose} aria-label="Close habit management" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5ece6] text-[#829585] hover:bg-[#f2f9f3]"><Icon name="close" size={17} /></button></div>
    <div className="overflow-y-auto px-5 py-5 sm:px-7"><form onSubmit={event => { event.preventDefault(); if (valid(draft)) { onAdd({ ...draft, title: draft.title.trim() }); setDraft(emptyHabit()) } }} className="rounded-2xl border border-[#dcefe1] bg-[#f6fcf7] p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcfce7] text-[#329a55]"><Icon name="plus" size={16} /></span><h3 className="text-[13px] font-bold text-[#2c4935]">Create a new habit</h3></div><HabitFields value={draft} onChange={setDraft} />{error && <p role="alert" className="mt-2 text-[11px] text-[#c95754]">{error}</p>}<button type="submit" className="mt-4 flex items-center gap-1.5 rounded-[10px] bg-[#4ade80] px-4 py-2.5 text-[11px] font-bold text-[#174b2b] hover:bg-[#36d871]"><Icon name="plus" size={15} /> Add to Tracker</button></form>
      <div className="mb-3 mt-6 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#2c4935]">Your habits</h3><span className="rounded-full bg-[#edf8ef] px-2.5 py-1 text-[10px] font-bold text-[#519b63]">{habits.length} ROUTINES</span></div><div className="space-y-2">{habits.map((habit, index) => <div key={habit.id} draggable onDragStart={event => event.dataTransfer.setData('application/x-focusflow-habit', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('application/x-focusflow-habit')); if (Number.isInteger(from) && from >= 0 && from < habits.length) onReorder(from, index) }} className="rounded-xl border border-[#e6eee7] bg-white p-3.5"><div className="flex items-center gap-2"><span title="Drag to reorder" className="cursor-grab text-[#a6b7aa]"><Icon name="grip" size={17} /></span><div className="min-w-0 flex-1"><p className={`truncate text-[12px] font-semibold ${habit.active ? 'text-[#2c4434]' : 'text-[#9ba89e]'}`}>{habit.title}</p><p className="mt-0.5 text-[10px] text-[#92a394]">{habit.frequency === 'everyday' ? 'Everyday' : habit.frequency === 'weekdays' ? 'Weekdays' : habit.days.map(day => shortDays[day]).join(', ')} · {habit.time}{habit.autoTask ? ' · Daily task on' : ''}</p></div><button type="button" onClick={() => onUpdate({ ...habit, active: !habit.active })} role="switch" aria-checked={habit.active} aria-label={`${habit.active ? 'Pause' : 'Activate'} ${habit.title}`} className={`relative h-5 w-9 shrink-0 rounded-full transition ${habit.active ? 'bg-[#4ade80]' : 'bg-[#dbe4dd]'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${habit.active ? 'left-[18px]' : 'left-0.5'}`} /></button><button type="button" onClick={() => { setEditing(habit); setError('') }} aria-label={`Edit ${habit.title}`} className="rounded-lg p-1.5 text-[#7fa489] hover:bg-[#edf9ef]"><Icon name="edit" size={15} /></button><button type="button" onClick={() => { onRemove(habit.id); if (editing?.id === habit.id) setEditing(null) }} aria-label={`Delete ${habit.title}`} className="rounded-lg p-1.5 text-[#dc7770] hover:bg-[#fff0ef]"><Icon name="trash" size={15} /></button></div>{editing?.id === habit.id && <form onSubmit={event => { event.preventDefault(); if (valid(editing)) { onUpdate({ ...editing, title: editing.title.trim() }); setEditing(null) } }} className="mt-3 border-t border-[#e9f0ea] pt-3"><HabitFields value={editing} onChange={value => setEditing({ ...editing, ...value })} />{error && <p role="alert" className="mt-2 text-[11px] text-[#c95754]">{error}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="px-2 py-2 text-[11px] font-semibold text-[#829585]">Cancel</button><button type="submit" className="rounded-lg bg-[#4ade80] px-3 py-2 text-[11px] font-bold text-[#174b2b]">Save changes</button></div></form>}</div>)}{!habits.length && <p className="rounded-xl border border-dashed border-[#dcebdd] p-5 text-center text-[12px] text-[#859a8a]">No habits yet. Add one above to begin.</p>}</div>
    </div>
  </div></div>
}

export default function App() {
  const nextHabitId = useRef(4)
  const suppressedAutoTasks = useRef(new Set<number>())
  const [weekOffset, setWeekOffset] = useState(0)
  const [tasksByWeek, setTasksByWeek] = useState<Record<number, Task[]>>({ 0: initialTasks })
  const [habitDefinitions, setHabitDefinitions] = useState(initialHabitDefinitions)
  const [habitsByWeek, setHabitsByWeek] = useState<Record<number, Record<number, boolean[]>>>({ 0: Object.fromEntries(initialHabits.map((checks, index) => [index + 1, checks])) })
  const [habitModalOpen, setHabitModalOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showHabits, setShowHabits] = useState(true)
  const [compactCards, setCompactCards] = useState(false)
  const [weekStartsSunday, setWeekStartsSunday] = useState(false)
  const [darkDashboard, setDarkDashboard] = useState(false)
  const [profileName, setProfileName] = useState('John Doe')
  const [profileEmail, setProfileEmail] = useState('john@example.com')
  const [quickAddDay, setQuickAddDay] = useState<number | null>(null)
  const [editModeByDay, setEditModeByDay] = useState<Record<number, boolean>>({})
  const [focusMode, setFocusMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([])
  const [undoItem, setUndoItem] = useState<DeletedTask | null>(null)
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [newDay, setNewDay] = useState(1)
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [addedDays, setAddedDays] = useState<Record<number, number>>({})

  useEffect(() => () => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
  }, [])

  const monday = addDays(startMonday, weekOffset * 7)
  const sunday = addDays(monday, 6)
  const tasks = tasksByWeek[weekOffset] ?? []
  const habitChecks = habitsByWeek[weekOffset] ?? {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeek = weekOffsetForDate(today)
  const todayDay = (today.getDay() + 6) % 7
  const overdue: OverdueTask[] = Object.entries(tasksByWeek).flatMap(([offset, weekTasks]) => weekTasks.flatMap(task => {
    const week = Number(offset)
    const day = getTaskDay(task.id)
    const due = addDays(startMonday, week * 7 + day)
    return !task.done && due < today ? [{ task, week, day, due }] : []
  })).sort((a, b) => a.due.getTime() - b.due.getTime() || a.task.time.localeCompare(b.task.time))
  const doneCount = tasks.filter(task => task.done).length
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
  const selectedDate = addDays(monday, selectedDay)
  const selectedTasks = tasks.filter(task => getTaskDay(task.id) === selectedDay)
  const selectedDone = selectedTasks.filter(task => task.done).length
  const selectedPercent = selectedTasks.length ? Math.round(selectedDone / selectedTasks.length * 100) : 0
  const dayOrder = weekStartsSunday ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]

  function toggleTask(id: number) {
    setTasksByWeek(current => ({ ...current, [weekOffset]: (current[weekOffset] ?? []).map(task => task.id === id ? { ...task, done: !task.done, completedAt: task.done ? undefined : Date.now() } : task) }))
  }

  function updateTaskTitle(id: number, title: string) {
    setTasksByWeek(current => ({ ...current, [weekOffset]: (current[weekOffset] ?? []).map(task => task.id === id ? { ...task, title } : task) }))
  }

  function toggleTaskStar(id: number) {
    setTasksByWeek(current => ({ ...current, [weekOffset]: (current[weekOffset] ?? []).map(task => task.id === id ? { ...task, starred: !task.starred } : task) }))
  }

  function toggleHabit(habitId: number, dayIndex: number) {
    const row = habitChecks[habitId] ?? Array(7).fill(false)
    setHabitsByWeek(current => ({ ...current, [weekOffset]: { ...(current[weekOffset] ?? {}), [habitId]: row.map((checked, day) => day === dayIndex ? !checked : checked) } }))
  }

  function addHabit(habit: Omit<Habit, 'id'>) {
    const id = nextHabitId.current++
    setHabitDefinitions(current => [...current, { ...habit, id }])
  }

  function updateHabit(habit: Habit) {
    setHabitDefinitions(current => current.map(item => item.id === habit.id ? habit : item))
    setTasksByWeek(current => Object.fromEntries(Object.entries(current).map(([week, weekTasks]) => [week, weekTasks.flatMap(task => {
      if (task.autoHabitId !== habit.id || task.done) return [task]
      const day = task.id in addedDays ? addedDays[task.id] : (-task.id - 1) % 10
      return habit.autoTask && habit.active && habitApplies(habit, day) ? [{ ...task, title: habit.title, time: habit.time }] : []
    })])))
  }

  function removeHabit(id: number) {
    setHabitDefinitions(current => current.filter(item => item.id !== id))
    setHabitsByWeek(current => Object.fromEntries(Object.entries(current).map(([week, checks]) => [week, Object.fromEntries(Object.entries(checks).filter(([key]) => Number(key) !== id))])))
    setTasksByWeek(current => Object.fromEntries(Object.entries(current).map(([week, weekTasks]) => [week, weekTasks.filter(task => task.autoHabitId !== id || task.done)])))
  }

  function reorderHabit(from: number, to: number) {
    setHabitDefinitions(current => { const next = [...current]; next.splice(to, 0, ...next.splice(from, 1)); return next })
  }

  function moveTask(sourceWeek: number, id: number, targetWeek: number, targetDay: number) {
    if (sourceWeek !== targetWeek && id < 0) suppressedAutoTasks.current.add(id)
    setTasksByWeek(current => {
      const task = current[sourceWeek]?.find(item => item.id === id)
      if (!task) return current
      return { ...current, [sourceWeek]: current[sourceWeek].filter(item => item.id !== id), [targetWeek]: [...(sourceWeek === targetWeek ? current[targetWeek].filter(item => item.id !== id) : current[targetWeek] ?? []), task] }
    })
    setAddedDays(current => ({ ...current, [id]: targetDay }))
    setWeekOffset(targetWeek)
  }

  function carryOverdue() {
    const moved = new Set(overdue.map(item => `${item.week}:${item.task.id}`))
    setTasksByWeek(current => {
      const next = Object.fromEntries(Object.entries(current).map(([week, weekTasks]) => [week, weekTasks.filter(task => !moved.has(`${week}:${task.id}`))])) as Record<number, Task[]>
      next[currentWeek] = [...(next[currentWeek] ?? []), ...overdue.map(item => item.task)]
      return next
    })
    setAddedDays(current => ({ ...current, ...Object.fromEntries(overdue.map(item => [item.task.id, todayDay])) }))
    setWeekOffset(currentWeek)
  }

  function dismissTask(week: number, id: number) {
    if (id < 0) suppressedAutoTasks.current.add(id)
    const task = tasksByWeek[week]?.find(item => item.id === id)
    if (!task) return
    const removed: DeletedTask = { task, week, day: getTaskDay(id), deletedAt: Date.now() }
    setDeletedTasks(current => [...current, removed])
    setTasksByWeek(current => ({ ...current, [week]: (current[week] ?? []).filter(task => task.id !== id) }))
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    setUndoItem(removed)
    undoTimeout.current = setTimeout(() => setUndoItem(null), 5000)
  }

  function restoreTask(item: DeletedTask) {
    setDeletedTasks(current => current.filter(entry => !(entry.week === item.week && entry.task.id === item.task.id && entry.deletedAt === item.deletedAt)))
    setTasksByWeek(current => ({ ...current, [item.week]: [...(current[item.week] ?? []).filter(task => task.id !== item.task.id), item.task] }))
    setAddedDays(current => ({ ...current, [item.task.id]: item.day }))
    setWeekOffset(item.week)
  }

  function undoDelete() {
    if (!undoItem) return
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    restoreTask(undoItem)
    setUndoItem(null)
  }

  function permanentlyDeleteTask(item: DeletedTask) {
    setDeletedTasks(current => current.filter(entry => !(entry.week === item.week && entry.task.id === item.task.id && entry.deletedAt === item.deletedAt)))
    if (undoItem?.week === item.week && undoItem.task.id === item.task.id) {
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
      setUndoItem(null)
    }
  }

  function openTrash() {
    const purgeBefore = Date.now() - 30 * 24 * 60 * 60 * 1000
    setDeletedTasks(current => current.filter(item => item.deletedAt >= purgeBefore))
    setTrashOpen(true)
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const matchingTasks: SearchResult[] = normalizedQuery ? Object.entries(tasksByWeek).flatMap(([offset, weekTasks]) => weekTasks.flatMap(task => {
    const week = Number(offset)
    const day = getTaskDay(task.id)
    const date = addDays(startMonday, week * 7 + day)
    const searchable = `${task.title} ${task.time} ${week + 39} ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${dateForInput(date)}`.toLowerCase()
    return searchable.includes(normalizedQuery) ? [{ task, week, day }] : []
  })) : []
  const currentMatches = matchingTasks.filter(result => result.week === weekOffset && !result.task.done)
  const otherMatches = matchingTasks.filter(result => result.week !== weekOffset && !result.task.done)
  const completedCurrentMatches = matchingTasks.filter(result => result.week === weekOffset && result.task.done).sort((a, b) => (b.task.completedAt ?? 0) - (a.task.completedAt ?? 0))
  const completedOtherMatches = matchingTasks.filter(result => result.week !== weekOffset && result.task.done).sort((a, b) => (b.task.completedAt ?? 0) - (a.task.completedAt ?? 0))

  function saveBreakdown(items: BreakdownItem[]) {
    const baseId = Date.now()
    const newTasks: Task[] = items.map((item, index) => ({ id: baseId + index, title: item.title.trim(), time: item.time, done: false, category: 'work', ai: true }))
    setTasksByWeek(current => ({ ...current, [weekOffset]: [...(current[weekOffset] ?? []), ...newTasks] }))
    setAddedDays(current => ({ ...current, ...Object.fromEntries(items.map((item, index) => [baseId + index, item.day])) }))
    setModalOpen(false)
  }

  function addQuickTask(day: number, title: string, time: string) {
    const id = Date.now()
    setTasksByWeek(current => ({ ...current, [weekOffset]: [...(current[weekOffset] ?? []), { id, title, time, done: false, category: 'personal' }] }))
    setAddedDays(current => ({ ...current, [id]: day }))
    setQuickAddDay(null)
  }

  function getTaskDay(id: number) {
    if (id in addedDays) return addedDays[id]
    if (id < 0) return (-id - 1) % 10
    if (id <= 5) return 0
    if (id <= 10) return 1
    if (id <= 15) return 2
    if (id <= 18) return 3
    if (id <= 21) return 4
    if (id <= 24) return 5
    return 6
  }

  useEffect(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const generated = habitDefinitions.filter(habit => habit.active && habit.autoTask).flatMap(habit => dayNames.flatMap((_, day) => {
      if (!habitApplies(habit, day) || addDays(startMonday, weekOffset * 7 + day) < now) return []
      return [{ id: -(habit.id * 10000000 + (weekOffset + 100000) * 10 + day + 1), title: habit.title, time: habit.time, done: false, category: 'wellness' as const, autoHabitId: habit.id }]
    }))
    if (!generated.length) return
    setTasksByWeek(current => {
      const existing = current[weekOffset] ?? []
      const newTasks = generated.filter(task => !suppressedAutoTasks.current.has(task.id) && !existing.some(item => item.id === task.id))
      return newTasks.length ? { ...current, [weekOffset]: [...existing, ...newTasks] } : current
    })
  }, [habitDefinitions, weekOffset])

  return <div className={`min-h-screen bg-[#f8fafc] text-[#182a23] ${darkDashboard ? 'dashboard-dark' : ''}`}>
    <div className="dashboard-mobile min-h-screen bg-[#fafbf5] pb-32 md:hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#eaf8e8] to-transparent" />
      <div className="relative mx-auto max-w-[480px]">
        <header className="relative z-50 flex items-center justify-between gap-3 px-5 pt-7">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#5da775]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> DAILY FOCUS</div>
            <h1 className="text-[22px] font-bold tracking-[-0.055em] text-[#193729]">FocusFlow <span className="text-[#31b963]">AI</span></h1>
            <p className="mt-1 text-[11px] font-medium text-[#829689]">Good morning, {profileName.split(' ')[0]} · {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <Ring value={selectedPercent} size={52} stroke={5}><span className="text-[11px] font-extrabold text-[#2c9353]">{selectedPercent}%</span></Ring>
            <ProfileMenu dark={darkDashboard} setDark={setDarkDashboard} showHabits={showHabits} setShowHabits={setShowHabits} compactCards={compactCards} setCompactCards={setCompactCards} weekStartsSunday={weekStartsSunday} setWeekStartsSunday={setWeekStartsSunday} name={profileName} setName={setProfileName} email={profileEmail} setEmail={setProfileEmail} onOpenTrash={() => openTrash()} />
          </div>
        </header>

        <div className="mt-6 px-5">
          <div className="relative z-30 mb-3"><WeekPicker weekOffset={weekOffset} onChange={setWeekOffset} tasksByWeek={tasksByWeek} getTaskDay={getTaskDay} /></div>
          <div className="relative z-20 mb-3 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#90a297]" />
              <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search tasks or time..." aria-label="Search tasks" className="h-10 w-full rounded-xl border border-[#e2e8f0] bg-white pl-9 pr-3 text-[11px] text-[#334e3c] outline-none focus:border-[#62d786] focus:ring-2 focus:ring-[#4ade80]/15" />
              <SearchDropdown query={searchQuery} current={currentMatches} other={otherMatches} completedCurrent={completedCurrentMatches} completedOther={completedOtherMatches} onSelect={result => { setWeekOffset(result.week); setSelectedDay(result.day); setSearchQuery(''); document.getElementById(`day-${result.day}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }} />
            </div>
            <button type="button" onClick={() => setFocusMode(value => !value)} aria-pressed={focusMode} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-bold ${focusMode ? 'border-[#f5cf76] bg-[#fff8e7] text-[#9a6d12]' : 'border-[#e2e8f0] bg-white text-[#64776c]'}`}><Icon name="star" size={14} className={focusMode ? 'fill-current' : ''} />Focus</button>
          </div>
          <div className="rounded-2xl border border-[#e9f0e7] bg-white p-3.5 shadow-[0_8px_24px_rgba(31,65,39,0.045)]">
            <div className="mb-2.5 flex items-center justify-between px-1"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#9aa99c]">CHOOSE A DAY</span><span className="text-[10px] font-semibold text-[#74a680]">{monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {sunday.toLocaleDateString('en-US', { day: 'numeric', month: monday.getMonth() === sunday.getMonth() ? undefined : 'short' })}</span></div>
            <div className="mobile-date-strip flex gap-1 overflow-x-auto pb-1" aria-label="Choose a day">
              {shortDays.map((day, index) => <button key={day} type="button" onClick={() => setSelectedDay(index)} aria-pressed={selectedDay === index} className="flex min-w-[36px] flex-1 flex-col items-center gap-2 rounded-xl py-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-[#4ade80]"><span className={`text-[10px] font-semibold ${selectedDay === index ? 'text-[#27864a]' : 'text-[#9baaa0]'}`}>{day}</span><span className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold transition ${selectedDay === index ? 'bg-[#4ade80] text-[#164b2a] shadow-[0_5px_10px_rgba(74,222,128,0.26)]' : 'bg-[#f3f7f0] text-[#596c5d]'}`}>{addDays(monday, index).getDate()}</span></button>)}
            </div>
          </div>
        </div>

        <main className="px-5 pb-20 pt-6">
          <MobilePendingBanner items={overdue.slice(0, 3)} onCarry={carryOverdue} />
          <div className="mb-5 flex items-end justify-between"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#66ad78]">ONE STEP AT A TIME</p><h2 className="text-[23px] font-bold tracking-[-0.05em] text-[#193729]">Today’s tasks<span className="text-[#4ade80]">.</span></h2></div><span className="mb-0.5 rounded-full bg-[#e8f7e9] px-3 py-1.5 text-[11px] font-bold text-[#408b56]">{selectedDone} of {selectedTasks.length} done</span></div>
          <div className="space-y-3">
            {selectedTasks.length === 0 && <div className="rounded-2xl border border-[#eaf0e8] bg-white px-5 py-10 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#eaf9ed] text-[#55b472]"><Icon name="list" size={22} /></div><p className="text-[14px] font-semibold text-[#355440]">A little breathing room.</p><p className="mt-1 text-[12px] text-[#8a9b8d]">Tap the button below to add your first task.</p></div>}
            {selectedTasks.map(task => <MobileTaskCardExternal key={task.id} task={task} focusMode={focusMode} onToggle={() => toggleTask(task.id)} onToggleStar={() => toggleTaskStar(task.id)} onDelete={() => dismissTask(weekOffset, task.id)} onReschedule={() => moveTask(weekOffset, task.id, selectedDay === 6 ? weekOffset + 1 : weekOffset, selectedDay === 6 ? 0 : selectedDay + 1)} />)}
            {quickAddDay === selectedDay ? <QuickAddTask key={`mobile-${weekOffset}-${selectedDay}`} day={dayNames[selectedDay]} onCancel={() => setQuickAddDay(null)} onAdd={(title, time) => addQuickTask(selectedDay, title, time)} /> : <button type="button" onClick={() => setQuickAddDay(selectedDay)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#bcdcc4] bg-[#f5fbf6] py-3.5 text-[12px] font-bold text-[#459661]"><Icon name="plus" size={16} /> Add task for today</button>}
          </div>
          {selectedTasks.length > 0 && <p className="mt-5 text-center text-[10px] font-medium text-[#9aad9c]">Swipe right to complete · Swipe left for actions</p>}

          {showHabits && <section aria-labelledby="mobile-habits-title" className="mt-7 rounded-2xl border border-[#e5eee7] bg-white p-4 shadow-[0_6px_18px_rgba(31,65,39,0.04)]">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#69ad7b]">DAILY RHYTHM</p><h2 id="mobile-habits-title" className="mt-0.5 text-[16px] font-bold text-[#253d2e]">Quick habits</h2></div><button type="button" onClick={() => setHabitModalOpen(true)} className="flex items-center gap-1 rounded-[10px] bg-[#e9f9ed] px-2.5 py-2 text-[10px] font-bold text-[#388b55]"><Icon name="plus" size={13} /> Habit</button></div>
            <div className="space-y-2">{habitDefinitions.filter(habit => habit.active && habitApplies(habit, selectedDay)).slice(0, 3).map(habit => { const checked = Boolean(habitChecks[habit.id]?.[selectedDay]); return <label key={habit.id} className="flex items-center gap-3 rounded-xl bg-[#f5f9f4] px-3 py-2.5"><input type="checkbox" checked={checked} onChange={() => toggleHabit(habit.id, selectedDay)} className="peer sr-only" /><span className="flex h-5 w-5 items-center justify-center rounded-md border border-[#cadbcd] bg-white text-white peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80]">{checked && <Icon name="check" size={12} />}</span><span className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${checked ? 'text-[#8b9c8f] line-through' : 'text-[#354b3b]'}`}>{habit.title}</span><span className="text-[9px] text-[#91a295]">{habit.time}</span></label> })}</div>
            <button type="button" onClick={() => setReviewOpen(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 border-t border-[#edf2ed] pt-3 text-[10px] font-bold text-[#3ca662]">View habit review <Icon name="arrow" size={12} /></button>
          </section>}
        </main>
      </div>
      <button type="button" onClick={() => { setNewDay(selectedDay); setModalOpen(true) }} aria-label="Open AI task breakdown" className="fixed bottom-6 right-6 z-50 flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[#4ade80] text-[#164c2b] shadow-lg shadow-[#39b15b]/30 transition active:scale-95"><Icon name="mic" size={25} /><span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-[#fafbf5] bg-white text-[#3db76b]"><Icon name="sparkle" size={13} /></span></button>
    </div>
    <div className="dashboard-desktop hidden md:block">
    <header className="relative z-50 border-b border-[#e9eeeb] bg-white/95">
      <div className="mx-auto flex min-h-[82px] max-w-[1640px] flex-wrap items-center justify-between gap-4 px-6 py-3 lg:px-10 xl:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#4ade80] text-[#155b34] shadow-[0_5px_12px_rgba(74,222,128,0.2)]"><Icon name="sparkle" size={22} /></div>
          <span className="text-[20px] font-bold tracking-[-0.05em]">FocusFlow <span className="text-[#31b963]">AI</span></span>
        </div>

        <div className="order-3 flex w-full items-center justify-center md:order-none md:w-auto"><WeekPicker weekOffset={weekOffset} onChange={setWeekOffset} tasksByWeek={tasksByWeek} getTaskDay={getTaskDay} /></div>

        <div className="flex items-center gap-3">
          <div className="relative hidden lg:block">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#90a297]" />
            <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks" className="h-10 w-[150px] rounded-[10px] border border-[#e2e8f0] bg-white pl-9 pr-3 text-[11px] text-[#334e3c] outline-none focus:border-[#62d786] focus:ring-2 focus:ring-[#4ade80]/15 xl:w-[190px]" />
            <SearchDropdown query={searchQuery} current={currentMatches} other={otherMatches} completedCurrent={completedCurrentMatches} completedOther={completedOtherMatches} onSelect={result => { setWeekOffset(result.week); setSelectedDay(result.day); setSearchQuery(''); document.getElementById(`day-${result.day}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }} />
          </div>
          <button type="button" onClick={() => setFocusMode(value => !value)} aria-pressed={focusMode} className={`flex h-10 items-center gap-1.5 rounded-[10px] border px-2 text-[11px] font-bold transition ${focusMode ? 'border-[#f5cf76] bg-[#fff8e7] text-[#9a6d12]' : 'border-[#e8eeea] bg-white text-[#64776c] hover:bg-[#f4faf5]'}`}><Icon name="star" size={14} className={focusMode ? 'fill-current' : ''} /><span className="hidden xl:inline">Focus Mode</span></button>
          <button onClick={() => { setNewDay(1); setModalOpen(true) }} className="flex h-10 items-center gap-2 rounded-[10px] bg-[#4ade80] px-4 text-[13px] font-bold text-[#14492b] shadow-[0_4px_12px_rgba(74,222,128,0.2)] transition hover:bg-[#36d871]"><Icon name="plus" size={17} /> <span className="hidden sm:inline">Add Task with AI</span><span className="sm:hidden">Add Task</span></button>
          <div className="relative">
            <button onClick={() => setSettingsOpen(value => !value)} aria-label="Settings" aria-expanded={settingsOpen} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e8eeea] text-[#64776c] hover:bg-[#f4faf5]"><Icon name="settings" size={19} /></button>
            {settingsOpen && <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[#e9eeeb] bg-white p-4 shadow-[0_16px_45px_rgba(29,66,43,0.13)]">
              <div className="mb-3 text-[13px] font-bold">Dashboard settings</div>
              <label className="flex cursor-pointer items-center justify-between py-2 text-[13px] text-[#526458]">Show habit tracker<input type="checkbox" checked={showHabits} onChange={() => setShowHabits(value => !value)} className="accent-[#36c76d]" /></label>
              <label className="flex cursor-pointer items-center justify-between py-2 text-[13px] text-[#526458]">Compact task cards<input type="checkbox" checked={compactCards} onChange={() => setCompactCards(value => !value)} className="accent-[#36c76d]" /></label>
            </div>}
          </div>
          <ProfileMenu dark={darkDashboard} setDark={setDarkDashboard} showHabits={showHabits} setShowHabits={setShowHabits} compactCards={compactCards} setCompactCards={setCompactCards} weekStartsSunday={weekStartsSunday} setWeekStartsSunday={setWeekStartsSunday} name={profileName} setName={setProfileName} email={profileEmail} setEmail={setProfileEmail} onOpenTrash={openTrash} />
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1640px] px-6 pb-16 pt-9 lg:px-10 xl:px-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4aaf70]"><span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" /> YOUR WEEKLY SPACE</div><h1 className="text-[30px] font-bold tracking-[-0.055em] text-[#1d3025] sm:text-[36px]">A little progress, every day<span className="text-[#43c873]">.</span></h1><p className="mt-1 text-[14px] text-[#839087]">Stay intentional, celebrate the small wins, and make this week yours.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-[#e7eee9] bg-white px-4 py-2 text-[12px] font-medium text-[#62776a]"><Icon name="sun" size={16} className="text-[#dcae56]" /> Make room for what matters</div>
      </div>

      <div className={`grid gap-5 ${showHabits ? 'xl:grid-cols-[1.15fr_0.85fr]' : ''}`}>
        <section className="rounded-2xl border border-[#edf1ee] bg-white p-5 shadow-[0_5px_18px_rgba(30,65,43,0.05)] sm:p-6" aria-labelledby="overview-title">
          <div className="mb-5 flex items-center justify-between"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">THE BIG PICTURE</div><h2 id="overview-title" className="text-[18px] font-bold tracking-[-0.035em]">Weekly overview</h2></div><span className="rounded-full bg-[#effbf2] px-3 py-1.5 text-[11px] font-semibold text-[#37895a]">Week {39 + weekOffset}</span></div>
          <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
            <div className="flex flex-col gap-3">
              <div className="relative min-h-[125px] overflow-hidden rounded-[14px] bg-[#eaf9ed] p-4"><div className="absolute -bottom-10 -right-8 h-32 w-32 rounded-full border-[17px] border-white/35" /><div className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 text-[#36aa61]"><Icon name="target" size={17} /></div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4c9b64]">WEEKLY FOCUS</p><p className="relative mt-1 text-[15px] font-semibold leading-snug text-[#25563a]">Make space for deep work and mindful moments.</p></div>
              <div className="flex min-h-[83px] items-start gap-3 rounded-[14px] border border-[#f0efea] bg-[#fffdf8] p-4"><Icon name="quote" size={16} className="mt-0.5 shrink-0 text-[#d4a55d]" /><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ba945b]">A LITTLE REMINDER</p><p className="text-[12px] font-medium italic leading-relaxed text-[#6f6b5f]">“I am capable of creating a week I feel good about.”</p></div></div>
            </div>
            <div className="rounded-[14px] border border-[#edf1ee] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[13px] font-bold">Your progress</p><p className="mt-0.5 text-[11px] text-[#9aa69d]">One step at a time</p></div><span className="text-[11px] font-medium text-[#7a8a7e]">{doneCount} of {tasks.length} tasks done</span></div><div className="flex items-center gap-5 sm:gap-7"><Ring value={percent} size={104} stroke={10}><div className="text-center"><div className="text-[24px] font-bold tracking-[-0.06em]">{percent}%</div><div className="text-[9px] font-semibold text-[#9aa69d]">DONE</div></div></Ring><div className="flex h-[118px] min-w-0 flex-1 items-end justify-between gap-1.5">{shortDays.map((day, index) => { const dayTasks = tasks.filter(task => getTaskDay(task.id) === index); const completed = dayTasks.filter(task => task.done).length; const height = dayTasks.length ? Math.max(12, Math.round(completed / dayTasks.length * 90)) : 8; return <div key={day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-[90px] w-full max-w-[27px] items-end overflow-hidden rounded-t-[5px] bg-[#f0f5f0]"><div className="w-full rounded-t-[5px] bg-[#79de96] transition-all duration-500" style={{ height: `${height}px` }} /></div><span className="text-[10px] font-medium text-[#8a9a8f]">{day}</span></div> })}</div></div></div>
          </div>
        </section>

        {showHabits && <section className="rounded-2xl border border-[#edf1ee] bg-white p-5 shadow-[0_5px_18px_rgba(30,65,43,0.05)] sm:p-6" aria-labelledby="habit-title">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">CONSISTENCY IS KEY</div><h2 id="habit-title" className="text-[18px] font-bold tracking-[-0.035em]">Habit tracker</h2></div><div className="flex items-center gap-2"><button type="button" onClick={() => setHabitModalOpen(true)} className="flex h-9 items-center gap-1 rounded-[10px] bg-[#4ade80] px-3 text-[11px] font-bold text-[#164c2b] hover:bg-[#36d871]"><Icon name="plus" size={14} /> Add Habit</button><button type="button" onClick={() => setHabitModalOpen(true)} aria-label="Manage habits" title="Manage habits" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#dcebdd] bg-[#f3fbf4] text-[#43a962] hover:bg-[#e5f7e9]"><Icon name="settings" size={17} /></button></div></div>
          <div className="overflow-x-auto"><div className="min-w-[420px]"><div className="grid grid-cols-[minmax(140px,1fr)_repeat(7,31px)_68px] items-center gap-1 border-b border-[#eff2ef] pb-3 text-center text-[10px] font-bold text-[#a1aba3]"><span className="text-left">HABIT</span>{shortDays.map(day => <span key={day}>{day}</span>)}<span>PROGRESS</span></div>
            {habitDefinitions.map(habit => { const checks = habitChecks[habit.id] ?? Array(7).fill(false); const eligible = dayNames.map((_, day) => habitApplies(habit, day)); const count = checks.filter((checked, day) => checked && eligible[day]).length; const total = eligible.filter(Boolean).length; const progress = total ? Math.round(count / total * 100) : 0; return <div key={habit.id} className={`grid grid-cols-[minmax(140px,1fr)_repeat(7,31px)_68px] items-center gap-1 border-b border-[#f1f3f1] py-[17px] ${habit.active ? '' : 'opacity-50'}`}><span className="pr-2 text-[11px] font-semibold leading-snug text-[#344a3a]">{habit.title}{!habit.active && <span className="block text-[9px] font-medium text-[#98a79a]">Paused</span>}</span>{checks.map((checked, day) => <label key={day} className="flex justify-center"><input type="checkbox" checked={Boolean(checked)} disabled={!habit.active || !eligible[day]} onChange={() => toggleHabit(habit.id, day)} aria-label={`${habit.title}, ${dayNames[day]}`} className="sr-only peer" /><span className="flex h-[19px] w-[19px] items-center justify-center rounded-[5px] border border-[#dae5db] bg-white text-white transition peer-checked:border-[#4ade80] peer-checked:bg-[#4ade80] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#339e5e] hover:border-[#4ade80] peer-disabled:cursor-not-allowed peer-disabled:bg-[#eef2ee]">{checked && <Icon name="check" size={12} />}</span></label>)}<div className="pl-2"><div className="mb-1 text-right text-[10px] font-bold text-[#438c59]">{progress}%</div><div className="h-[5px] overflow-hidden rounded-full bg-[#ebf2eb]"><div className="h-full rounded-full bg-[#73da92] transition-all" style={{ width: `${progress}%` }} /></div></div></div> })}
            {!habitDefinitions.length && <p className="py-7 text-center text-[11px] text-[#91a294]">No habits yet. Add your first routine to get started.</p>}
          </div></div><button type="button" onClick={() => setReviewOpen(true)} className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-[#3ca662] hover:text-[#207b44]">View long-term progress <Icon name="arrow" size={13} /></button>
        </section>}
      </div>

      <div className="mt-9"><PendingTasks items={overdue} onCarry={carryOverdue} onMove={(week, id, date) => moveTask(week, id, weekOffsetForDate(date), (date.getDay() + 6) % 7)} onDismiss={dismissTask} /></div>
      <div className="mb-5 mt-8 flex items-end justify-between gap-4"><div><div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5bac76]">DAY BY DAY</div><h2 className="text-[22px] font-bold tracking-[-0.045em]">Your weekly plan</h2></div><span className="rounded-full border border-[#e5eee7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#6e8875]">{tasks.length} tasks this week</span></div>

      <div className="overflow-x-auto pb-5">
        <div className="grid min-w-[1190px] grid-cols-7 gap-3.5 lg:gap-4">
          {dayOrder.map(index => {
            const day = dayNames[index]
            const dayTasks = tasks.filter(task => getTaskDay(task.id) === index)
            const complete = dayTasks.filter(task => task.done).length
            const dayPercent = dayTasks.length ? Math.round(complete / dayTasks.length * 100) : 0
            const date = addDays(monday, index)
            const featured = index === 2 && weekOffset === 0
            const editMode = Boolean(editModeByDay[index])

            return <section
              key={day}
              id={`day-${index}`}
              className={`flex min-h-[470px] flex-col rounded-2xl border bg-white p-3 shadow-[0_5px_18px_rgba(30,65,43,0.05)] ${featured ? 'border-[#a9e9ba]' : 'border-[#edf1ee]'}`}
              aria-label={`${day} tasks`}
              onDragOver={event => { if (event.dataTransfer.types.includes('application/x-focusflow-task')) event.preventDefault() }}
              onDrop={event => {
                const data = event.dataTransfer.getData('application/x-focusflow-task')
                if (!data) return
                event.preventDefault()
                try {
                  const { week, id } = JSON.parse(data)
                  if (Number.isInteger(week) && Number.isInteger(id)) moveTask(week, id, weekOffset, index)
                } catch {
                  // Ignore unrelated drops.
                }
              }}
            >
              <div className={`mb-3 rounded-[12px] p-3 ${featured ? 'bg-[#e5f9e9]' : 'bg-[#f5f9f5]'}`}>
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h3 className="text-[13px] font-bold text-[#283d2d]">{day}</h3>
                    <p className="mt-1 text-[10px] font-medium text-[#86a18b]">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <Ring value={dayPercent} size={31} stroke={3}><span className="text-[8px] font-bold text-[#48985f]">{dayPercent}</span></Ring>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#dcebdd] pt-2">
                  <span className="text-[10px] font-semibold text-[#5e9e6c]">Done {complete}/{dayTasks.length}</span>
                  <button
                    type="button"
                    onClick={() => setEditModeByDay(current => ({ ...current, [index]: !current[index] }))}
                    aria-label={`${editMode ? 'Exit' : 'Enter'} edit mode for ${day}`}
                    aria-pressed={editMode}
                    title={editMode ? `Finish editing ${day}` : `Edit ${day} tasks`}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] ${editMode ? 'bg-[#4ade80] text-[#164c2b]' : 'text-[#8a9a8f] hover:bg-[#e9f8ec] hover:text-[#368a52]'}`}
                  ><Icon name="edit" size={14} /></button>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {dayTasks.length === 0 && <p className="px-1 py-6 text-center text-[11px] leading-relaxed text-[#9aa99d]">A fresh page for this day.</p>}
                {dayTasks.map(task => <PlannerTaskCard
                  key={task.id}
                  task={task}
                  compact={compactCards}
                  editMode={editMode}
                  expanded={expandedTask === task.id}
                  onToggle={() => toggleTask(task.id)}
                  onToggleStar={() => toggleTaskStar(task.id)}
                  onDelete={() => dismissTask(weekOffset, task.id)}
                  onSaveTitle={title => updateTaskTitle(task.id, title)}
                  onToggleSteps={() => setExpandedTask(value => value === task.id ? null : task.id)}
                  focusMode={focusMode}
                />)}
              </div>
              <div className="mt-auto pt-3">
                {quickAddDay === index
                  ? <QuickAddTask key={`${weekOffset}-${index}`} day={day} onCancel={() => setQuickAddDay(null)} onAdd={(title, time) => addQuickTask(index, title, time)} />
                  : <button type="button" onClick={() => setQuickAddDay(index)} className="flex w-full items-center justify-center gap-1 rounded-[9px] border border-dashed border-[#d7e8da] py-2 text-[10px] font-semibold text-[#7baa85] transition hover:border-[#4ade80] hover:bg-[#f4fbf5] hover:text-[#318d52]"><Icon name="plus" size={13} /> Add task</button>}
              </div>
            </section>
          })}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#a4b0a6]">A calmer way to get things done. One day at a time.</p>
    </main>
    </div>

    <AnimatePresence>
    {modalOpen && <BreakdownModal initialDay={newDay} monday={monday} onClose={() => setModalOpen(false)} onSave={saveBreakdown} />}
    </AnimatePresence>
    <AnimatePresence>
      {trashOpen && <TrashBinModalExternal items={deletedTasks} onClose={() => setTrashOpen(false)} onRestore={restoreTask} onDelete={permanentlyDeleteTask} />}
    </AnimatePresence>
    <AnimatePresence>
      {undoItem && <motion.div role="status" className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-4 rounded-xl bg-[#20382a] px-4 py-3 text-white shadow-xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.18 }}><span className="text-[12px] font-medium">Task moved to trash</span><button type="button" onClick={undoDelete} className="text-[11px] font-bold text-[#8cf0a5] hover:text-white">Undo</button></motion.div>}
    </AnimatePresence>
    {habitModalOpen && <HabitManagementModal habits={habitDefinitions} onAdd={addHabit} onUpdate={updateHabit} onRemove={removeHabit} onReorder={reorderHabit} onClose={() => setHabitModalOpen(false)} />}
    {reviewOpen && <HabitReviewModal selectedMonday={monday} onClose={() => setReviewOpen(false)} />}
  </div>
}
