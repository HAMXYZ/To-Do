import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { BreakdownItem, DeletedTask, Habit, OverdueTask, SearchResult, Task } from '../types'
import { dateToWeekDay, localYmd, type Ymd } from '../utils/dates'

const HABIT_ORDER_KEY = 'focusflow.habitOrder'

// Thứ tự habit do người dùng kéo thả chỉ lưu trên máy này (BE không lưu thứ tự).
function loadHabitOrder(): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HABIT_ORDER_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

function saveHabitOrder(ids: number[]): void {
  try {
    localStorage.setItem(HABIT_ORDER_KEY, JSON.stringify(ids))
  } catch {
    /* bỏ qua */
  }
}

function applyHabitOrder(habits: Habit[]): Habit[] {
  const order = loadHabitOrder()
  const rank = (id: number) => {
    const i = order.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...habits].sort((a, b) => rank(a.id) - rank(b.id) || a.id - b.id)
}

export type SignedOutReason = 'expired' | 'logout'

interface TodayState {
  date: Ymd
  week: number
  day: number
}

function clientToday(): TodayState {
  const date = localYmd()
  return { date, ...dateToWeekDay(date) }
}

/**
 * Giữ toàn bộ dữ liệu lấy từ BE cho màn hình chính và các thao tác ghi.
 * Trả về đúng những tên mà App.tsx đang dùng (tasksByWeek, getTaskDay, overdue, ...).
 */
export function useAppData(searchQuery: string, onSignedOut?: (reason: SignedOutReason) => void) {
  const [today, setToday] = useState<TodayState>(clientToday)
  const [weekOffset, setWeekOffset] = useState<number>(() => clientToday().week)
  const [tasksByWeek, setTasksByWeek] = useState<Record<number, Task[]>>({})
  const [dayById, setDayById] = useState<Record<number, number>>({})
  const [habitsByWeek, setHabitsByWeek] = useState<Record<number, Record<number, boolean[]>>>({})
  const [habitDefinitions, setHabitDefinitions] = useState<Habit[]>([])
  const [overdue, setOverdue] = useState<OverdueTask[]>([])
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([])
  const [undoItem, setUndoItem] = useState<DeletedTask | null>(null)
  const [matchingTasks, setMatchingTasks] = useState<SearchResult[]>([])
  const [me, setMe] = useState<api.UserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeq = useRef<Record<number, number>>({})
  // Bản sao state mới nhất cho các hàm xử lý sự kiện (tránh dữ liệu cũ trong closure)
  const live = useRef({ today, weekOffset, tasksByWeek, habitsByWeek, overdue, undoItem, dayById })
  useEffect(() => {
    live.current = { today, weekOffset, tasksByWeek, habitsByWeek, overdue, undoItem, dayById }
  })

  const fail = useCallback((e: unknown) => {
    if (e instanceof api.ApiError && e.status === 401) return // đã được xử lý bởi onSignedOut
    setError(e instanceof Error ? e.message : 'Đã xảy ra lỗi')
  }, [])

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  useEffect(() => {
    api.setUnauthorizedHandler(() => onSignedOut?.('expired'))
    return () => api.setUnauthorizedHandler(null)
  }, [onSignedOut])

  useEffect(
    () => () => {
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
    },
    [],
  )

  const remember = useCallback((items: { task: Task; day: number }[]) => {
    setDayById((c) => {
      const n = { ...c }
      for (const i of items) n[i.task.id] = i.day
      return n
    })
  }, [])

  const getTaskDay = useCallback((id: number): number => dayById[id] ?? 0, [dayById])

  // ---------------------------------------------------------------- tải dữ liệu

  const loadWeek = useCallback(async (week: number, generate = true): Promise<void> => {
    const n = (loadSeq.current[week] = (loadSeq.current[week] ?? 0) + 1)
    const d = await api.getWeek(week, { generate })
    if (loadSeq.current[week] !== n) return // đã có lần tải mới hơn
    const flat: Task[] = []
    const positions: Record<number, number> = {}
    d.tasksByDay.forEach((list, day) =>
      list.forEach((t) => {
        flat.push(t)
        positions[t.id] = day
      }),
    )
    setTasksByWeek((c) => ({ ...c, [week]: flat }))
    setDayById((c) => ({ ...c, ...positions }))
    setHabitsByWeek((c) => ({ ...c, [week]: Object.fromEntries(d.habits.map((h) => [h.id, h.logs])) }))
  }, [])

  const refreshOverdue = useCallback(async (): Promise<void> => {
    const items = await api.getOverdue()
    setOverdue(items)
    remember(items)
  }, [remember])

  const refreshHabits = useCallback(async (): Promise<void> => {
    setHabitDefinitions(applyHabitOrder(await api.listHabits()))
  }, [])

  const refreshTrash = useCallback(async (): Promise<void> => {
    try {
      const items = await api.getTrash()
      setDeletedTasks(items)
      remember(items)
    } catch (e) {
      fail(e)
    }
  }, [remember, fail])

  /** Sau khi habit đổi, task các tuần khác có thể đã đổi: bỏ cache và tải lại tuần đang xem. */
  const resetWeeks = useCallback(async (): Promise<void> => {
    const w = live.current.weekOffset
    setTasksByWeek({})
    setHabitsByWeek({})
    await loadWeek(w, true)
  }, [loadWeek])

  /** Chạy một thao tác, gom lỗi vào thông báo. Trả về true nếu thành công. */
  const run = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn()
        return true
      } catch (e) {
        fail(e)
        return false
      }
    },
    [fail],
  )

  // Khởi động: hồ sơ, habit, hôm nay, task quá hạn
  useEffect(() => {
    void run(async () => {
      const [t, user] = await Promise.all([api.getToday(), api.getMe()])
      setMe(user)
      setToday({ date: t.date, week: t.week, day: t.day })
      setWeekOffset((w) => (w === clientToday().week ? t.week : w))
      await Promise.all([refreshHabits(), refreshOverdue()])
    })
  }, [run, refreshHabits, refreshOverdue])

  // Mỗi lần đổi tuần: sinh task habit còn thiếu rồi tải tuần đó
  useEffect(() => {
    void run(() => loadWeek(weekOffset, true))
  }, [weekOffset, run, loadWeek])

  // Qua ngày mới (app chạy nền qua đêm) hoặc cửa sổ hiện lại: hỏi lại hôm nay
  useEffect(() => {
    const check = async () => {
      const t = await api.getToday()
      const prev = live.current.today
      if (t.date === prev.date) return
      setToday({ date: t.date, week: t.week, day: t.day })
      if (live.current.weekOffset === prev.week && t.week !== prev.week) setWeekOffset(t.week)
      else await loadWeek(live.current.weekOffset, true)
      await refreshOverdue()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run(check)
    }
    const onFocus = () => void run(check)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [run, loadWeek, refreshOverdue])

  // Tìm kiếm ở BE (có debounce)
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setMatchingTasks([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .searchTasks(q)
        .then((r) => {
          if (cancelled) return
          remember(r)
          setMatchingTasks(r)
        })
        .catch((e) => {
          if (!cancelled) fail(e)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, remember, fail])

  // ---------------------------------------------------------------- thao tác task

  const replaceTask = useCallback((week: number, task: Task) => {
    setTasksByWeek((c) => ({ ...c, [week]: (c[week] ?? []).map((t) => (t.id === task.id ? task : t)) }))
  }, [])

  const patchTask = useCallback(
    async (id: number, optimistic: Partial<Task>, patch: api.UpdateTaskInput): Promise<void> => {
      const week = live.current.weekOffset
      const original = live.current.tasksByWeek[week]?.find((t) => t.id === id)
      if (!original) return
      replaceTask(week, { ...original, ...optimistic })
      try {
        const r = await api.updateTask(id, patch)
        replaceTask(week, r.task)
        if (patch.done !== undefined) {
          await Promise.all([
            original.autoHabitId !== undefined ? loadWeek(week, false) : Promise.resolve(),
            refreshOverdue(),
          ])
        }
      } catch (e) {
        replaceTask(week, original)
        fail(e)
      }
    },
    [replaceTask, loadWeek, refreshOverdue, fail],
  )

  const toggleTask = useCallback(
    (id: number) => {
      const task = live.current.tasksByWeek[live.current.weekOffset]?.find((t) => t.id === id)
      if (!task) return
      void patchTask(
        id,
        { done: !task.done, completedAt: task.done ? undefined : Date.now() },
        { done: !task.done },
      )
    },
    [patchTask],
  )

  const updateTaskTitle = useCallback(
    (id: number, title: string) => void patchTask(id, { title }, { title }),
    [patchTask],
  )

  const toggleTaskStar = useCallback(
    (id: number) => {
      const task = live.current.tasksByWeek[live.current.weekOffset]?.find((t) => t.id === id)
      if (!task) return
      void patchTask(id, { starred: !task.starred }, { starred: !task.starred })
    },
    [patchTask],
  )

  const addTask = useCallback(
    (day: number, title: string, time: string): Promise<boolean> =>
      run(async () => {
        const week = live.current.weekOffset
        await api.createTask({ week, day, title: title.trim(), time })
        await Promise.all([loadWeek(week, false), refreshOverdue()])
      }),
    [run, loadWeek, refreshOverdue],
  )

  const saveBreakdown = useCallback(
    (items: BreakdownItem[]): Promise<boolean> =>
      run(async () => {
        const week = live.current.weekOffset
        const created = await api.saveBreakdown(
          week,
          items.map((i) => ({ ...i, title: i.title.trim() })),
        )
        remember(created.map((c) => ({ task: c.task, day: c.day })))
        await Promise.all([loadWeek(week, false), refreshOverdue()])
      }),
    [run, loadWeek, refreshOverdue, remember],
  )

  const moveTask = useCallback(
    (sourceWeek: number, id: number, targetWeek: number, targetDay: number): Promise<boolean> =>
      run(async () => {
        const r = await api.updateTask(id, { move: { week: targetWeek, day: targetDay } })
        remember([{ task: r.task, day: r.day }])
        setTasksByWeek((c) => ({ ...c, [sourceWeek]: (c[sourceWeek] ?? []).filter((t) => t.id !== id) }))
        setWeekOffset(targetWeek)
        await Promise.all([
          loadWeek(targetWeek, false),
          sourceWeek !== targetWeek && live.current.tasksByWeek[sourceWeek]
            ? loadWeek(sourceWeek, false)
            : Promise.resolve(),
          refreshOverdue(),
        ])
      }),
    [run, remember, loadWeek, refreshOverdue],
  )

  const carryOverdue = useCallback(
    (): Promise<boolean> =>
      run(async () => {
        const r = await api.carryOver()
        remember(r.tasks.map((t) => ({ task: t.task, day: t.day })))
        const cur = live.current.today.week
        const weeks = new Set<number>([cur, ...Object.keys(live.current.tasksByWeek).map(Number)])
        setWeekOffset(cur)
        await Promise.all([...weeks].map((w) => loadWeek(w, false)))
        await refreshOverdue()
      }),
    [run, remember, loadWeek, refreshOverdue],
  )

  // ---------------------------------------------------------------- thùng rác

  const dismissTask = useCallback(
    async (week: number, id: number): Promise<void> => {
      const task =
        live.current.tasksByWeek[week]?.find((t) => t.id === id) ??
        live.current.overdue.find((o) => o.week === week && o.task.id === id)?.task
      if (!task) return
      const day = live.current.dayById[id] ?? 0
      try {
        await api.trashTask(id)
      } catch (e) {
        fail(e)
        return
      }
      const removed: DeletedTask = { task, week, day, deletedAt: Date.now() }
      setTasksByWeek((c) => ({ ...c, [week]: (c[week] ?? []).filter((t) => t.id !== id) }))
      setOverdue((c) => c.filter((o) => o.task.id !== id))
      setDeletedTasks((c) => [...c, removed])
      if (undoTimeout.current) clearTimeout(undoTimeout.current)
      setUndoItem(removed)
      undoTimeout.current = setTimeout(() => setUndoItem(null), 5000)
    },
    [fail],
  )

  const restoreTask = useCallback(
    (item: DeletedTask): Promise<boolean> =>
      run(async () => {
        const r = await api.restoreTask(item.task.id)
        remember([{ task: r.task, day: r.day }])
        setDeletedTasks((c) => c.filter((e) => e.task.id !== item.task.id))
        setWeekOffset(r.week)
        await Promise.all([loadWeek(r.week, false), refreshOverdue()])
      }),
    [run, remember, loadWeek, refreshOverdue],
  )

  const undoDelete = useCallback(async (): Promise<void> => {
    const item = live.current.undoItem
    if (!item) return
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    if (await restoreTask(item)) setUndoItem(null)
  }, [restoreTask])

  const permanentlyDeleteTask = useCallback(
    (item: DeletedTask): Promise<boolean> =>
      run(async () => {
        await api.purgeTask(item.task.id)
        setDeletedTasks((c) => c.filter((e) => e.task.id !== item.task.id))
        if (live.current.undoItem?.task.id === item.task.id) {
          if (undoTimeout.current) clearTimeout(undoTimeout.current)
          setUndoItem(null)
        }
      }),
    [run],
  )

  const emptyTrash = useCallback(
    (): Promise<boolean> =>
      run(async () => {
        await api.emptyTrash()
        setDeletedTasks([])
        setUndoItem(null)
      }),
    [run],
  )

  // ---------------------------------------------------------------- habit

  const toggleHabit = useCallback(
    async (habitId: number, dayIndex: number): Promise<void> => {
      const { weekOffset: w, today: t, habitsByWeek: hw } = live.current
      if (w !== t.week || dayIndex !== t.day) {
        setError('Chỉ có thể ghi nhận thói quen của ngày hôm nay')
        return
      }
      const row = hw[w]?.[habitId] ?? Array<boolean>(7).fill(false)
      const next = !row[dayIndex]
      const setRow = (value: boolean) =>
        setHabitsByWeek((c) => ({
          ...c,
          [w]: { ...(c[w] ?? {}), [habitId]: row.map((x, d) => (d === dayIndex ? value : x)) },
        }))
      setRow(next)
      try {
        const r = await api.setHabitLog(habitId, t.date, next)
        if (r.task) replaceTask(w, r.task)
      } catch (e) {
        setRow(!next)
        fail(e)
      }
    },
    [replaceTask, fail],
  )

  const addHabit = useCallback(
    (habit: Omit<Habit, 'id'>): Promise<boolean> =>
      run(async () => {
        const h = await api.createHabit({ ...habit, title: habit.title.trim() })
        const order = loadHabitOrder()
        saveHabitOrder([...order.filter((id) => id !== h.id), h.id])
        await refreshHabits()
        await resetWeeks()
      }),
    [run, refreshHabits, resetWeeks],
  )

  const updateHabit = useCallback(
    (habit: Habit): Promise<boolean> =>
      run(async () => {
        await api.updateHabit(habit.id, {
          title: habit.title.trim(),
          frequency: habit.frequency,
          days: habit.days,
          time: habit.time,
          autoTask: habit.autoTask,
          active: habit.active,
        })
        await refreshHabits()
        await resetWeeks()
      }),
    [run, refreshHabits, resetWeeks],
  )

  const removeHabit = useCallback(
    (id: number): Promise<boolean> =>
      run(async () => {
        await api.deleteHabit(id)
        await refreshHabits()
        await resetWeeks()
      }),
    [run, refreshHabits, resetWeeks],
  )

  const reorderHabit = useCallback((from: number, to: number) => {
    setHabitDefinitions((current) => {
      const next = [...current]
      next.splice(to, 0, ...next.splice(from, 1))
      saveHabitOrder(next.map((h) => h.id))
      return next
    })
  }, [])

  return {
    // trạng thái
    today,
    weekOffset,
    setWeekOffset,
    tasksByWeek,
    getTaskDay,
    habitsByWeek,
    habitDefinitions,
    overdue,
    deletedTasks,
    undoItem,
    matchingTasks,
    me,
    error,
    clearError,
    // task
    toggleTask,
    updateTaskTitle,
    toggleTaskStar,
    addTask,
    saveBreakdown,
    moveTask,
    carryOverdue,
    // thùng rác
    dismissTask,
    restoreTask,
    undoDelete,
    permanentlyDeleteTask,
    emptyTrash,
    refreshTrash,
    // habit
    toggleHabit,
    addHabit,
    updateHabit,
    removeHabit,
    reorderHabit,
  }
}
