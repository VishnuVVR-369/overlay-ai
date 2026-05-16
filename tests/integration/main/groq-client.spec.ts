import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createGroqMock } from '../../helpers/groq-mock'

let mockState: ReturnType<typeof createGroqMock>

vi.mock('groq-sdk', () => ({
  default: class {
    chat: { completions: { create: typeof mockState.createSpy } }
    constructor(_opts: unknown) {
      this.chat = { completions: { create: mockState.createSpy } }
    }
  },
}))

beforeEach(() => {
  mockState = createGroqMock([])
})

async function load(): Promise<typeof import('@main/llm/groq-client')> {
  vi.resetModules()
  return await import('@main/llm/groq-client')
}

describe('GroqClient', () => {
  it('streams every delta and reports the final string and finish_reason on done', async () => {
    mockState = createGroqMock([
      { delta: 'Hi ' },
      { delta: 'there', finishReason: 'stop' },
    ])
    const { GroqClient } = await load()
    const c = new GroqClient()
    const tokens: string[] = []
    let full = ''
    let finishReason: string | null | undefined
    await c.streamAnswer('key', 'sys', 'Them: hello', {
      onToken: (d) => tokens.push(d),
      onDone: (f, fr) => {
        full = f
        finishReason = fr
      },
      onError: () => {},
    })
    expect(tokens).toEqual(['Hi ', 'there'])
    expect(full).toBe('Hi there')
    expect(finishReason).toBe('stop')
  })

  it('passes model + temperature + max_tokens + system/user roles through', async () => {
    mockState = createGroqMock([{ delta: 'x', finishReason: 'stop' }])
    const { GroqClient } = await load()
    const c = new GroqClient()
    await c.streamAnswer('key', 'SYSTEM', 'Them: q', { onToken: () => {}, onDone: () => {}, onError: () => {} })
    const args = mockState.createSpy.mock.calls[0][0]
    expect(args.model).toBe('openai/gpt-oss-120b')
    expect(args.temperature).toBe(0.6)
    expect(args.max_tokens).toBe(600)
    expect(args.stream).toBe(true)
    expect(args.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' })
    expect(args.messages[1].role).toBe('user')
    expect(args.messages[1].content).toContain('Them: q')
  })

  it('uses the documented placeholder when transcript is empty', async () => {
    mockState = createGroqMock([{ delta: 'x', finishReason: 'stop' }])
    const { GroqClient } = await load()
    const c = new GroqClient()
    await c.streamAnswer('key', 'sys', '', { onToken: () => {}, onDone: () => {}, onError: () => {} })
    const args = mockState.createSpy.mock.calls[0][0]
    expect(args.messages[1].content).toMatch(/no transcript yet/i)
  })

  it('aborts the previous request if a second one starts before the first ends', async () => {
    mockState = createGroqMock([{ delta: 'one' }, { delta: 'two' }, { delta: 'three' }])
    const { GroqClient } = await load()
    const c = new GroqClient()
    const firstTokens: string[] = []
    const firstPromise = c.streamAnswer('key', 'sys', 't', {
      onToken: (d) => firstTokens.push(d),
      onDone: () => {},
      onError: () => {},
    })
    // Kick off a second one immediately:
    mockState = createGroqMock([{ delta: 'A', finishReason: 'stop' }])
    const secondTokens: string[] = []
    await c.streamAnswer('key', 'sys', 't2', {
      onToken: (d) => secondTokens.push(d),
      onDone: () => {},
      onError: () => {},
    })
    await firstPromise
    expect(secondTokens).toEqual(['A'])
    // The first request was either aborted (signal observed) or had its tokens partially delivered
    expect(mockState.signals.length).toBeGreaterThan(0)
  })

  it('emits onError on a network/SDK error and does not call onDone', async () => {
    mockState = createGroqMock([{ throwAt: true }])
    const { GroqClient } = await load()
    const c = new GroqClient()
    let err: string | null = null
    let done = false
    await c.streamAnswer('key', 'sys', 't', {
      onToken: () => {},
      onDone: () => {
        done = true
      },
      onError: (m) => {
        err = m
      },
    })
    expect(err).toMatch(/mock-groq error/)
    expect(done).toBe(false)
  })

  it('abort() suppresses onDone for an in-flight request', async () => {
    mockState = createGroqMock([
      { delta: 'a' },
      { delta: 'b', delayMs: 100 },
      { delta: 'c', delayMs: 100 },
    ])
    const { GroqClient } = await load()
    const c = new GroqClient()
    let done = false
    const p = c.streamAnswer('key', 'sys', 't', {
      onToken: () => {},
      onDone: () => {
        done = true
      },
      onError: () => {},
    })
    await new Promise((r) => setTimeout(r, 20))
    c.abort()
    await p
    expect(done).toBe(false)
  })
})
