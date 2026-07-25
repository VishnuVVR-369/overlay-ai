import { vi } from 'vitest'

export interface ScriptedDelta {
  delta?: string
  finishReason?: string | null
  throwAt?: boolean
  abortAt?: boolean
  delayMs?: number
}

export function createGroqMock(deltas: ScriptedDelta[] = []): {
  GroqMock: ReturnType<typeof vi.fn>
  createSpy: ReturnType<typeof vi.fn>
  signals: AbortSignal[]
} {
  const signals: AbortSignal[] = []
  const createSpy = vi.fn(async (_params: unknown, opts: { signal?: AbortSignal }) => {
    if (opts.signal) signals.push(opts.signal)
    async function* iterator(): AsyncGenerator<unknown> {
      for (const step of deltas) {
        if (opts.signal?.aborted) return
        if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs))
        if (opts.signal?.aborted) return
        if (step.throwAt) throw new Error('mock-groq error')
        yield {
          choices: [{ delta: { content: step.delta ?? '' }, finish_reason: step.finishReason ?? null }],
        }
        await Promise.resolve()
      }
    }
    return iterator()
  })

  const GroqMock = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createSpy } },
  }))

  return { GroqMock, createSpy, signals }
}
