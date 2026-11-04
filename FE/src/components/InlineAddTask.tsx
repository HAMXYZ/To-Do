import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import type { Category, TaskPriority } from '../types'
import type { QuickTaskDraft } from '../hooks/useAppData'

export function InlineTimePicker({
  value,
  onChange,
  variant = 'icon',
  placeholder = 'Time (optional)',
  className = '',
}: {
  value: string
  onChange: (time: string) => void
  variant?: 'icon' | 'field'
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draftTime, setDraftTime] = useState(value || '09:00')
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelWidth = 240
  const panelHeight = 250

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const top =
        rect.bottom + panelHeight + 8 <= window.innerHeight
          ? rect.bottom + 6
          : Math.max(8, rect.top - panelHeight - 6)
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
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
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
    setDraftTime(value || '09:00')
    setOpen((current) => !current)
  }

  function choosePart(part: 'hour' | 'minute' | 'period', selected: string) {
    const [storedHour, storedMinute] = draftTime.split(':').map(Number)
    const isPm = storedHour >= 12
    const hour12 = storedHour % 12 || 12
    const hour = part === 'hour' ? Number(selected) : hour12
    const minute = part === 'minute' ? Number(selected) : storedMinute
    const period = part === 'period' ? selected === 'PM' : isPm
    const hour24 = (hour % 12) + (period ? 12 : 0)
    setDraftTime(`${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }

  function formatTime(time: string) {
    if (!time) return ''
    const [hour, minute] = time.split(':').map(Number)
    return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${
      hour >= 12 ? 'PM' : 'AM'
    }`
  }

  const [draftHour, draftMinute] = draftTime.split(':').map(Number)
  const selectedHour = draftHour % 12 || 12
  const selectedMinute = String(Math.min(55, Math.max(0, Math.round(draftMinute / 5) * 5))).padStart(2, '0')
  const selectedPeriod = draftHour >= 12 ? 'PM' : 'AM'
  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'))

  return (
    <>
      {variant === 'icon' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={showPicker}
          aria-label={value ? `Change task time, ${formatTime(value)}` : 'Set task time'}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={value ? `Task time: ${formatTime(value)}` : 'Set task time'}
          className={`inline-time-picker-btn flex h-8 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] ${
            value || open
              ? 'bg-[#dcfce7] text-[#22703e]'
              : 'border border-[#edf2ed] bg-white text-[#718477] hover:bg-[#eaf8ee] hover:text-[#22703e]'
          } ${className}`}
        >
          <Icon name="clock" size={14} />
          {value && (
            <span className="inline-time-picker-label whitespace-nowrap text-[10px] font-semibold">
              {formatTime(value)}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={showPicker}
          aria-label={value ? `Change time, ${formatTime(value)}` : placeholder}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex h-8 w-full min-w-0 items-center justify-between rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 text-[10px] transition outline-none focus:border-[#4ade80] hover:border-[#bde8c7] ${
            value ? 'text-[#2e4736] font-semibold' : 'text-[#8fa093]'
          } ${className}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Icon name="clock" size={13} className={value ? 'text-[#35ab66]' : 'text-[#8fa093]'} />
            <span className="truncate">{value ? formatTime(value) : placeholder}</span>
          </div>
          <span className="text-[9px] text-[#8fa093] shrink-0 ml-1">▼</span>
        </button>
      )}

      {open &&
        createPortal(
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
                {
                  label: 'HOUR',
                  values: hours,
                  selected: String(selectedHour).padStart(2, '0'),
                  part: 'hour' as const,
                },
                {
                  label: 'MINUTE',
                  values: minutes,
                  selected: selectedMinute,
                  part: 'minute' as const,
                },
                {
                  label: 'AM/PM',
                  values: ['AM', 'PM'],
                  selected: selectedPeriod,
                  part: 'period' as const,
                },
              ].map((column) => (
                <div key={column.part} className="min-w-0">
                  <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#91a294]">
                    {column.label}
                  </div>
                  <div className="h-[112px] space-y-1 overflow-y-auto rounded-xl bg-[#f7faf7] p-1">
                    {column.values.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => choosePart(column.part, option)}
                        aria-pressed={column.selected === option}
                        className={`w-full rounded-lg py-1.5 text-[11px] font-semibold transition ${
                          column.selected === option
                            ? 'bg-[#4ade80] text-white'
                            : 'text-[#617467] hover:bg-[#e3f8e8]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#edf1ee] pt-2.5">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]"
              >
                Clear time
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draftTime)
                  setOpen(false)
                }}
                aria-label="Confirm task time"
                title="Confirm time"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"
              >
                <Icon name="check" size={16} />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export function CategoryPicker({
  value,
  categories,
  onChange,
}: {
  value: string
  categories: Category[]
  onChange: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 140 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const panelWidth = Math.max(rect.width, 140)
      const panelHeight = 160

      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const top =
        rect.bottom + panelHeight + 8 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - panelHeight - 4)

      setPosition({ left, top, width: panelWidth })
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
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <div
        ref={triggerRef}
        className="relative flex h-8 w-full min-w-0 items-center rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 text-[10px] text-[#52665a] transition focus-within:border-[#4ade80]"
      >
        <input
          maxLength={100}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Category (optional)"
          aria-label="Task category"
          className="w-full min-w-0 bg-transparent pr-4 text-[10px] text-[#52665a] outline-none placeholder:text-[#9aa99d]"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-1 flex h-6 w-5 items-center justify-center text-[#9aa99d] hover:text-[#52665a]"
          aria-label="Toggle category list"
        >
          <span className="text-[9px]">▼</span>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Choose category"
            className="fixed z-[100] max-h-48 overflow-y-auto rounded-xl border border-[#e2ece4] bg-white p-1 text-[#243c2d] shadow-[0_12px_36px_rgba(20,50,30,0.15)]"
            style={{ left: position.left, top: position.top, width: position.width }}
          >
            {value.trim() && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-medium text-[#c05652] hover:bg-[#fff2f1]"
              >
                ✕ Bỏ chọn danh mục
              </button>
            )}
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(category.name)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] transition ${
                  value.trim().toLowerCase() === category.name.toLowerCase()
                    ? 'bg-[#eaf8ee] font-bold text-[#23773f]'
                    : 'text-[#324b3a] hover:bg-[#f2f8f3]'
                }`}
              >
                <span>{category.name}</span>
                {value.trim().toLowerCase() === category.name.toLowerCase() && (
                  <span className="text-[10px] text-[#23773f]">✓</span>
                )}
              </button>
            ))}
            {categories.length === 0 && (
              <p className="px-2.5 py-2 text-center text-[10px] italic text-[#9aa99d]">
                Chưa có danh mục nào
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

export function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority | ''
  onChange: (val: TaskPriority | '') => void
}) {
  const [open, setOpen] = useState(false)
  const [draftPriority, setDraftPriority] = useState<TaskPriority | ''>(value)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelWidth = 148
  const panelHeight = 175

  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
      const top =
        rect.bottom + panelHeight + 8 <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - panelHeight - 4)

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
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
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
    setDraftPriority(value)
    setOpen((prev) => !prev)
  }

  const priorityLabels: Record<TaskPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={showPicker}
        aria-label={value ? `Priority: ${priorityLabels[value]}` : 'Choose priority'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-8 w-full min-w-0 items-center justify-between rounded-lg border bg-[#fbfdfb] px-2 text-[10px] transition outline-none ${
          open ? 'border-[#4ade80] ring-1 ring-[#4ade80]/30' : 'border-[#edf2ed] hover:border-[#bde8c7]'
        } ${value ? 'font-semibold text-[#243c2d]' : 'text-[#9aa99d]'}`}
      >
        <span className="truncate">{value ? priorityLabels[value] : 'Priority'}</span>
        <span className="text-[9px] text-[#8fa093] shrink-0 ml-1">▼</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose priority"
            className="fixed z-[100] w-[148px] rounded-2xl border border-[#e7eee9] bg-white p-3 text-[#243c2d] shadow-[0_16px_48px_rgba(22,52,32,0.18)]"
            style={{ left: position.left, top: position.top }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-[#385140]">Priority</span>
              <span className="text-[11px] font-semibold text-[#4c9b64]">
                {draftPriority ? priorityLabels[draftPriority] : 'None'}
              </span>
            </div>
            <div className="space-y-1 rounded-xl bg-[#f7faf7] p-1">
              {(['high', 'medium', 'low'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDraftPriority(opt)}
                  aria-pressed={draftPriority === opt}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    draftPriority === opt
                      ? 'bg-[#4ade80] text-white shadow-sm'
                      : 'text-[#617467] hover:bg-[#e3f8e8]'
                  }`}
                >
                  <span>{priorityLabels[opt]}</span>
                  <span
                    className={`text-[8px] ${
                      draftPriority === opt
                        ? 'text-white'
                        : opt === 'high'
                        ? 'text-red-500'
                        : opt === 'medium'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                    }`}
                  >
                    ●
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#edf1ee] pt-2.5">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draftPriority)
                  setOpen(false)
                }}
                aria-label="Confirm priority"
                title="Confirm priority"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"
              >
                <Icon name="check" size={16} />
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export function QuickAddTask({
  day,
  categories,
  onCancel,
  onAdd,
}: {
  day: string
  categories: Category[]
  onCancel: () => void
  onAdd: (draft: QuickTaskDraft) => Promise<boolean>
}) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('09:00')
  const [starred, setStarred] = useState(false)
  const [description, setDescription] = useState('')
  const [deadlineAt, setDeadlineAt] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [priority, setPriority] = useState<TaskPriority | ''>('')
  const [categoryName, setCategoryName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID())
  const hasPastDeadline = Boolean(deadlineAt && new Date(deadlineAt).getTime() < Date.now())

  function edit<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setValidationError('')
    if (!submitting) setClientRequestId(crypto.randomUUID())
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setValidationError('Task title is required.')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      await onAdd({
        title: cleanTitle,
        time,
        starred,
        description: description.trim(),
        deadlineAt,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        priority: priority ? priority : undefined,
        categoryName: categoryName.trim(),
        clientRequestId,
      })
    } catch {
      setValidationError('Could not save the task. Your entry is still here; try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <form onSubmit={event => { void submit(event) }} className="mt-3 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#a9e9ba] bg-white p-2 shadow-sm">
    <label className="mb-1.5 block px-1 text-[10px] font-bold text-[#4e8260]">NEW TASK · {day.toUpperCase()}</label>
    <fieldset disabled={submitting} className="min-w-0 border-0 p-0">
    <div className="w-full min-w-0 rounded-xl bg-white">
      <input autoFocus required maxLength={200} value={title} onChange={event => edit(setTitle, event.target.value)} placeholder="Enter task name..." aria-label={`Task name for ${day}`} className="block h-9 w-full min-w-0 rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 text-[11px] text-[#243c2d] outline-none placeholder:text-[#9aa99d] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30" />
      <textarea value={description} maxLength={5000} onChange={event => edit(setDescription, event.target.value)} placeholder="Description (optional)" aria-label="Task description" rows={2} className="mt-1.5 block w-full resize-y rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 py-1.5 text-[11px] text-[#243c2d] outline-none placeholder:text-[#9aa99d] focus:border-[#4ade80] focus:ring-1 focus:ring-[#4ade80]/30" />
      <div className="mt-1.5 space-y-1.5">
        <CategoryPicker value={categoryName} categories={categories} onChange={val => edit(setCategoryName, val)} />
        <div className="grid grid-cols-2 gap-1.5">
          <PriorityPicker value={priority} onChange={val => edit(setPriority, val)} />
          <input
            type="number"
            min={1}
            max={1440}
            step={1}
            value={estimatedMinutes}
            onChange={event => edit(setEstimatedMinutes, event.target.value)}
            placeholder="Minutes"
            aria-label="Estimated minutes"
            className="h-8 min-w-0 rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 text-[10px] text-[#52665a] outline-none placeholder:text-[#9aa99d] focus:border-[#4ade80]"
          />
        </div>
      </div>
      {hasPastDeadline && <p role="status" className="mt-1 px-1 text-[10px] text-amber-700">This deadline is in the past. The task will be marked overdue until you reschedule it.</p>}
      {validationError && <p role="alert" className="mt-1 px-1 text-[10px] text-[#b94743]">{validationError}</p>}
      <div className="inline-time-picker-bar mt-1.5 flex w-full min-w-0 items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <InlineTimePicker value={time} onChange={value => edit(setTime, value)} />
          <button
            type="button"
            onClick={() => edit(setStarred, !starred)}
            aria-label={starred ? 'Remove star from new task' : 'Star new task'}
            aria-pressed={starred}
            title={starred ? 'Starred task' : 'Star this task'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${starred ? 'bg-[#fff7e0] text-[#f59e0b]' : 'text-[#b5c2b7] hover:bg-[#fff9eb] hover:text-[#f59e0b]'}`}
          >
            <Icon name="star" size={14} className={starred ? 'fill-current' : ''} />
          </button>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={onCancel} disabled={submitting} aria-label="Cancel new task" title="Cancel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#829087] transition hover:bg-[#fff0ef] hover:text-[#b94743] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"><Icon name="close" size={15} /></button>
          <button type="submit" disabled={submitting} aria-label="Save new task" title="Save task" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4ade80] text-white transition hover:bg-[#22c55e] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"><Icon name={submitting ? 'clock' : 'check'} size={16} /></button>
        </div>
      </div>
    </div>
    </fieldset>
  </form>
}
