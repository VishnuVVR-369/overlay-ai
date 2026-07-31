import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import type { ResponseStreamEvent } from 'openai/resources/responses/responses'

const ANSWER_MODEL = 'gpt-5.6-sol'

export interface StreamCallbacks {
  onToken: (delta: string) => void
  onDone: (full: string, finishReason?: string | null) => void
  onError: (message: string) => void
}

export class OpenAIAnswerClient {
  private current: { id: string; controller: AbortController } | null = null

  abort(): void {
    if (this.current) {
      this.current.controller.abort()
      this.current = null
    }
  }

  async streamAnswer(
    apiKey: string,
    systemPrompt: string,
    transcript: string,
    callbacks: StreamCallbacks,
  ): Promise<string> {
    this.abort()
    const requestId = randomUUID()
    const controller = new AbortController()
    this.current = { id: requestId, controller }

    const client = new OpenAI({ apiKey })
    const input = transcript.trim() || '(no transcript yet — invent a plausible interview question and answer it.)'
    let full = ''

    try {
      const stream = await client.responses.create(
        {
          model: ANSWER_MODEL,
          instructions: systemPrompt,
          input,
          reasoning: { effort: 'low' },
          max_output_tokens: 600,
          stream: true,
        },
        { signal: controller.signal },
      )

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
          const message = errorMessageForEvent(event)
          if (message) throw new Error(message)
        }
      }
      if (!controller.signal.aborted) callbacks.onDone(full, finishReason)
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string }
      if (error.name === 'AbortError') return requestId
      callbacks.onError(error.message ?? 'Unknown OpenAI answer error')
    } finally {
      if (this.current?.id === requestId) this.current = null
    }
    return requestId
  }
}

function errorMessageForEvent(event: ResponseStreamEvent): string | null {
  if (event.type === 'error') return event.message
  if (event.type === 'response.failed') {
    return event.response.error?.message ?? 'OpenAI answer response failed.'
  }
  if (event.type === 'response.incomplete') {
    return event.response.incomplete_details?.reason ?? 'OpenAI answer response was incomplete.'
  }
  return null
}

export const openaiAnswer = new OpenAIAnswerClient()
