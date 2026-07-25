import { app, BrowserWindow } from 'electron'
import { initMain as initLoopbackAudio } from 'electron-audio-loopback'
import { settings } from './settings'
import { createOverlayWindow } from './window'
import { registerIpc, sendToast } from './ipc'
import { registerShortcuts } from './shortcuts'
import { mockSessionStore } from './mock/mock-session-store'

initLoopbackAudio({ forceCoreAudioTap: true })

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

if (process.platform === 'darwin' && app.dock) {
  app.dock.hide()
}

let mainWindow: BrowserWindow | null = null

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) mainWindow.showInactive()
    mainWindow.focus()
  }
})

void app.whenReady().then(async () => {
  await settings.load()
  await mockSessionStore.load()

  mainWindow = createOverlayWindow()
  registerIpc(mainWindow)
  const reg = registerShortcuts(mainWindow)

  const unavailable = Object.values(reg).filter((slot) => !slot.ok)
  if (unavailable.length > 0) {
    sendToast(mainWindow, {
      level: 'warn',
      message: `Another app already owns ${unavailable.map((slot) => slot.accelerator).join(', ')}. Those actions still work from the overlay (⌘K).`,
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createOverlayWindow()
      registerIpc(mainWindow)
      registerShortcuts(mainWindow)
    } else if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.showInactive()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
