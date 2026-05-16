import { test, expect } from '@playwright/test'
import { launchApp } from './launch'

test.describe('e2e transcription status', () => {
  test('transcription:start without an ElevenLabs key returns missing_key reason', async () => {
    const { app, page } = await launchApp()
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })
    const result = await page.evaluate(async () => {
      const api = (window as unknown as { api: { transcription: { start: () => Promise<{ ok: boolean; reason?: string }> } } }).api
      return await api.transcription.start()
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_key')
    await app.close()
  })

  test('transcription:status reports running:false initially', async () => {
    const { app, page } = await launchApp()
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })
    const status = await page.evaluate(async () => {
      const api = (window as unknown as { api: { transcription: { status: () => Promise<{ running: boolean; micState: string; systemState: string }> } } }).api
      return await api.transcription.status()
    })
    expect(status).toEqual({ running: false, micState: 'idle', systemState: 'idle' })
    await app.close()
  })

  test('presets:get returns all four preset ids in canonical order', async () => {
    const { app, page } = await launchApp()
    await page.waitForSelector('.app-root, .app-compact', { timeout: 10_000 })
    const presets = await page.evaluate(async () => {
      const api = (window as unknown as { api: { presets: { get: () => Promise<{ active: string; presets: { id: string }[] }> } } }).api
      return await api.presets.get()
    })
    expect(presets.presets.map((p) => p.id)).toEqual(['behavioral', 'coding', 'system-design', 'negotiation'])
    expect(['behavioral', 'coding', 'system-design', 'negotiation']).toContain(presets.active)
    await app.close()
  })
})
