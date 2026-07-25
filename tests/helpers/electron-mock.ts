import { EventEmitter } from 'node:events'
import { vi } from 'vitest'

export interface FakeWebContents extends EventEmitter {
  send: ReturnType<typeof vi.fn>
  mainFrame: object
  setWindowOpenHandler: ReturnType<typeof vi.fn>
}

export interface FakeBrowserWindow extends EventEmitter {
  webContents: FakeWebContents
  isDestroyed: ReturnType<typeof vi.fn>
  isVisible: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  showInactive: ReturnType<typeof vi.fn>
  hide: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  setSize: ReturnType<typeof vi.fn>
  setMinimumSize: ReturnType<typeof vi.fn>
  setResizable: ReturnType<typeof vi.fn>
  setContentProtection: ReturnType<typeof vi.fn>
  setAlwaysOnTop: ReturnType<typeof vi.fn>
  setVisibleOnAllWorkspaces: ReturnType<typeof vi.fn>
  setHiddenInMissionControl: ReturnType<typeof vi.fn>
  setWindowButtonVisibility: ReturnType<typeof vi.fn>
  loadURL: ReturnType<typeof vi.fn>
  loadFile: ReturnType<typeof vi.fn>
}

export function makeFakeWindow(): FakeBrowserWindow {
  const emitter = new EventEmitter()
  const wc = new EventEmitter() as FakeWebContents
  wc.send = vi.fn()
  wc.mainFrame = {}
  wc.setWindowOpenHandler = vi.fn()
  const win = emitter as FakeBrowserWindow
  win.webContents = wc
  win.isDestroyed = vi.fn().mockReturnValue(false)
  win.isVisible = vi.fn().mockReturnValue(true)
  win.show = vi.fn()
  win.showInactive = vi.fn()
  win.hide = vi.fn()
  win.focus = vi.fn()
  win.setSize = vi.fn()
  win.setMinimumSize = vi.fn()
  win.setResizable = vi.fn()
  win.setContentProtection = vi.fn()
  win.setAlwaysOnTop = vi.fn()
  win.setVisibleOnAllWorkspaces = vi.fn()
  win.setHiddenInMissionControl = vi.fn()
  win.setWindowButtonVisibility = vi.fn()
  win.loadURL = vi.fn().mockResolvedValue(undefined)
  win.loadFile = vi.fn().mockResolvedValue(undefined)
  return win
}

export interface IpcMainHandle {
  channel: string
  handler: (...args: unknown[]) => unknown
}

export function makeIpcMainStub(): {
  ipcMain: {
    handle: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    removeAllListeners: ReturnType<typeof vi.fn>
  }
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  send: (channel: string, ...args: unknown[]) => void
  registered: Map<string, (...args: unknown[]) => unknown>
  events: Map<string, Array<(...args: unknown[]) => void>>
  setEvent: (event: unknown) => void
} {
  const registered = new Map<string, (...args: unknown[]) => unknown>()
  const events = new Map<string, Array<(...args: unknown[]) => void>>()
  let event: unknown = {}
  const ipcMain = {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
      registered.set(channel, fn)
    }),
    on: vi.fn((channel: string, fn: (...args: unknown[]) => void) => {
      const arr = events.get(channel) ?? []
      arr.push(fn)
      events.set(channel, arr)
    }),
    removeAllListeners: vi.fn(() => {
      registered.clear()
      events.clear()
    }),
  }
  const invoke = async (channel: string, ...args: unknown[]): Promise<unknown> => {
    const fn = registered.get(channel)
    if (!fn) throw new Error(`No handler for ${channel}`)
    return await fn(event, ...args)
  }
  const send = (channel: string, ...args: unknown[]): void => {
    const listeners = events.get(channel) ?? []
    for (const l of listeners) l(event, ...args)
  }
  const setEvent = (next: unknown): void => {
    event = next
  }
  return { ipcMain, invoke, send, registered, events, setEvent }
}
