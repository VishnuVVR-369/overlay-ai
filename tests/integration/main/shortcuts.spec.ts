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

vi.mock('electron', () => ({
  app: {
    on: (event: string, fn: () => void) => {
      if (event === 'will-quit') willQuitListeners.push(fn)
    },
  },
  globalShortcut: {
    register: (...args: [string, () => void]) => registerSpy(...args),
    unregisterAll: vi.fn(),
  },
}))

beforeEach(() => {
  callbacks.clear()
  willQuitListeners.length = 0
  registerSpy.mockClear().mockImplementation((accel: string, cb: () => void) => {
    callbacks.set(accel, cb)
    return true
  })
  Object.defineProperty(process, 'platform', { value: platformRef.current, configurable: true })
})

async function load(): Promise<typeof import('@main/shortcuts')> {
  vi.resetModules()
  return await import('@main/shortcuts')
}

describe('global shortcuts', () => {
  it('registers all four expected accelerators on macOS', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    const reg = registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    expect(reg.ask.accelerator).toBe('Cmd+\\')
    expect(reg.screenAsk.accelerator).toBe('Cmd+Shift+\\')
    expect(reg.toggle.accelerator).toBe('Cmd+B')
    expect(reg.wide.accelerator).toBe('Cmd+W')
    expect(reg.ask.ok && reg.screenAsk.ok && reg.toggle.ok && reg.wide.ok).toBe(true)
  })

  it('uses Ctrl-prefixed accelerators on non-mac', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    const reg = registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    expect(reg.ask.accelerator).toBe('Ctrl+\\')
    expect(reg.screenAsk.accelerator).toBe('Ctrl+Shift+\\')
    expect(reg.toggle.accelerator).toBe('Ctrl+B')
    expect(reg.wide.accelerator).toBe('Ctrl+W')
  })

  it('reports {ok:false} for any individual registration that fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    registerSpy.mockImplementation((accel: string, cb: () => void) => {
      callbacks.set(accel, cb)
      return accel !== 'Cmd+B'
    })
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    const reg = registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    expect(reg.toggle.ok).toBe(false)
    expect(reg.ask.ok).toBe(true)
    expect(reg.screenAsk.ok).toBe(true)
    expect(reg.wide.ok).toBe(true)
  })

  it('Cmd+\\ callback sends llmTrigger to the window', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    callbacks.get('Cmd+\\')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.llmTrigger)
  })

  it('Cmd+Shift+\\ callback sends visionTrigger', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    callbacks.get('Cmd+Shift+\\')!()
    expect(win.webContents.send).toHaveBeenCalledWith(IPC.visionTrigger)
  })

  it('hooks app "will-quit" to unregister all shortcuts', async () => {
    const { registerShortcuts } = await load()
    const win = makeFakeWindow()
    registerShortcuts(win as unknown as Parameters<typeof registerShortcuts>[0])
    expect(willQuitListeners.length).toBe(1)
  })
})
