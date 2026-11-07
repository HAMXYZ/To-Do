import { useEffect, useRef } from "react"
import * as api from "../api"
import { showAppNotification } from "../utils/notifications"
import type { SignedOutReason } from "./useAppData"

interface UseReminderNotificationsProps {
  enabled: boolean
  playSound?: boolean
  onNavigateCurrentWeek: () => void
  onSignedOut?: (reason: SignedOutReason) => void
}

const STORAGE_KEY_NOTIFIED = "focusflow_notified_reminders"
const STORAGE_KEY_SUMMARY_DATE = "focusflow_last_summary_date"

export function useReminderNotifications({
  enabled,
  playSound = true,
  onNavigateCurrentWeek,
  onSignedOut,
}: UseReminderNotificationsProps) {
  const onNavigateRef = useRef(onNavigateCurrentWeek)
  onNavigateRef.current = onNavigateCurrentWeek

  const onSignedOutRef = useRef(onSignedOut)
  onSignedOutRef.current = onSignedOut

  // 1. Lắng nghe sự kiện click mở tuần hiện tại từ Desktop Electron IPC
  useEffect(() => {
    if (window.electronAPI?.onNavigateCurrentWeek) {
      const cleanup = window.electronAPI.onNavigateCurrentWeek(() => {
        onNavigateRef.current?.()
      })
      return () => {
        cleanup?.()
      }
    }
  }, [])

  // 2. Scheduler kiểm tra nhắc việc và tổng kết cuối ngày
  useEffect(() => {
    if (!enabled) return

    let isMounted = true

    async function checkReminders() {
      if (!isMounted) return
      try {
        const data = await api.getReminders()
        if (!isMounted) return

        const now = new Date()
        const currentHours = String(now.getHours()).padStart(2, "0")
        const currentMinutes = String(now.getMinutes()).padStart(2, "0")
        const currentTimeStr = `${currentHours}:${currentMinutes}`
        const todayStr = data.today

        // Lấy danh sách ID đã nhắc hôm nay từ sessionStorage để tránh gửi trùng (EX1)
        let notifiedSet: Set<string>
        try {
          const raw = sessionStorage.getItem(STORAGE_KEY_NOTIFIED)
          notifiedSet = new Set(raw ? JSON.parse(raw) : [])
        } catch {
          notifiedSet = new Set()
        }

        // --- A. Nhắc nhở công việc sắp tới hạn (US-27, US-28) ---
        if (
          data.reminderLeadMinutes !== null &&
          data.upcoming &&
          data.upcoming.length > 0
        ) {
          const leadMinutes = data.reminderLeadMinutes
          for (const task of data.upcoming) {
            const taskKey = `${todayStr}_task_${task.id}`
            // Nếu còn trong khoảng thời gian nhắc (minutesUntil <= leadMinutes) và chưa nhắc
            if (task.minutesUntil <= leadMinutes && !notifiedSet.has(taskKey)) {
              notifiedSet.add(taskKey)
              try {
                sessionStorage.setItem(
                  STORAGE_KEY_NOTIFIED,
                  JSON.stringify(Array.from(notifiedSet)),
                )
              } catch {
                // bỏ qua lỗi storage quota
              }

              const timeDesc =
                task.minutesUntil === 0
                  ? "ngay bây giờ!"
                  : `trong ${task.minutesUntil} phút nữa (${task.time})`

              showAppNotification({
                title: `⏰ Nhắc nhở công việc: ${task.time}`,
                body: `"${task.title}" sắp đến hạn ${timeDesc}`,
                playSound,
                onClick: () => {
                  onNavigateRef.current?.()
                },
              })
            }
          }
        }

        // --- B. Tổng kết cuối ngày (US-28) ---
        const lastSummaryDate = sessionStorage.getItem(STORAGE_KEY_SUMMARY_DATE)
        if (data.reminderTime && lastSummaryDate !== todayStr) {
          // So sánh giờ hiện tại với reminderTime (hoặc trong vòng 10 phút sau giờ đó)
          const [summaryHour, summaryMinute] = data.reminderTime
            .split(":")
            .map(Number)
          const currentTotalMinutes = now.getHours() * 60 + now.getMinutes()
          const summaryTotalMinutes = summaryHour * 60 + summaryMinute

          if (
            currentTotalMinutes >= summaryTotalMinutes &&
            currentTotalMinutes <= summaryTotalMinutes + 15
          ) {
            sessionStorage.setItem(STORAGE_KEY_SUMMARY_DATE, todayStr)

            const pendingTasks = data.pendingTasks
            const pendingHabits = data.pendingHabits
            const message =
              pendingTasks === 0 && pendingHabits === 0
                ? "Tuyệt vời! Bạn đã hoàn thành toàn bộ công việc và thói quen hôm nay."
                : `Hôm nay bạn còn ${pendingTasks} công việc và ${pendingHabits} thói quen chưa xong.`

            showAppNotification({
              title: `📊 Tổng kết ngày (${data.reminderTime})`,
              body: `${message} Nhấn để mở tuần làm việc.`,
              playSound,
              onClick: () => {
                onNavigateRef.current?.()
              },
            })
          }
        }
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) {
          // Token hết hạn -> gọi callback đăng xuất chuyển về Login (EX1)
          onSignedOutRef.current?.("expired")
        }
      }
    }

    // Chạy kiểm tra ngay khi mount và lặp lại mỗi 30 giây
    void checkReminders()
    const intervalId = window.setInterval(() => {
      void checkReminders()
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [enabled, playSound])
}
