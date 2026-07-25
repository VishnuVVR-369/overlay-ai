import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeFakeWindow } from '../../helpers/electron-mock'
import { IPC } from '@shared/ipc-channels'

const platformRef = { current: 'darwin' as NodeJS.Platform }
const callbacks = new Map<string, () => void>()
const registerSpy = vi.fn((accel: string, cb: () => void) => {
  callbacks.set(accel, cb)
  return true
})
const willQuitListeners: Array<() => void> = []
const triggerPanicSpy = vi.fn()

vi.mock('electron', () => ({
  app: {
    on: (event: string, fn: () => void) => {
      if (event === 'will-quit') willQuitListeners.push(fn)
    },
    once: (event: string, fn: () => void) => {
      if (event === 'will-quit') willQuitListeners.push(fn)
    },
  },
  globalShortcut: {
    register: (...args: [string, () => void]) => registerSpy(...args),
    unregisterAll: vi.fn(),
  },
}))

vi.mock('@main/panic', () => ({
  triggerPanic: (...args: unknown[]) => triggerPanicSpy(...args),
}))

beforeEach(() => {
  callbacks.clear()
  willQuitListeners.length = 0
  triggerPanicSpy.mockClear()
  registerSpy.mockClear().mockImplementation((accel: string, cb: () => void) => {
    callbacks.set(accel, cb)
    return true
  })
  Object.defineProperty(process, 'platform', { value: platformRef.current, configurable: true })
})

async function load(platform: NodeJS.Platform = 'darwin'): Promise<typeof import('@main/shortcuts')> {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  vi.resetModules()
  return await import('@main/shortcuts')
}

type RegisterShortcuts = typeof import('@main/shortcuts')['registerShortcuts']
const asWin = (win: ReturnType<typeof makeFakeWindow>): Parameters<RegisterShortcuts>[0] =>
  win as unknown as Parameters<RegisterShortcuts>[0]

describe('global shortcuts', () => {
  it('registers the six accelerators on macOS', async () => {
    const { registerShortcuts } = await load('darwin')
    const reg = registerShortcuts(asWin(makeFakeWindow()))
    expect(reg.ask.accelerator).toBe('Cmd+\\')
    expect(reg.screenAsk.accelerator).toBe('Cmd+Shift+\\')
    expect(reg.toggle.accelerator).toBe('Cmd+Shift+B')
    expect(reg.listen.accelerator).toBe('Cmd+Shift+L')
    expect(reg.hud.accelerator).toBe('Cmd+Shift+E')
    expect(reg.panic.accelerator).toBe('Cmd+Shift+Escape')
    expect(Object.values(reg).every((slot) => slot.ok)).toBe(true)
  })

  it('uses Ctrl-prefixed accelerators on non-mac', async () => {
    const { registerShortcuts } = await load('win32')
    const reg = registerShortcuts(asWin(makeFakeWindow()))
    expect(reg.ask.accelerator).toBe('Ctrl+\\')
    expect(reg.screenAsk.accelerator).toBe('Ctrl+Shift+\\')
    expect(reg.toggle.accelerator).toBe('Ctrl+Shift+B')
    expect(reg.listen.accelerator).toBe('Ctrl+Shift+L')
    expect(reg.hud.accelerator).toBe('Ctrl+Shift+E')
    expect(reg.panic.accelerator).toBe('Ctrl+Shift+Escape')
  })

  it('never claims plain Cmd+W or Cmd+B, which other apps need for close-tab and bold', async () => {
    const { registerShortcuts } = await load('darwin')
    registerShortcuts(asWin(makeFakeWindow()))
    const claimed = [...callbacks.keys()]
    expect(claimed).not.toContain('Cmd+W')
    expect(claimed).not.toContain('Cmd+B')
  })

  it('reports {ok:false} for any individual registration that fails', async () => {
    registerSpy.mockImplementation((accel: string, cb: () => void) => {
      callbacks.set(accel, cb)
      return accel !== 'Cmd+Shift+B'
    })
    const { registerShortcuts } = await load('darwin')
    const reg = registerShortcuts(asWin(makeFakeWindow()))
    expect(reg.toggle.ok).toBe(false)
    expect(reg.ask.ok).toBe(true)
    expect(reg.listen.ok).toBe(true)
  })

  it('Cmd+\\ sends llmTrigger to the window', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+\\')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmTrigger)
  })

  it('Cmd+Shift+\\ sends visionTrigger', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+Shift+\\')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.visionTrigger)
  })

  it('Cmd+Shift+L sends listenTrigger, so listening toggles while the overlay is unfocused', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+Shift+L')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.listenTrigger)
  })

  it('Cmd+Shift+B toggles window visibility', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+Shift+B')!()
    expect(win.hide).toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowVisibilityChanged, { visible: false })
  })

  it('Cmd+Shift+E cycles the HUD size', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+Shift+E')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.windowModeChanged, { mode: expect.any(String) })
  })

  it('renderer-bound callbacks are no-ops when the window is destroyed', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    win.isDestroyed.mockReturnValue(true)
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+\\')!()
    callbacks.get('Cmd+Shift+\\')!()
    callbacks.get('Cmd+Shift+L')!()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('getShortcutRegistration returns the last registration', async () => {
    const { registerShortcuts, getShortcutRegistration } = await load()
    const reg = registerShortcuts(asWin(makeFakeWindow()))
    expect(getShortcutRegistration()).toBe(reg)
  })

  it('retargets existing shortcut handlers when the window is recreated', async () => {
    const { registerShortcuts } = await load('darwin')
    const first = makeFakeWindow()
    const second = makeFakeWindow()
    registerShortcuts(asWin(first))
    registerShortcuts(asWin(second))

    callbacks.get('Cmd+\\')!()

    expect(first.webContents.send).not.toHaveBeenCalled()
    expect(second.webContents.send).toHaveBeenCalledWith(IPC.llmTrigger)
    expect(registerSpy).toHaveBeenCalledTimes(6)
  })

  it('hooks app "will-quit" to unregister all shortcuts', async () => {
    const { registerShortcuts } = await load()
    registerShortcuts(asWin(makeFakeWindow()))
    expect(willQuitListeners.length).toBe(1)
  })

  it('Cmd+Shift+Escape invokes triggerPanic with the window', async () => {
    const { registerShortcuts } = await load('darwin')
    const win = makeFakeWindow()
    registerShortcuts(asWin(win))
    callbacks.get('Cmd+Shift+Escape')!()
    expect(triggerPanicSpy).toHaveBeenCalledTimes(1)
    expect(triggerPanicSpy.mock.calls[0][0]).toBe(win)
  })

  it('a registration that throws synchronously is caught and reported as ok:false', async () => {
    registerSpy.mockImplementation((accel: string, cb: () => void) => {
      if (accel === 'Cmd+Shift+Escape') throw new Error('OS reserves this shortcut')
      callbacks.set(accel, cb)
      return true
    })
    const { registerShortcuts } = await load('darwin')
    const reg = registerShortcuts(asWin(makeFakeWindow()))
    expect(reg.panic.ok).toBe(false)
    expect(reg.ask.ok).toBe(true)
  })
})
