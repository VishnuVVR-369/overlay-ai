import { app, BrowserWindow } from 'electron'
import { initMain as initLoopbackAudio } from 'electron-audio-loopback'
import { settings } from './settings'
import { createOverlayWindow } from './window'
import { registerIpc, sendToast } from './ipc'
import { registerShortcuts } from './shortcuts'

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

  mainWindow = createOverlayWindow()
  registerIpc(mainWindow)
  const reg = registerShortcuts(mainWindow)

  if (!reg.ask.ok) {
    sendToast(mainWindow, { level: 'warn', message: `Could not register ${reg.ask.accelerator} (already in use).` })
  }
  if (!reg.toggle.ok) {
    sendToast(mainWindow, { level: 'warn', message: `Could not register ${reg.toggle.accelerator} (already in use).` })
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
