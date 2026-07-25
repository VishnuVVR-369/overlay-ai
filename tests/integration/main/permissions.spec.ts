import { describe, expect, it, vi, beforeEach } from 'vitest'

const platformRef = { current: 'darwin' as NodeJS.Platform }
const micStatusRef = { current: 'granted' as 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' }
const screenStatusRef = { current: 'granted' as 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown' }
const askForMediaAccessSpy = vi.fn(async () => true)
const openExternalSpy = vi.fn(async () => undefined)

vi.mock('electron', () => ({
  systemPreferences: {
    getMediaAccessStatus: (kind: string) => (kind === 'microphone' ? micStatusRef.current : screenStatusRef.current),
    askForMediaAccess: (...args: unknown[]) => askForMediaAccessSpy(...args),
  },
  shell: { openExternal: (...args: unknown[]) => openExternalSpy(...args) },
}))

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: platformRef.current, configurable: true })
  askForMediaAccessSpy.mockReset().mockResolvedValue(true)
  openExternalSpy.mockReset().mockResolvedValue(undefined)
})

async function load(): Promise<typeof import('@main/permissions')> {
  vi.resetModules()
  return await import('@main/permissions')
}

describe('permissions', () => {
  it('returns granted/granted on non-mac platforms regardless of upstream', async () => {
    platformRef.current = 'win32'
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    micStatusRef.current = 'denied'
    screenStatusRef.current = 'denied'
    const { getPermissionStatus, requestMicAccess, openScreenRecordingPrefs } = await load()
    expect(getPermissionStatus()).toEqual({ mic: 'granted', screen: 'granted' })
    await expect(requestMicAccess()).resolves.toBe(true)
    await openScreenRecordingPrefs()
    expect(openExternalSpy).not.toHaveBeenCalled()
  })

  it('on darwin, surfaces the underlying systemPreferences mic and screen states', async () => {
    platformRef.current = 'darwin'
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    micStatusRef.current = 'denied'
    screenStatusRef.current = 'not-determined'
    const { getPermissionStatus } = await load()
    expect(getPermissionStatus()).toEqual({ mic: 'denied', screen: 'not-determined' })
  })

  it('requestMicAccess on darwin resolves the system prompt result', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    askForMediaAccessSpy.mockResolvedValueOnce(false)
    const { requestMicAccess } = await load()
    await expect(requestMicAccess()).resolves.toBe(false)
    expect(askForMediaAccessSpy).toHaveBeenCalledWith('microphone')
  })

  it('openScreenRecordingPrefs on darwin opens the privacy URL', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    const { openScreenRecordingPrefs } = await load()
    await openScreenRecordingPrefs()
    expect(openExternalSpy).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    )
  })
})
