/// <reference types="vite/client" />

interface Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
  electronAPI?: {
    isElectron: boolean
    sendNotification: (payload: {
      title: string
      body: string
      sound?: boolean
    }) => void
    onNavigateCurrentWeek: (callback: () => void) => () => void
    isNotificationSupported?: () => boolean
  }
}
