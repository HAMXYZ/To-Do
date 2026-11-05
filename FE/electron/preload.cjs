const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  sendNotification: (payload) => {
    ipcRenderer.send('app:notification', payload)
  },
  onNavigateCurrentWeek: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('navigate:current-week', handler)
    return () => {
      ipcRenderer.removeListener('navigate:current-week', handler)
    }
  },
})

