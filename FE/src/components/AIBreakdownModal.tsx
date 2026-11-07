import React, { useEffect, useRef, useState } from "react"
import Icon from "./Icon"
import { InlineTimePicker } from "./InlineAddTask"
import * as api from "../api"
import {
  EXAMPLE_BREAKDOWN_PROMPT,
  TITLE_MAX_LEN,
  makeBreakdown,
  parsePromptMetadata,
  suggestBreakdownPriorities,
  validateBreakdownItems,
  validateBreakdownPrompt,
  type BreakdownItem,
} from "../utils/aiBreakdown"

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export type ExtendedBreakdownItem = BreakdownItem

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function dateForInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null
  for (const key of [
    "token",
    "access_token",
    "focusflow_token",
    "auth_token",
  ]) {
    const val = window.localStorage.getItem(key)
    if (val) return val
  }
  return null
}

function formatDeadlineDisplay(dateStr: string) {
  if (!dateStr) return "Chọn ngày"
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3) return dateStr
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
  const dayIndex = (dateObj.getDay() + 6) % 7
  const dayLabel = dayNames[dayIndex] || ""
  const dd = String(dateObj.getDate()).padStart(2, "0")
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0")
  const yyyy = dateObj.getFullYear()
  return `${dayLabel}, ${dd}/${mm}/${yyyy}`
}

function BreakdownDatePickerPopover({
  value,
  minDate,
  onChange,
  onClose,
}: {
  value: string
  minDate: Date
  onChange: (val: string) => void
  onClose: () => void
}) {
  const parts = value.split("-").map(Number)
  const initialDate =
    parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cleanMin = new Date(minDate)
  cleanMin.setHours(0, 0, 0, 0)

  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ]
  const dayHeaders = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const startingDay = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const days: { date: Date; currentMonth: boolean }[] = []
  for (let i = startingDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i),
      currentMonth: false,
    })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: new Date(viewYear, viewMonth, d),
      currentMonth: true,
    })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: new Date(viewYear, viewMonth + 1, d),
      currentMonth: false,
    })
  }

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Chọn ngày hoàn thành"
      className="absolute left-0 top-[calc(100%+8px)] z-50 w-[290px] rounded-2xl border border-[#e5ede7] bg-white p-3.5 text-[#253d2e] shadow-[0_16px_45px_rgba(21,51,31,0.18)]"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-[#274431]">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Tháng trước"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#667c6c] transition hover:bg-[#edf9ef] hover:text-[#27844b]"
          >
            <Icon name="chevronLeft" size={13} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Tháng sau"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#667c6c] transition hover:bg-[#edf9ef] hover:text-[#27844b]"
          >
            <Icon name="chevronRight" size={13} />
          </button>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 text-center">
        {dayHeaders.map((dh) => (
          <span
            key={dh}
            className="text-[10px] font-bold uppercase text-[#8fa093]"
          >
            {dh}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          const itemDate = new Date(item.date)
          itemDate.setHours(0, 0, 0, 0)
          const isPast = itemDate < cleanMin
          const isToday = isSameDay(item.date, today)
          const isSelected = isSameDay(item.date, initialDate)

          return (
            <button
              key={idx}
              type="button"
              disabled={isPast}
              onClick={() => {
                if (!isPast) {
                  onChange(dateForInput(item.date))
                  onClose()
                }
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-medium transition ${
                isSelected
                  ? "bg-[#4ade80] font-bold text-[#144727] shadow-sm"
                  : isPast
                    ? "cursor-not-allowed text-[#d5ded7] opacity-40"
                    : isToday
                      ? "border border-[#4ade80] font-bold text-[#237744] hover:bg-[#dcfce7]"
                      : item.currentMonth
                        ? "text-[#253d2e] hover:bg-[#edf9ef]"
                        : "text-[#c2cec5] hover:bg-[#f6faf7]"
              }`}
            >
              {item.date.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#eef2ef] px-1 pt-2.5 text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => {
            onChange(dateForInput(today))
            onClose()
          }}
          className="text-[#2ca258] transition hover:underline"
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[#849688] transition hover:text-[#e11d48]"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}

export interface AIBreakdownModalProps {
  initialDay?: number
  monday?: Date
  onClose?: () => void
  onSave?: (items: ExtendedBreakdownItem[]) => Promise<boolean> | void
}

export function AIBreakdownModal({
  initialDay = 0,
  monday = new Date(),
  onClose = () => {},
  onSave = async () => true,
}: AIBreakdownModalProps) {
  const safeInitialDay = Math.max(0, Math.min(6, initialDay))
  const defaultDeadlineDay = Math.min(safeInitialDay + 3, 6)

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [deadline, setDeadline] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const def = addDays(monday, defaultDeadlineDay)
    return dateForInput(def < today ? today : def)
  })
  const [dueTime, setDueTime] = useState("16:00")
  const [items, setItems] = useState<ExtendedBreakdownItem[]>([])
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [newStepTitle, setNewStepTitle] = useState("")
  const [promptError, setPromptError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [invalidStepId, setInvalidStepId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [voiceMessage, setVoiceMessage] = useState("")
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, isSaving])

  function getDeadlineDayIndex(dateValue: string) {
    if (!dateValue) return safeInitialDay
    const parts = dateValue.split("-").map(Number)
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      return (d.getDay() + 6) % 7
    }
    return safeInitialDay
  }

  function startVoiceEntry() {
    const win = window as typeof window & {
      SpeechRecognition?: any
      webkitSpeechRecognition?: any
    }
    const SpeechRecognition =
      win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceMessage(
        "Trình duyệt không hỗ trợ nhập giọng nói. Vui lòng nhập văn bản.",
      )
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = "vi-VN"
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setPrompt(transcript)
      setPromptError(null)
      setVoiceMessage(
        'Đã nhận giọng nói. Bấm "Xác nhận & Phân rã công việc" để tạo các bước.',
      )
    }
    recognition.onerror = (event: any) => {
      setIsListening(false)
      if (event?.error === "network") {
        setVoiceMessage(
          "Dịch vụ giọng nói Google bị chặn mạng trong Electron Desktop. Bạn có thể mở web trên Chrome để nói hoặc gõ văn bản.",
        )
      } else {
        setVoiceMessage(
          "Không nhận diện được giọng nói. Vui lòng thử lại hoặc gõ trực tiếp.",
        )
      }
    }
    recognition.onend = () => setIsListening(false)
    try {
      recognition.start()
      setIsListening(true)
      setVoiceMessage("Đang nghe... hãy đọc mô tả công việc của bạn.")
    } catch {
      setVoiceMessage("Không thể bật micro. Vui lòng nhập văn bản.")
    }
  }

  async function handleGenerateBreakdown() {
    setSaveError(null)
    const todayStr = dateForInput(new Date())
    const hasPast = items.some(
      (item) => dateForInput(addDays(monday, item.day)) < todayStr,
    )
    if (hasPast) {
      setSaveError(
        "Không thể lưu các bước công việc cho ngày đã qua trong quá khứ. Vui lòng chuyển các bước sang ngày hôm nay hoặc tương lai.",
      )
      return
    }

    setInvalidStepId(null)
    const validationErr = validateBreakdownPrompt(prompt)
    if (validationErr) {
      setPromptError(validationErr)
      return
    }
    setPromptError(null)

    const { inferredDay, inferredTime } = parsePromptMetadata(prompt)
    let targetDeadlineDay = getDeadlineDayIndex(deadline)
    if (inferredDay !== null && inferredDay >= safeInitialDay) {
      targetDeadlineDay = inferredDay
      setDeadline(dateForInput(addDays(monday, inferredDay)))
    }
    const targetTime = inferredTime ?? dueTime
    if (inferredTime) {
      setDueTime(inferredTime)
    }

    setIsGenerating(true)
    try {
      let generated: ExtendedBreakdownItem[] | null = null
      let detectedProvider: string | null = null

      if (typeof (api as any).previewBreakdown === "function") {
        try {
          const data = await (api as any).previewBreakdown({
            prompt: prompt.trim(),
            start_day: safeInitialDay,
            deadline_day: targetDeadlineDay,
            due_time: targetTime || null,
          })
          if (Array.isArray(data?.items) && data.items.length > 0) {
            detectedProvider = data.provider || "Google Gemini AI"
            generated = data.items.map((it: any, index: number) => ({
              id: Number(it.id ?? index + 1),
              title: String(it.title ?? ""),
              day: Number(it.day ?? safeInitialDay),
              time: String(it.time ?? ""),
              starred: Boolean(it.is_starred ?? it.starred),
              priorityReason:
                it.priority_reason ?? it.priorityReason ?? undefined,
            }))
          }
        } catch {
          // Tiếp tục thử gọi trực tiếp fetch bên dưới
        }
      }

      if (!generated) {
        const envUrl =
          typeof import.meta !== "undefined" &&
          (import.meta as any).env?.VITE_API_URL
            ? String((import.meta as any).env.VITE_API_URL).replace(/\/+$/, "")
            : "http://localhost:8000"
        const token = getStoredAuthToken()

        if (token) {
          const res = await fetch(`${envUrl}/ai/breakdown`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              start_day: safeInitialDay,
              deadline_day: targetDeadlineDay,
              due_time: targetTime || null,
            }),
          })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data?.items) && data.items.length > 0) {
              detectedProvider = data.provider || "Google Gemini AI"
              generated = data.items.map((it: any, index: number) => ({
                id: Number(it.id ?? index + 1),
                title: String(it.title ?? ""),
                day: Number(it.day ?? safeInitialDay),
                time: String(it.time ?? ""),
                starred: Boolean(it.is_starred ?? it.starred),
                priorityReason:
                  it.priority_reason ?? it.priorityReason ?? undefined,
              }))
            }
          }
        }
      }

      if (!generated) {
        generated = makeBreakdown(
          prompt,
          safeInitialDay,
          targetDeadlineDay,
          targetTime,
        )
        detectedProvider = "Gemini Hybrid Fallback"
      }

      setAiProvider(detectedProvider)
      setItems(generated)
      setHasGenerated(true)
    } catch {
      const fallback = makeBreakdown(
        prompt,
        safeInitialDay,
        targetDeadlineDay,
        targetTime,
      )
      setAiProvider("Gemini Hybrid Fallback")
      setItems(fallback)
      setHasGenerated(true)
    } finally {
      setIsGenerating(false)
    }
  }

  function updateItem(id: number, changes: Partial<ExtendedBreakdownItem>) {
    setSaveError(null)
    if (invalidStepId === id) setInvalidStepId(null)
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
  }

  function updateDeadline(value: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = dateForInput(today)
    const safeVal = value < todayStr ? todayStr : value
    setDeadline(safeVal)
    const day = getDeadlineDayIndex(safeVal)
    if (items.length > 0) {
      setItems((current) =>
        current.map((item, index) =>
          index === current.length - 1 ? { ...item, day } : item,
        ),
      )
    }
  }

  function updateDueTime(value: string) {
    setDueTime(value)
    if (items.length > 0) {
      setItems((current) =>
        current.map((item, index) =>
          index === current.length - 1 ? { ...item, time: value } : item,
        ),
      )
    }
  }

  function handleAddQuickStep() {
    setSaveError(null)
    const titleToAdd =
      newStepTitle.trim() || `Bước công việc ${items.length + 1}`
    if (titleToAdd.length > TITLE_MAX_LEN) {
      setSaveError(`Tiêu đề bước không được vượt quá ${TITLE_MAX_LEN} ký tự.`)
      return
    }
    const nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1
    const lastDay = items.length ? items[items.length - 1].day : safeInitialDay
    setItems((current) => [
      ...current,
      {
        id: nextId,
        title: titleToAdd,
        day: lastDay,
        time: dueTime || "10:00",
        starred: false,
      },
    ])
    setNewStepTitle("")
    setHasGenerated(true)
  }

  function handleSuggestPriorities() {
    setSaveError(null)
    setItems((current) => suggestBreakdownPriorities(current))
  }

  async function handleConfirmSave() {
    setPromptError(null)
    setSaveError(null)

    const check = validateBreakdownItems(items)
    if (!check.valid) {
      setSaveError(check.error)
      setInvalidStepId(check.invalidStepId)
      if (check.invalidStepId !== null) {
        document.getElementById(`step-title-${check.invalidStepId}`)?.focus()
      }
      return
    }

    const todayStr = dateForInput(new Date())
    const hasPast = items.some(
      (item) => dateForInput(addDays(monday, item.day)) < todayStr,
    )
    if (hasPast) {
      setSaveError(
        "Không thể lưu các bước công việc cho ngày đã qua trong quá khứ. Vui lòng chuyển các bước sang ngày hôm nay hoặc tương lai.",
      )
      return
    }

    setInvalidStepId(null)
    setIsSaving(true)
    try {
      const cleaned = items.map((item) => ({
        ...item,
        title: item.title.trim(),
        time: item.time.trim(),
        starred: Boolean(item.starred),
      }))
      const result = await onSave(cleaned)
      if (result === false) {
        setSaveError(
          "Không thể lưu các bước vào lịch tuần. Dữ liệu bạn chỉnh sửa vẫn được giữ nguyên — vui lòng thử lại.",
        )
      }
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Lỗi kết nối khi lưu công việc. Vui lòng thử lại.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const starredCount = items.filter((i) => i.starred).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onMouseDown={() => {
          if (!isSaving) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="breakdown-title"
        className="relative z-10 my-auto flex max-h-[calc(100dvh-32px)] w-full max-w-[650px] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(9,37,21,0.28)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#ecf1eb] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#e5f8e9] text-[#2eae60]">
              <Icon name="sparkle" size={23} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#66b97d]">
                  AI TASK BREAKDOWN & PRIORITY
                </span>
                {aiProvider && (
                  <span className="rounded-full bg-[#e6f7eb] px-2 py-0.5 text-[9px] font-bold text-[#257a42]">
                    {aiProvider}
                  </span>
                )}
              </div>
              <h2
                id="breakdown-title"
                className="text-[21px] font-bold tracking-[-0.045em] text-[#1b3325] sm:text-[23px]"
              >
                Phân rã công việc & Đề xuất ưu tiên
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8b9b8e]">
                Nhập mục tiêu lớn của bạn, bấm xác nhận phân rã để tạo các bước
                nhỏ và lưu vào lịch tuần.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Close task breakdown"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#e9eee9] text-[#77897b] transition hover:bg-[#f4f8f4] hover:text-[#2e573a] disabled:opacity-50"
          >
            <Icon name="close" size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="mb-2.5 flex items-center justify-between">
            <label
              htmlFor="task-prompt"
              className="text-[12px] font-bold text-[#344c3b]"
            >
              Nhập công việc cần phân rã
            </label>
            <button
              type="button"
              onClick={() => {
                setPrompt(EXAMPLE_BREAKDOWN_PROMPT)
                setPromptError(null)
              }}
              className="text-[11px] font-semibold text-[#319653] hover:underline"
            >
              Dùng mẫu thử
            </button>
          </div>

          <div
            className={`relative rounded-[14px] border bg-[#fbfdf9] transition focus-within:ring-[3px] ${
              promptError
                ? "border-[#e07a74] focus-within:border-[#d65750] focus-within:ring-[#f87171]/15"
                : "border-[#dfeae0] focus-within:border-[#67d78a] focus-within:ring-[#4ade80]/10"
            }`}
          >
            <textarea
              id="task-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                if (promptError) setPromptError(null)
              }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault()
                  void handleGenerateBreakdown()
                }
              }}
              placeholder="Ví dụ: Chuẩn bị bài thuyết trình doanh thu Quý 3, hạn Thứ Sáu 16:00..."
              rows={2}
              className="w-full resize-none bg-transparent px-4 pb-12 pt-3.5 text-[13px] font-medium leading-relaxed text-[#38503e] outline-none placeholder:text-[#a6b2a5]"
            />
            <div className="absolute bottom-2.5 left-3.5 right-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={startVoiceEntry}
                disabled={isListening}
                aria-label={
                  isListening ? "Listening for voice input" : "Use voice input"
                }
                title="Nhập bằng giọng nói"
                className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#e8f8ec] text-[#39ad64] transition hover:bg-[#d9f3e0] disabled:opacity-60"
              >
                <Icon name="mic" size={16} />
              </button>

              <button
                type="button"
                onClick={() => void handleGenerateBreakdown()}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-[10px] bg-[#2eae60] px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#259650] disabled:opacity-60"
              >
                <Icon name="sparkle" size={14} />
                {isGenerating
                  ? "Đang gọi AI phân rã..."
                  : hasGenerated
                    ? "Phân rã lại công việc"
                    : "Xác nhận & Phân rã công việc"}
              </button>
            </div>
          </div>

          {promptError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-[#fff2f1] px-3 py-2 text-[11px] font-semibold text-[#c54b45]"
            >
              {promptError}
            </p>
          )}
          {voiceMessage && (
            <p role="status" className="mt-2 text-[11px] text-[#718b78]">
              {voiceMessage}
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="relative">
              <span className="mb-1.5 block text-[11px] font-bold text-[#344c3b]">
                Ngày hoàn thành mục tiêu
              </span>
              <button
                type="button"
                onClick={() => setCalendarOpen((prev) => !prev)}
                className="flex h-10 w-full items-center justify-between rounded-[10px] border border-[#dfeae0] bg-[#fbfdf9] px-3 text-[12px] font-semibold text-[#274431] shadow-sm transition hover:border-[#4ade80] focus:border-[#4ade80] focus:outline-none"
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon
                    name="calendar"
                    size={15}
                    className="shrink-0 text-[#34aa65]"
                  />
                  <span className="truncate">
                    {formatDeadlineDisplay(deadline)}
                  </span>
                </div>
                <Icon
                  name="chevronDown"
                  size={13}
                  className={`shrink-0 text-[#7f9684] transition-transform ${
                    calendarOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {calendarOpen && (
                <BreakdownDatePickerPopover
                  value={deadline}
                  minDate={new Date()}
                  onChange={(val) => updateDeadline(val)}
                  onClose={() => setCalendarOpen(false)}
                />
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-bold text-[#344c3b]">
                Mốc giờ hạn chót (HH:mm)
              </span>
              <InlineTimePicker
                value={dueTime}
                onChange={(val) => updateDueTime(val)}
                variant="field"
                placeholder="16:00"
                className="!h-10 !rounded-[10px] !border-[#dfeae0] !bg-[#fbfdf9] !px-3 !text-[12px] shadow-sm hover:!border-[#4ade80]"
              />
            </div>
          </div>

          <div className="mt-5 rounded-[16px] border border-[#e8f1e9] bg-[#f6faf6] p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <Icon name="sparkle" size={16} className="text-[#48bf72]" />
                <h3 className="text-[12px] font-bold text-[#31513b]">
                  Danh sách các bước phân rã ({items.length})
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSuggestPriorities}
                    className="inline-flex items-center gap-1 rounded-full border border-[#f5d88c] bg-[#fff9e8] px-2.5 py-1 text-[10px] font-bold text-[#a37014] transition hover:bg-[#fef2cf]"
                  >
                    <Icon
                      name="star"
                      size={11}
                      className="fill-current text-[#f59e0b]"
                    />
                    AI Gợi ý ưu tiên ({starredCount} ⭐)
                  </button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#cfe2d2] bg-white px-4 py-7 text-center">
                <p className="text-[13px] font-bold text-[#2f4b38]">
                  Chưa có bước phân rã nào
                </p>
                <p className="mt-1 text-[11px] text-[#7c9081]">
                  Hãy nhập công việc ở ô phía trên và bấm{" "}
                  <strong>
                    &ldquo;Xác nhận &amp; Phân rã công việc&rdquo;
                  </strong>
                  , hoặc tự thêm bước ở bên dưới.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  const isInvalid =
                    invalidStepId === item.id || !item.title.trim()
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2.5 rounded-[11px] border bg-white p-3 shadow-[0_2px_8px_rgba(35,77,42,0.035)] sm:gap-3 sm:p-3.5 ${
                        isInvalid
                          ? "border-[#e88c86]"
                          : item.starred
                            ? "border-[#f4d788]"
                            : "border-[#e8efe8]"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#edf9ef] text-[11px] font-bold text-[#43a965]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          id={`step-title-${item.id}`}
                          value={item.title}
                          onChange={(event) =>
                            updateItem(item.id, { title: event.target.value })
                          }
                          placeholder="Nhập tên bước công việc..."
                          className={`w-full rounded-md border bg-transparent px-2 py-1 text-[12px] font-semibold text-[#34483a] outline-none sm:text-[13px] ${
                            isInvalid
                              ? "border-[#e07a74] bg-[#fff8f7] focus:border-[#d65750]"
                              : "border-transparent hover:border-[#d9e9dd] focus:border-[#4ade80]"
                          }`}
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={item.day}
                            onChange={(event) =>
                              updateItem(item.id, {
                                day: Number(event.target.value),
                              })
                            }
                            className="max-w-[125px] rounded-lg border border-[#dcebdd] bg-[#f1faf2] px-2 py-1 text-[10px] font-bold text-[#4d9a60] outline-none focus:border-[#4ade80]"
                          >
                            {dayNames.map((day, dayIndex) => {
                              const isDayPast =
                                dateForInput(addDays(monday, dayIndex)) <
                                dateForInput(new Date())
                              return (
                                <option
                                  key={day}
                                  value={dayIndex}
                                  disabled={isDayPast}
                                  className={isDayPast ? "text-[#a2afa5]" : ""}
                                >
                                  {day} {isDayPast ? "(Đã qua)" : ""}
                                </option>
                              )
                            })}
                          </select>
                          <label className="flex items-center gap-1 rounded-lg border border-[#dcebdd] bg-[#f8fcf8] px-2 py-1 text-[#75a783]">
                            <Icon name="clock" size={12} />
                            <input
                              type="time"
                              value={item.time}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  time: event.target.value,
                                })
                              }
                              className="w-[85px] bg-transparent text-[10px] font-bold text-[#4d9a60] outline-none"
                            />
                          </label>
                          {item.time && (
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { time: "" })}
                              className="rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-[#8a9b8e] hover:bg-[#fee2e2] hover:text-[#b94743]"
                            >
                              Xóa giờ
                            </button>
                          )}
                        </div>
                        {item.starred && item.priorityReason && (
                          <p className="flex items-center gap-1 text-[10px] font-medium text-[#b57c17]">
                            <Icon
                              name="star"
                              size={11}
                              className="shrink-0 fill-current text-[#f59e0b]"
                            />
                            <span>Đề xuất ưu tiên: {item.priorityReason}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1 border-l border-[#edf1ec] pl-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, { starred: !item.starred })
                          }
                          title={
                            item.starred
                              ? "Bỏ dấu sao ưu tiên"
                              : "Đánh dấu sao ưu tiên (⭐)"
                          }
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                            item.starred
                              ? "bg-[#fff7e0] text-[#f59e0b]"
                              : "text-[#b5c2b7] hover:bg-[#fff9eb] hover:text-[#f59e0b]"
                          }`}
                        >
                          <Icon
                            name="star"
                            size={14}
                            className={item.starred ? "fill-current" : ""}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById(`step-title-${item.id}`)
                              ?.focus()
                          }
                          title="Sửa tiêu đề bước"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#95a79a] hover:bg-[#eef8ef] hover:text-[#319454]"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSaveError(null)
                            setItems((current) =>
                              current.filter((step) => step.id !== item.id),
                            )
                          }}
                          title="Xóa bước này"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a2aea4] hover:bg-[#fff0ef] hover:text-[#cb706b]"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddQuickStep()
                  }
                }}
                placeholder="Nhập thêm bước công việc thủ công..."
                className="flex-1 rounded-lg border border-[#dcebdd] bg-white px-3 py-1.5 text-[12px] text-[#34483a] outline-none focus:border-[#4ade80]"
              />
              <button
                type="button"
                onClick={handleAddQuickStep}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[#e7f7eb] px-3 py-1.5 text-[11px] font-bold text-[#277a43] transition hover:bg-[#d5f0dc]"
              >
                <Icon name="plus" size={13} /> Thêm bước
              </button>
            </div>
          </div>

          {saveError && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-[#f5c2bf] bg-[#fff2f1] px-3.5 py-2.5 text-[11px] font-semibold text-[#bf433d]"
            >
              {saveError}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#ecf1eb] bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-[10px] border border-[#e3eae4] bg-white px-4 py-2.5 text-[12px] font-bold text-[#617467] transition hover:bg-[#f5f8f5] disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmSave()}
            disabled={isSaving || items.length === 0}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-[#4ade80] px-4 py-2.5 text-[12px] font-bold text-[#174f2e] shadow-[0_5px_12px_rgba(74,222,128,0.2)] transition hover:bg-[#37d973] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="check" size={15} />
            {isSaving
              ? "Đang lưu..."
              : `Xác nhận lưu vào lịch tuần (${items.length} bước)`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIBreakdownModal
