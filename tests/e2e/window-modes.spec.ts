import { test, expect } from '@playwright/test'
import { launchApp } from './launch'

test.describe('e2e window modes', () => {
  test('window switches between compact, normal, and wide via setMode', async ({}, testInfo) => {
    testInfo.setTimeout(45_000)
    const { app, page } = await launchApp()
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })

    const sizeAfter = async (mode: 'compact' | 'normal' | 'wide'): Promise<{ width: number; height: number }> => {
      await page.evaluate(async (m) => {
        const api = (window as unknown as { api: { window: { setMode: (m: string) => Promise<void> } } }).api
        await api.window.setMode(m)
      }, mode)
      return await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]
        const [width, height] = w.getSize()
        return { width, height }
      })
    }

    const compact = await sizeAfter('compact')
    expect(compact.width).toBe(360)
    expect(compact.height).toBe(120)

    const normal = await sizeAfter('normal')
    expect(normal.width).toBe(460)
    expect(normal.height).toBe(620)

    const wide = await sizeAfter('wide')
    expect(wide.width).toBe(760)
    expect(wide.height).toBe(620)

    await app.close()
  })
})
