import { BrowserWindow, app, globalShortcut } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { toggleWindowVisibility, cycleHudSize } from './window'
import { triggerPanic } from './panic'

// Global shortcuts are stolen from every other app on the machine, so they must
// be combinations nothing else claims. Plain Cmd+<letter> is not safe: Cmd+W
// closes tabs and Cmd+B bolds text, and the overlay is meant to run for hours
// underneath a browser or an editor. Everything here is Cmd+Shift+<key>.
const accel = (key: string): string => (process.platform === 'darwin' ? `Cmd+${key}` : `Ctrl+${key}`)

export const ACCELERATORS = {
  ask: accel('\\'),
  screenAsk: accel('Shift+\\'),
  toggle: accel('Shift+B'),
  listen: accel('Shift+L'),
  hud: accel('Shift+E'),
  panic: accel('Shift+Escape'),
} as const

export type ShortcutId = keyof typeof ACCELERATORS

export interface ShortcutSlot {
  ok: boolean
  accelerator: string
}

export type ShortcutRegistration = Record<ShortcutId, ShortcutSlot>

let lastRegistration: ShortcutRegistration | null = null

export function registerShortcuts(win: BrowserWindow): ShortcutRegistration {
  const send = (channel: string) => (): void => {
    if (!win.isDestroyed()) win.webContents.send(channel)
  }

  const handlers: Record<ShortcutId, () => void> = {
    ask: send(IPC.llmTrigger),
    screenAsk: send(IPC.visionTrigger),
    toggle: () => toggleWindowVisibility(win),
    listen: send(IPC.listenTrigger),
    hud: () => cycleHudSize(win),
    panic: () => triggerPanic(win),
  }

  const registration = {} as ShortcutRegistration
  for (const id of Object.keys(ACCELERATORS) as ShortcutId[]) {
    const accelerator = ACCELERATORS[id]
    let ok = false
    try {
      // The OS reserves some combinations outright and Electron throws rather
      // than returning false, so every registration is guarded.
      ok = globalShortcut.register(accelerator, handlers[id])
    } catch {
      ok = false
    }
    registration[id] = { ok, accelerator }
  }

  app.on('will-quit', () => globalShortcut.unregisterAll())

  lastRegistration = registration
  return lastRegistration
}

export function getShortcutRegistration(): ShortcutRegistration | null {
  return lastRegistration
}
