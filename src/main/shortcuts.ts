import { BrowserWindow, app, globalShortcut } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { toggleWindowVisibility, toggleWide } from './window'
import { triggerPanic } from './panic'

const ASK_ACCEL = process.platform === 'darwin' ? 'Cmd+\\' : 'Ctrl+\\'
const SCREEN_ASK_ACCEL = process.platform === 'darwin' ? 'Cmd+Shift+\\' : 'Ctrl+Shift+\\'
const TOGGLE_ACCEL = process.platform === 'darwin' ? 'Cmd+B' : 'Ctrl+B'
const WIDE_ACCEL = process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+W'
const PANIC_ACCEL = process.platform === 'darwin' ? 'Cmd+Shift+Escape' : 'Ctrl+Shift+Escape'

export interface ShortcutRegistration {
  ask: { ok: boolean; accelerator: string }
  screenAsk: { ok: boolean; accelerator: string }
  toggle: { ok: boolean; accelerator: string }
  wide: { ok: boolean; accelerator: string }
  panic: { ok: boolean; accelerator: string }
}

let lastRegistration: ShortcutRegistration | null = null

export function registerShortcuts(win: BrowserWindow): ShortcutRegistration {
  const askOk = globalShortcut.register(ASK_ACCEL, () => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.llmTrigger)
    }
  })
  const screenAskOk = globalShortcut.register(SCREEN_ASK_ACCEL, () => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.visionTrigger)
    }
  })
  const toggleOk = globalShortcut.register(TOGGLE_ACCEL, () => toggleWindowVisibility(win))
  const wideOk = globalShortcut.register(WIDE_ACCEL, () => toggleWide(win))
  const panicOk = (() => {
    try {
      return globalShortcut.register(PANIC_ACCEL, () => triggerPanic(win))
    } catch {
      return false
    }
  })()

  app.on('will-quit', () => globalShortcut.unregisterAll())

  lastRegistration = {
    ask: { ok: askOk, accelerator: ASK_ACCEL },
    screenAsk: { ok: screenAskOk, accelerator: SCREEN_ASK_ACCEL },
    toggle: { ok: toggleOk, accelerator: TOGGLE_ACCEL },
    wide: { ok: wideOk, accelerator: WIDE_ACCEL },
    panic: { ok: panicOk, accelerator: PANIC_ACCEL },
  }
  return lastRegistration
}

export function getShortcutRegistration(): ShortcutRegistration | null {
  return lastRegistration
}
