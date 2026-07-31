import { vi } from 'vitest'

export type ScriptedEvent =
  | { type: 'response.output_text.delta'; delta: string }
  | { type: 'response.completed'; response: { status: string; output_text?: string } }
  | { type: 'response.failed'; response: { error?: { message: string } } }
  | { type: 'response.incomplete'; response: { incomplete_details?: { reason: string } } }
  | { type: 'error'; message: string }
  | { type: 'throw'; message: string }

export function createOpenAIMock(events: ScriptedEvent[] = [], opts?: { delayMs?: number }): {
  OpenAIMock: ReturnType<typeof vi.fn>
  createSpy: ReturnType<typeof vi.fn>
  signals: AbortSignal[]
  lastParams?: unknown
} {
  let lastParams: unknown
  const signals: AbortSignal[] = []
  const createSpy = vi.fn(async (params: unknown, callOpts: { signal?: AbortSignal }) => {
    lastParams = params
    if (callOpts.signal) signals.push(callOpts.signal)
    async function* iterator(): AsyncGenerator<ScriptedEvent> {
      for (const evt of events) {
        if (callOpts.signal?.aborted) return
        if (opts?.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
        if (callOpts.signal?.aborted) return
        if (evt.type === 'throw') throw new Error(evt.message)
        yield evt
        await Promise.resolve()
      }
    }
    return iterator()
  })
  const OpenAIMock = vi.fn().mockImplementation(() => ({
    responses: { create: createSpy },
  }))
  return {
    OpenAIMock,
    createSpy,
    signals,
    get lastParams() {
      return lastParams
    },
  }
}
