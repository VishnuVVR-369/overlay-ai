import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeFakeWindow, type FakeBrowserWindow } from '../../helpers/electron-mock'
import { IPC } from '@shared/ipc-channels'

const platformRef = { current: 'darwin' as NodeJS.Platform }
const electronState = vi.hoisted(() => ({
  constructedOptions: [] as Array<Record<string, unknown>>,
  constructedWindows: [] as Array<Record<string, unknown>>,
  workAreaSize: { width: 1440, height: 900 },
}))

vi.mock('electron', () => {
  const createWindow = (): Record<string, unknown> => {
    const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
    const add = (event: string, fn: (...args: unknown[]) => void): void => {
      const next = handlers.get(event) ?? []
      next.push(fn)
      handlers.set(event, next)
    }
    return {
      webContents: {
        send: vi.fn(),
        on: vi.fn((event: string, fn: (...args: unknown[]) => void) => add(`web:${event}`, fn)),
        setWindowOpenHandler: vi.fn(),
      },
      isDestroyed: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(true),
      showInactive: vi.fn(),
      hide: vi.fn(),
      setSize: vi.fn(),
      setMinimumSize: vi.fn(),
      setResizable: vi.fn(),
      setContentProtection: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn(),
      setHiddenInMissionControl: vi.fn(),
      setWindowButtonVisibility: vi.fn(),
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockResolvedValue(undefined),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => add(event, fn)),
      once: vi.fn((event: string, fn: (...args: unknown[]) => void) => add(event, fn)),
      emit: vi.fn((event: string, ...args: unknown[]) => {
        for (const fn of handlers.get(event) ?? []) fn(...args)
      }),
    }
  }

  return {
    BrowserWindow: class {
      constructor(options: Record<string, unknown>) {
        const win = createWindow()
        electronState.constructedOptions.push(options)
        electronState.constructedWindows.push(win)
        return win
      }
    },
    app: { isPackaged: false },
    screen: {
      getPrimaryDisplay: () => ({ workAreaSize: electronState.workAreaSize }),
    },
  }
})

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: platformRef.current, configurable: true })
  electronState.constructedOptions.length = 0
  electronState.constructedWindows.length = 0
  electronState.workAreaSize = { width: 1440, height: 900 }
})

async function load(): Promise<typeof import('@main/window')> {
  vi.resetModules()
  return await import('@main/window')
}

describe('window mode helpers', () => {
  let win: FakeBrowserWindow
  beforeEach(() => {
    win = makeFakeWindow()
  })

  it('setMode(compact) shrinks window to compact size and locks resizing', async () => {
    const { setMode, COMPACT_SIZE } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'compact')
    expect(win.setResizable).toHaveBeenCalledWith(false)
    expect(win.setMinimumSize).toHaveBeenCalledWith(COMPACT_SIZE.width, COMPACT_SIZE.height)
    expect(win.setSize).toHaveBeenCalledWith(COMPACT_SIZE.width, COMPACT_SIZE.height, expect.any(Boolean))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'compact' })
  })

  it('setMode(normal) restores normal size and resizable=true', async () => {
    const { setMode, NORMAL_SIZE } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'normal')
    expect(win.setResizable).toHaveBeenCalledWith(true)
    expect(win.setMinimumSize).toHaveBeenCalledWith(380, 340)
    expect(win.setSize).toHaveBeenCalledWith(NORMAL_SIZE.width, NORMAL_SIZE.height, expect.any(Boolean))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'normal' })
  })

  it('setMode(wide) sets wide dimensions and broadcasts', async () => {
    const { setMode, WIDE_SIZE } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'wide')
    expect(win.setMinimumSize).toHaveBeenCalledWith(380, 340)
    expect(win.setSize).toHaveBeenCalledWith(WIDE_SIZE.width, WIDE_SIZE.height, expect.any(Boolean))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'wide' })
  })

  it('getMode reflects the last mode set', async () => {
    const { setMode, getMode } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'compact')
    expect(getMode()).toBe('compact')
    setMode(win as unknown as Parameters<typeof setMode>[0], 'wide')
    expect(getMode()).toBe('wide')
  })

  it('cycleHudSize walks compact → normal → wide and wraps back to compact', async () => {
    const { setMode, cycleHudSize, getMode } = await load()
    const w = win as unknown as Parameters<typeof setMode>[0]
    setMode(w, 'compact')

    cycleHudSize(w)
    expect(getMode()).toBe('normal')
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'normal' })

    cycleHudSize(w)
    expect(getMode()).toBe('wide')

    cycleHudSize(w)
    expect(getMode()).toBe('compact')
  })

  it('cycleHudSize can leave compact mode, so the overlay is never stuck at one size', async () => {
    const { setMode, cycleHudSize } = await load()
    const w = win as unknown as Parameters<typeof setMode>[0]
    setMode(w, 'compact')
    win.webContents.send = vi.fn()
    cycleHudSize(w)
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'normal' })
  })

  it('toggleWindowVisibility hides when visible and broadcasts visible:false', async () => {
    const { toggleWindowVisibility } = await load()
    win.isVisible = vi.fn().mockReturnValue(true)
    toggleWindowVisibility(win as unknown as Parameters<typeof toggleWindowVisibility>[0])
    expect(win.hide).toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowVisibilityChanged, { visible: false })
  })

  it('toggleWindowVisibility shows when hidden and broadcasts visible:true', async () => {
    const { toggleWindowVisibility } = await load()
    win.isVisible = vi.fn().mockReturnValue(false)
    toggleWindowVisibility(win as unknown as Parameters<typeof toggleWindowVisibility>[0])
    expect(win.showInactive).toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowVisibilityChanged, { visible: true })
  })

  it('mutating helpers are no-ops when window is destroyed', async () => {
    const { setMode, cycleHudSize, toggleWindowVisibility } = await load()
    win.isDestroyed = vi.fn().mockReturnValue(true)
    setMode(win as unknown as Parameters<typeof setMode>[0], 'compact')
    cycleHudSize(win as unknown as Parameters<typeof cycleHudSize>[0])
    toggleWindowVisibility(win as unknown as Parameters<typeof toggleWindowVisibility>[0])
    expect(win.setSize).not.toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('createOverlayWindow uses stealth overlay BrowserWindow options and positioning', async () => {
    electronState.workAreaSize = { width: 1600, height: 900 }
    const { createOverlayWindow, NORMAL_SIZE } = await load()
    createOverlayWindow()

    const options = electronState.constructedOptions[0]
    expect(options).toMatchObject({
      width: NORMAL_SIZE.width,
      height: NORMAL_SIZE.height,
      x: 1600 - NORMAL_SIZE.width - 24,
      y: 60,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      fullscreenable: false,
      minimizable: false,
      maximizable: false,
      resizable: true,
      movable: true,
      backgroundColor: '#00000000',
      type: 'panel',
    })
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    })
    expect(String((options.webPreferences as { preload: string }).preload)).toContain('preload/index.mjs')
  })

  it('createOverlayWindow applies content protection and always-on-top workspace settings', async () => {
    const { createOverlayWindow } = await load()
    const created = createOverlayWindow() as unknown as FakeBrowserWindow

    expect(created.setContentProtection).toHaveBeenCalledWith(true)
    expect(created.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver')
    expect(created.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true })
    expect(created.setHiddenInMissionControl).toHaveBeenCalledWith(true)
    expect(created.setWindowButtonVisibility).toHaveBeenCalledWith(false)
  })

  it('blocks untrusted navigation and all renderer-created windows', async () => {
    const { createOverlayWindow } = await load()
    const created = createOverlayWindow() as unknown as FakeBrowserWindow
    const preventDefault = vi.fn()
    const navigationHandler = vi.mocked(created.webContents.on).mock.calls
      .find(([event]) => event === 'will-navigate')?.[1] as ((event: { preventDefault(): void }, url: string) => void)

    navigationHandler({ preventDefault }, 'https://attacker.example/')

    expect(preventDefault).toHaveBeenCalled()
    expect(created.webContents.setWindowOpenHandler).toHaveBeenCalled()
    const openHandler = created.webContents.setWindowOpenHandler.mock.calls[0][0] as () => { action: string }
    expect(openHandler()).toEqual({ action: 'deny' })
  })

  it('createOverlayWindow ready/focus events show inactive and broadcast focus state', async () => {
    const { createOverlayWindow } = await load()
    const created = createOverlayWindow() as unknown as FakeBrowserWindow

    created.emit('ready-to-show')
    expect(created.showInactive).toHaveBeenCalled()

    created.emit('blur')
    expect(created.webContents.send).toHaveBeenCalledWith(IPC.windowFocusState, { focused: false })

    created.emit('focus')
    expect(created.webContents.send).toHaveBeenCalledWith(IPC.windowFocusState, { focused: true })
  })
})
