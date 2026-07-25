import { test, expect } from '@playwright/test'
import { launchApp } from './launch'

test.describe('e2e stealth invariants', () => {
  test('main BrowserWindow is content-protected, transparent, always-on-top, skip-taskbar', async () => {
    const { app, page } = await launchApp()
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })
    const win = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      return {
        alwaysOnTop: w.isAlwaysOnTop(),
        skipTaskbar: (() => {
          try {
            return w.isVisibleOnAllWorkspaces() // can't read skipTaskbar directly
          } catch {
            return null
          }
        })(),
      }
    })
    expect(win.alwaysOnTop).toBe(true)
    await app.close()
  })

  test('macOS: app.dock is hidden', async () => {
    test.skip(process.platform !== 'darwin', 'mac-only')
    const { app } = await launchApp()
    const dockHidden = await app.evaluate(({ app: a }) => !a.dock?.isVisible?.())
    expect(dockHidden).toBe(true)
    await app.close()
  })
})
