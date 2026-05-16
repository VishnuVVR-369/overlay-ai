import { vi } from 'vitest'

export type ScriptedEvent =
  | { type: 'response.output_text.delta'; delta: string }
  | { type: 'response.completed'; response: { status: string; output_text?: string } }
  | { type: 'response.failed'; response: { error?: { message: string } } }
  | { type: 'response.incomplete'; response: { incomplete_details?: { reason: string } } }
  | { type: 'error'; message: string }

export function createOpenAIMock(events: ScriptedEvent[] = [], opts?: { delayMs?: number }): {
  OpenAIMock: ReturnType<typeof vi.fn>
  createSpy: ReturnType<typeof vi.fn>
  lastParams?: unknown
} {
  let lastParams: unknown
  const createSpy = vi.fn(async (params: unknown, callOpts: { signal?: AbortSignal }) => {
    lastParams = params
    async function* iterator(): AsyncGenerator<ScriptedEvent> {
      for (const evt of events) {
        if (callOpts.signal?.aborted) return
        if (opts?.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
        if (callOpts.signal?.aborted) return
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
    get lastParams() {
      return lastParams
    },
  }
}
