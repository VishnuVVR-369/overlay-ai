import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/unused-userdata-vault-sanitize' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

async function loadSanitize(): Promise<typeof import('@main/settings').sanitizeVault> {
  vi.resetModules()
  const mod = await import('@main/settings')
  return mod.sanitizeVault
}

let sanitizeVault: Awaited<ReturnType<typeof loadSanitize>>

beforeEach(async () => {
  sanitizeVault = await loadSanitize()
})

describe('sanitizeVault', () => {
  it('returns the empty vault for non-object input', () => {
    expect(sanitizeVault(null)).toMatchObject({ resume: '', stories: [] })
    expect(sanitizeVault(undefined)).toMatchObject({ resume: '', stories: [] })
    expect(sanitizeVault(42)).toMatchObject({ resume: '', stories: [] })
    expect(sanitizeVault('a string')).toMatchObject({ resume: '', stories: [] })
  })

  it('drops unknown fields and keeps known ones', () => {
    const v = sanitizeVault({ resume: 'hi', evil: 'rm -rf', stories: [] })
    expect(v.resume).toBe('hi')
    expect('evil' in v).toBe(false)
  })

  it('trims and caps oversized fields without throwing', () => {
    const big = 'a'.repeat(50_000)
    const v = sanitizeVault({ resume: big })
    expect(v.resume.length).toBeLessThanOrEqual(8000)
    expect(v.resume.length).toBeGreaterThan(0)
  })

  it('coerces stories array, drops incomplete stories, keeps title/body, caps body', () => {
    const v = sanitizeVault({
      stories: [
        { id: 'a', title: 'good', body: 'b' },
        { id: 'b', title: '', body: '' },
        { id: 'title-only', title: 'missing body', body: '' },
        { id: 'body-only', title: '', body: 'missing title' },
        { id: 'c', title: 'x', body: 'y'.repeat(5000) },
        'garbage',
        null,
      ],
    })
    expect(v.stories).toHaveLength(2)
    expect(v.stories[0]).toMatchObject({ id: 'a', title: 'good', body: 'b' })
    expect(v.stories[1].body.length).toBeLessThanOrEqual(2000)
  })

  it('caps the number of stories at the documented maximum', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ id: `s${i}`, title: `t${i}`, body: 'b' }))
    const v = sanitizeVault({ stories: many })
    expect(v.stories.length).toBeLessThanOrEqual(25)
  })

  it('survives a JSON round-trip', () => {
    const original = sanitizeVault({
      resume: 'r',
      jobDescription: 'j',
      stories: [{ id: 's1', title: 't', body: '<script>alert(1)</script>' }],
    })
    const round = sanitizeVault(JSON.parse(JSON.stringify(original)))
    expect(round).toEqual(original)
  })
})
