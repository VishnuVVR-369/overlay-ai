import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeFakeWindow, type FakeBrowserWindow } from '../../helpers/electron-mock'
import { IPC } from '@shared/ipc-channels'

const platformRef = { current: 'darwin' as NodeJS.Platform }

vi.mock('electron', () => ({
  BrowserWindow: class {},
  app: { isPackaged: false },
  screen: {
    getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }),
  },
}))

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: platformRef.current, configurable: true })
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
    expect(win.setSize).toHaveBeenCalledWith(NORMAL_SIZE.width, NORMAL_SIZE.height, expect.any(Boolean))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'normal' })
  })

  it('setMode(wide) sets wide dimensions and broadcasts', async () => {
    const { setMode, WIDE_SIZE } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'wide')
    expect(win.setSize).toHaveBeenCalledWith(WIDE_SIZE.width, WIDE_SIZE.height, expect.any(Boolean))
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'wide' })
  })

  it('toggleWide flips between normal and wide', async () => {
    const { setMode, toggleWide } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'normal')
    toggleWide(win as unknown as Parameters<typeof toggleWide>[0])
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'wide' })
    toggleWide(win as unknown as Parameters<typeof toggleWide>[0])
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: 'normal' })
  })

  it('toggleWide is a no-op while in compact mode', async () => {
    const { setMode, toggleWide } = await load()
    setMode(win as unknown as Parameters<typeof setMode>[0], 'compact')
    win.webContents.send = vi.fn()
    toggleWide(win as unknown as Parameters<typeof toggleWide>[0])
    expect(win.webContents.send).not.toHaveBeenCalled()
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
    const { setMode, toggleWide, toggleWindowVisibility } = await load()
    win.isDestroyed = vi.fn().mockReturnValue(true)
    setMode(win as unknown as Parameters<typeof setMode>[0], 'compact')
    toggleWide(win as unknown as Parameters<typeof toggleWide>[0])
    toggleWindowVisibility(win as unknown as Parameters<typeof toggleWindowVisibility>[0])
    expect(win.setSize).not.toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })
})
