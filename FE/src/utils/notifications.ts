/**
 * Quản lý thông báo và âm báo cho US-27, US-28 (Web & Electron)
 */

export function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    // Tiếng chuông 2 âm sắc thanh nhẹ (D5 -> A5)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, now) // Note D5
    osc.frequency.setValueAtTime(880.0, now + 0.12) // Note A5

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.65)
  } catch {
    // Tránh gián đoạn ứng dụng nếu chính sách autoplay của trình duyệt chưa kích hoạt
  }
}

export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (window.electronAPI?.isElectron) return true
  return 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  if (window.electronAPI?.isElectron) return 'granted'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'
  if (window.electronAPI?.isElectron) return 'granted'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export interface ShowNotificationOptions {
  title: string
  body: string
  playSound?: boolean
  onClick?: () => void
}

export function showAppNotification({
  title,
  body,
  playSound = true,
  onClick,
}: ShowNotificationOptions): void {
  // 1. Nếu đang chạy trong Desktop Electron (Native Windows Notification kèm âm thanh hệ thống)
  if (window.electronAPI?.isElectron && window.electronAPI.sendNotification) {
    window.electronAPI.sendNotification({ title, body, sound: playSound })
    return
  }

  // 2. Chạy trên trình duyệt Web (Web Notification API)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        silent: !playSound,
      })

      if (playSound) {
        playNotificationChime()
      }

      notification.onclick = () => {
        window.focus()
        onClick?.()
        notification.close()
      }
    } catch (err) {
      console.warn('Could not display Web Notification:', err)
    }
  }
}

