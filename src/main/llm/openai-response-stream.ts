import { randomUUID } from 'node:crypto'
import type { ResponseStreamEvent } from 'openai/resources/responses/responses'

export interface StreamCallbacks {
  onToken: (delta: string) => void
  onDone: (full: string, finishReason?: string | null) => void
  onError: (message: string) => void
}

interface ResponseStreamErrors {
  failed: string
  incomplete: string
  unknown: string
}

export class OpenAIResponseStreamRunner {
  private current: { id: string; controller: AbortController } | null = null

  abort(): void {
    if (!this.current) return
    this.current.controller.abort()
    this.current = null
  }

  async run(
    createStream: (signal: AbortSignal) => Promise<AsyncIterable<ResponseStreamEvent>>,
    callbacks: StreamCallbacks,
    errors: ResponseStreamErrors,
  ): Promise<string> {
    this.abort()
    const requestId = randomUUID()
    const controller = new AbortController()
    this.current = { id: requestId, controller }
    let full = ''

    try {
      const stream = await createStream(controller.signal)
      let finishReason: string | null | undefined
      for await (const event of stream) {
        if (controller.signal.aborted) break
        if (event.type === 'response.output_text.delta') {
          full += event.delta
          callbacks.onToken(event.delta)
        } else if (event.type === 'response.completed') {
          finishReason = event.response.status
          if (!full && event.response.output_text) full = event.response.output_text
        } else {
          const message = errorMessageForEvent(event, errors)
          if (message) throw new Error(message)
        }
      }
      if (!controller.signal.aborted) callbacks.onDone(full, finishReason)
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string }
      if (error.name === 'AbortError') return requestId
      callbacks.onError(error.message ?? errors.unknown)
    } finally {
      if (this.current?.id === requestId) this.current = null
    }

    return requestId
  }
}

function errorMessageForEvent(event: ResponseStreamEvent, errors: ResponseStreamErrors): string | null {
  if (event.type === 'error') return event.message
  if (event.type === 'response.failed') return event.response.error?.message ?? errors.failed
  if (event.type === 'response.incomplete') {
    return event.response.incomplete_details?.reason ?? errors.incomplete
  }
  return null
}
