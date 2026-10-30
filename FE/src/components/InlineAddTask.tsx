import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import type { BreakdownItem } from '../types'

export function InlineTimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
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

  return (
    <>
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
            ].map(column => (
              <div key={column.part} className="min-w-0">
                <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wide text-[#91a294]">{column.label}</div>
                <div className="h-[112px] space-y-1 overflow-y-auto rounded-xl bg-[#f7faf7] p-1">
                  {column.values.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => choosePart(column.part, option)}
                      aria-pressed={column.selected === option}
                      className={`w-full rounded-lg py-1.5 text-[11px] font-semibold transition ${column.selected === option ? 'bg-[#4ade80] text-white' : 'text-[#617467] hover:bg-[#e3f8e8]'}`}
                    >{option}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#edf1ee] pt-2.5">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#78897d] transition hover:bg-[#fee2e2] hover:text-[#b94743]">Clear time</button>
            <button type="button" onClick={() => { onChange(draftTime); setOpen(false) }} aria-label="Confirm task time" title="Confirm time" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4ade80] text-white transition hover:bg-[#22c55e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#339e5e]"><Icon name="check" size={16} /></button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export function QuickAddTask({ day, onCancel, onAdd }: { day: string; onCancel: () => void; onAdd: (title: string, time: string, reminderTime?: string) => void }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('09:00')
  
  const [reminderTime, setReminderTime] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    if (reminderTime) {
      const now = new Date();
      const [rHours, rMinutes] = reminderTime.split(':').map(Number);
      const reminderDate = new Date();
      reminderDate.setHours(rHours, rMinutes, 0, 0);

      if (reminderDate < now) {
        setErrorMsg('Thời gian nhắc nhở phải ở tương lai!');
        return;
      }
    }

    setErrorMsg('');
    onAdd(title.trim(), time, reminderTime || undefined);
    setTitle('');
    setReminderTime('');
  };

  return <form onSubmit={handleSubmit}>
    <label className="mb-1.5 block px-1 text-[10px] font-bold text-[#04e8260]">{`NEW TASK - ${day.toUpperCase()}`}</label>
    <div className="w-full min-w-0 rounded-xl bg-white">
      <input autoFocus required value={title} onChange={event => { setTitle(event.target.value); if (errorMsg) setErrorMsg(''); }} placeholder="Enter task name..." className="block h-9 w-full min-w-0 rounded-lg border border-[#edf2ed] bg-[#fbfdfb] px-2 text-[11px] text-[#243c2d] outline-none focus:ring-1 focus:ring-[#4ade80]/30" />
      

      {errorMsg && <p className="mt-1 text-[10px] font-semibold text-red-500 px-1">{errorMsg}</p>}

      <div className="inline-time-picker-bar mt-1.5 flex w-full min-w-0 items-center justify-between gap-1">
        <div className="flex items-center gap-2">
      
          <InlineTimePicker value={time} onChange={setTime} />

          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span>⏰ Nhắc:</span>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="h-6 rounded border border-gray-200 bg-gray-50 px-1 text-[10px] text-gray-700 outline-none"
              title="Chọn giờ nhắc nhở"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={onCancel} aria-label="Cancel new task" title="Cancel" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Cancel</button>
          <button type="submit" aria-label="Save new task" title="Save task" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#04e8260] text-white hover:bg-[#3f6a4e]">Save</button>
        </div>
      </div>
    </div>
  </form>
}