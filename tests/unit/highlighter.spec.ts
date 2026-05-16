// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getHighlighter, SHIKI_THEME } from '@/markdown/highlighter'

describe('shiki highlighter', () => {
  it('exports the vitesse-black theme name', () => {
    expect(SHIKI_THEME).toBe('vitesse-black')
  })

  it('returns a singleton highlighter across multiple calls', async () => {
    const a = await getHighlighter()
    const b = await getHighlighter()
    expect(a).toBe(b)
  })

  it('highlights typescript code without throwing', async () => {
    const hl = await getHighlighter()
    const html = hl.codeToHtml('const x: number = 1', { lang: 'typescript', theme: 'vitesse-black' })
    expect(html).toContain('<pre')
    expect(html).toContain('1')
  })

  it('highlights bash code without throwing', async () => {
    const hl = await getHighlighter()
    const html = hl.codeToHtml('echo hello', { lang: 'bash', theme: 'vitesse-black' })
    expect(html).toContain('echo')
  })
}, 20_000)