import type {
  Task,
  BreakdownItem,
  PrioritySuggestion,
  PrioritySuggestionBundle,
} from "../types"

export type {
  Task,
  BreakdownItem,
  PrioritySuggestion,
  PrioritySuggestionBundle,
}

export const EXAMPLE_BREAKDOWN_PROMPT =
  "Chuẩn bị bài thuyết trình doanh thu Quý 3, Hạn: Thứ Sáu 16:00"
export const TITLE_MAX_LEN = 200
export const PROMPT_MAX_LEN = 500
export const BULK_MAX_ITEMS = 50

const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const PRIORITY_KEYWORD_RE =
  /\b(deadline|urgent|asap|submit|present|presentation|pitch|exam|test|quiz|client|deploy|release|fix|bug|critical|important|review|report|final|báo cáo|nộp|họp|thi|kiểm tra|thuyết trình|khẩn|gấp|quan trọng|chốt)\b/i

export const PROTOTYPE_BREAKDOWN_NOTICE = ""
export const PROTOTYPE_PRIORITY_NOTICE = ""

export function validateBreakdownPrompt(prompt: string): string | null {
  const trimmed = prompt.trim()
  if (!trimmed) {
    return "Vui lòng nhập mô tả công việc trước khi phân rã (không được để trống)."
  }
  if (trimmed.length < 3) {
    return "Mô tả công việc quá ngắn (vui lòng nhập ít nhất 3 ký tự)."
  }
  if (trimmed.length > PROMPT_MAX_LEN) {
    return `Mô tả công việc không được vượt quá ${PROMPT_MAX_LEN} ký tự.`
  }
  return null
}

export function parsePromptMetadata(
  prompt: string,
): {
  topic: string
  inferredDay: number | null
  inferredTime: string | null
} {
  const topicRaw =
    prompt.split(/,|\bdeadline\s*:|\bhạn\s*:|\bdue\s*:/i)[0]?.trim() ||
    prompt.trim()
  const topic = topicRaw.slice(0, TITLE_MAX_LEN) || "công việc của bạn"

  const dayPatterns: [RegExp, number][] = [
    [/\b(mon(day)?|thứ\s*(2|hai))\b/i, 0],
    [/\b(tue(sday)?|thứ\s*(3|ba))\b/i, 1],
    [/\b(wed(nesday)?|thứ\s*(4|tư))\b/i, 2],
    [/\b(thu(rsday)?|thứ\s*(5|năm))\b/i, 3],
    [/\b(fri(day)?|thứ\s*(6|sáu))\b/i, 4],
    [/\b(sat(urday)?|thứ\s*(7|bảy))\b/i, 5],
    [/\b(sun(day)?|chủ\s*nhật|cn)\b/i, 6],
  ]
  let inferredDay: number | null = null
  for (const [re, d] of dayPatterns) {
    if (re.test(prompt)) {
      inferredDay = d
      break
    }
  }

  let inferredTime: string | null = null
  const match12 = prompt.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i)
  const match24 = prompt.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)
  if (match12) {
    const rawHour = Number(match12[1])
    const minute = match12[2] ?? "00"
    const isPm = match12[3].toLowerCase() === "pm"
    const hour24 = (rawHour % 12) + (isPm ? 12 : 0)
    inferredTime = `${String(hour24).padStart(2, "0")}:${minute}`
  } else if (match24) {
    inferredTime = `${match24[1]}:${match24[2]}`
  }

  return { topic, inferredDay, inferredTime }
}

export function makeBreakdown(
  prompt: string,
  firstDay: number,
  deadlineDay?: number,
  dueTime = "16:00",
): BreakdownItem[] {
  const { topic } = parsePromptMetadata(prompt)
  const startDay = Math.max(0, Math.min(6, firstDay))
  const endDay = Math.max(
    startDay,
    Math.min(6, deadlineDay ?? Math.min(startDay + 3, 6)),
  )
  const finalTime = dueTime && TIME_24H_RE.test(dueTime) ? dueTime : "16:00"

  const segments = prompt
    .split(/\n|;|•|-|\b(?:bước|step)\s*\d+\s*[:.)]/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)

  interface StepTemplate {
    title: string
    time: string
    starred: boolean
    priorityReason?: string
  }

  let templates: StepTemplate[]
  if (segments.length >= 2) {
    templates = segments.slice(0, 8).map((seg, idx, arr) => ({
      title: seg.slice(0, TITLE_MAX_LEN),
      time: idx === arr.length - 1 ? finalTime : idx === 0 ? "09:00" : "14:00",
      starred: idx === 0 || idx === arr.length - 1,
      priorityReason:
        idx === 0
          ? "Bước khởi đầu quan trọng"
          : idx === arr.length - 1
            ? "Bước hoàn thiện trước hạn chót"
            : undefined,
    }))
  } else if (
    /present|slide|pitch|revenue|deck|thuyết trình|báo cáo/i.test(topic)
  ) {
    templates = [
      {
        title: `Thu thập dữ liệu & số liệu cho "${topic}"`,
        time: "09:30",
        starred: true,
        priorityReason: "Bước nền tảng — cần chuẩn bị dữ liệu đầu tiên",
      },
      {
        title: `Phân tích nội dung trọng tâm của "${topic}"`,
        time: "10:30",
        starred: false,
      },
      {
        title: `Thiết kế bố cục slide & trực quan hóa "${topic}"`,
        time: "14:00",
        starred: false,
      },
      {
        title: `Rà soát & tổng duyệt "${topic}"`,
        time: finalTime,
        starred: true,
        priorityReason: "Bước chốt kết quả trước deadline",
      },
    ]
  } else if (
    /code|api|bug|feature|backend|frontend|app|website|test|deploy|lập trình|phần mềm/i.test(
      topic,
    )
  ) {
    templates = [
      {
        title: `Phân tích yêu cầu & thiết kế kỹ thuật cho "${topic}"`,
        time: "09:00",
        starred: true,
        priorityReason: "Làm rõ phạm vi trước khi code",
      },
      {
        title: `Xây dựng xử lý logic chính cho "${topic}"`,
        time: "10:30",
        starred: false,
      },
      {
        title: "Viết kiểm thử (test) & kiểm tra trường hợp biên",
        time: "14:00",
        starred: false,
      },
      {
        title: `Hoàn thiện & bàn giao "${topic}"`,
        time: finalTime,
        starred: true,
        priorityReason: "Kiểm tra lần cuối trước hạn",
      },
    ]
  } else if (
    /study|exam|learn|course|read|research|ôn tập|thi|học|nghiên cứu/i.test(
      topic,
    )
  ) {
    templates = [
      {
        title: `Tổng hợp tài liệu & đề cương "${topic}"`,
        time: "09:00",
        starred: true,
        priorityReason: "Bước chuẩn bị cốt lõi",
      },
      {
        title: `Tóm tắt các kiến thức trọng tâm của "${topic}"`,
        time: "10:30",
        starred: false,
      },
      {
        title: "Làm bài tập vận dụng & ghi nhớ chủ động",
        time: "14:30",
        starred: false,
      },
      {
        title: `Tổng ôn tập & tự kiểm tra "${topic}"`,
        time: finalTime,
        starred: true,
        priorityReason: "Hoàn tất trước giờ hạn chót",
      },
    ]
  } else {
    templates = [
      {
        title: `Chuẩn bị tài liệu & xác định mục tiêu cho "${topic}"`,
        time: "09:30",
        starred: true,
        priorityReason: "Bước mở đầu cần ưu tiên thực hiện trước",
      },
      {
        title: `Lập dàn ý chi tiết các hạng mục của "${topic}"`,
        time: "10:30",
        starred: false,
      },
      {
        title: `Triển khai thực hiện nội dung chính "${topic}"`,
        time: "14:00",
        starred: false,
      },
      {
        title: `Kiểm tra chất lượng & hoàn tất "${topic}"`,
        time: finalTime,
        starred: true,
        priorityReason: "Bước hoàn thiện cuối cùng theo hạn chót",
      },
    ]
  }

  const span = Math.max(0, endDay - startDay)
  const count = templates.length
  return templates.map((tpl, index) => {
    const isLast = index === count - 1
    const day = isLast
      ? endDay
      : span > 0
        ? Math.min(
            6,
            startDay + Math.round((index * span) / Math.max(1, count - 1)),
          )
        : Math.min(6, startDay + index)
    return {
      id: index + 1,
      title: tpl.title.slice(0, TITLE_MAX_LEN),
      day,
      time: isLast ? finalTime : tpl.time,
      starred: tpl.starred,
      priorityReason: tpl.priorityReason,
    }
  })
}

export function validateBreakdownItems(
  items: BreakdownItem[],
): {
  valid: boolean
  error: string | null
  invalidStepId: number | null
} {
  if (!items.length) {
    return {
      valid: false,
      error:
        "Vui lòng tạo hoặc thêm ít nhất 1 bước công việc trước khi xác nhận lưu.",
      invalidStepId: null,
    }
  }
  if (items.length > BULK_MAX_ITEMS) {
    return {
      valid: false,
      error: `Chỉ có thể lưu tối đa ${BULK_MAX_ITEMS} bước cùng lúc.`,
      invalidStepId: null,
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const stepNum = i + 1
    const title = item.title.trim()
    if (!title) {
      return {
        valid: false,
        error: `Bước ${String(stepNum).padStart(2, "0")} đang để trống tiêu đề. Vui lòng nhập nội dung hoặc xóa bước này.`,
        invalidStepId: item.id,
      }
    }
    if (title.length > TITLE_MAX_LEN) {
      return {
        valid: false,
        error: `Bước ${String(stepNum).padStart(2, "0")} vượt quá ${TITLE_MAX_LEN} ký tự.`,
        invalidStepId: item.id,
      }
    }
    if (!Number.isInteger(item.day) || item.day < 0 || item.day > 6) {
      return {
        valid: false,
        error: `Bước ${String(stepNum).padStart(2, "0")} có ngày không hợp lệ.`,
        invalidStepId: item.id,
      }
    }
    const time = item.time.trim()
    if (time !== "" && !TIME_24H_RE.test(time)) {
      return {
        valid: false,
        error: `Bước ${String(stepNum).padStart(2, "0")} có định dạng giờ không hợp lệ (HH:mm).`,
        invalidStepId: item.id,
      }
    }
  }

  return { valid: true, error: null, invalidStepId: null }
}

export function suggestBreakdownPriorities(
  items: BreakdownItem[],
): BreakdownItem[] {
  if (!items.length) return items
  return items.map((item, idx) => {
    const isFirst = idx === 0
    const isLast = idx === items.length - 1 && items.length > 1
    const hasKeyword = PRIORITY_KEYWORD_RE.test(item.title)
    const isEarlyMorning = Boolean(item.time && item.time <= "10:00")

    if (isFirst) {
      return {
        ...item,
        starred: true,
        priorityReason:
          item.priorityReason || "Bước khởi đầu — ưu tiên thực hiện trước",
      }
    }
    if (isLast) {
      return {
        ...item,
        starred: true,
        priorityReason:
          item.priorityReason || "Bước chốt hạn hoàn thành (deadline)",
      }
    }
    if (hasKeyword || isEarlyMorning) {
      return {
        ...item,
        starred: true,
        priorityReason: hasKeyword
          ? "Chứa từ khóa quan trọng"
          : `Mốc giờ sớm trong ngày (${item.time})`,
      }
    }
    return item
  })
}

export function computeLocalPrioritySuggestions(
  tasks: Task[],
  getTaskDay: (id: number) => number,
  weekOffset: number,
  todayWeek: number,
  todayDay: number,
): PrioritySuggestionBundle {
  const pending = tasks.filter((t) => !t.done)
  const suggestions: PrioritySuggestion[] = pending.map((t) => {
    const day = getTaskDay(t.id)
    let score = 0
    const reasons: string[] = []

    if (
      weekOffset < todayWeek ||
      (weekOffset === todayWeek && day < todayDay)
    ) {
      score += 45
      reasons.push("Đã quá hạn — cần ưu tiên xử lý ngay")
    } else if (weekOffset === todayWeek && day === todayDay) {
      score += 40
      reasons.push("Đến hạn hôm nay")
    } else if (weekOffset === todayWeek && day === todayDay + 1) {
      score += 25
      reasons.push("Đến hạn ngày mai")
    } else if (day <= 2) {
      score += 12
      reasons.push("Lịch thực hiện đầu tuần")
    }

    if (t.time) {
      if (t.time < "12:00") {
        score += 25
        reasons.push(`Hạn buổi sáng (${t.time})`)
      } else if (t.time < "15:00") {
        score += 18
        reasons.push(`Hạn đầu giờ chiều (${t.time})`)
      } else {
        score += 12
        reasons.push(`Có mốc giờ hoàn thành (${t.time})`)
      }
    }

    if (t.steps && t.steps.length > 0) {
      score += Math.min(20, t.steps.length * 5)
      reasons.push(`Gồm ${t.steps.length} bước con`)
    }

    if (PRIORITY_KEYWORD_RE.test(t.title)) {
      score += 20
      reasons.push("Công việc quan trọng / hạn gấp")
    }

    if (t.ai) {
      score += 5
    }

    if (!reasons.length) {
      reasons.push("Công việc chưa hoàn thành trong tuần")
    }

    return {
      taskId: t.id,
      title: t.title,
      day,
      time: t.time,
      currentlyStarred: Boolean(t.starred),
      recommendedStar: score >= 25 || Boolean(t.starred),
      score,
      reason: reasons.join(" · "),
    }
  })

  suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.day - b.day ||
      Number(a.time === "") - Number(b.time === "") ||
      a.time.localeCompare(b.time) ||
      a.taskId - b.taskId,
  )

  if (suggestions.length > 0 && !suggestions.some((s) => s.recommendedStar)) {
    for (const s of suggestions.slice(0, Math.min(2, suggestions.length))) {
      s.recommendedStar = true
    }
  }

  return {
    isPrototype: true,
    provider: null,
    notice: "",
    suggestions,
  }
}

export function sortTasksByPriorityAndTime(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (!a.done && Boolean(a.starred) !== Boolean(b.starred)) {
      return a.starred ? -1 : 1
    }
    const aHasTime = Boolean(a.time && a.time.trim())
    const bHasTime = Boolean(b.time && b.time.trim())
    if (aHasTime !== bHasTime) return aHasTime ? -1 : 1
    if (aHasTime && bHasTime && a.time !== b.time) {
      return a.time.localeCompare(b.time)
    }
    return a.id - b.id
  })
}
