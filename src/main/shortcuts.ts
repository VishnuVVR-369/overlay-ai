import { BrowserWindow, app, globalShortcut } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { toggleWindowVisibility } from './window'

const ASK_ACCEL = process.platform === 'darwin' ? 'Cmd+\\' : 'Ctrl+\\'
const TOGGLE_ACCEL = process.platform === 'darwin' ? 'Cmd+B' : 'Ctrl+B'

export interface ShortcutRegistration {
  ask: { ok: boolean; accelerator: string }
  toggle: { ok: boolean; accelerator: string }
}

export function registerShortcuts(win: BrowserWindow): ShortcutRegistration {
  const askOk = globalShortcut.register(ASK_ACCEL, () => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.llmTrigger)
    }
  })
  const toggleOk = globalShortcut.register(TOGGLE_ACCEL, () => toggleWindowVisibility(win))

  app.on('will-quit', () => globalShortcut.unregisterAll())

  return {
    ask: { ok: askOk, accelerator: ASK_ACCEL },
    toggle: { ok: toggleOk, accelerator: TOGGLE_ACCEL },
  }
}
