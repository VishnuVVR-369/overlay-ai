import { test, expect } from '@playwright/test'
import { launchApp } from './launch'

test.describe('e2e smoke', () => {
  test('app launches, root renders, no console errors after settle', async () => {
    const { app, page } = await launchApp()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
    })
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
    await app.close()
  })

  test('preload exposes window.api with the full OverlayApi shape', async () => {
    const { app, page } = await launchApp()
    const sections = await page.evaluate(() => {
      const api = (window as unknown as { api: Record<string, unknown> }).api
      return {
        keys: Object.keys(api).sort(),
        hasInternalStoreBridge: '__stores' in window,
      }
    })
    expect(sections.keys).toEqual(
      [
        'answerStyles',
        'llm',
        'loopback',
        'mock',
        'mockSessions',
        'panic',
        'permissions',
        'presets',
        'readiness',
        'settings',
        'transcription',
        'ui',
        'vault',
        'vision',
        'window',
      ].sort(),
    )
    expect(sections.hasInternalStoreBridge).toBe(false)
    await app.close()
  })

  test('settings:get returns key flags only — never raw key material', async () => {
    const { app, page } = await launchApp()
    const status = await page.evaluate(async () => {
      const api = (window as unknown as { api: { settings: { get: () => Promise<Record<string, unknown>> } } }).api
      return await api.settings.get()
    })
    expect(status).toHaveProperty('openaiKeySet')
    expect(JSON.stringify(status)).not.toMatch(/sk-|sk_|gsk_/)
    await app.close()
  })
})
