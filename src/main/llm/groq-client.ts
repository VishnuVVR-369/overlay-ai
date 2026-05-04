import { randomUUID } from 'node:crypto'
import Groq from 'groq-sdk'
import { SYSTEM_PROMPT } from '@shared/prompt'

export interface StreamCallbacks {
  onToken: (delta: string) => void
  onDone: (full: string, finishReason?: string | null) => void
  onError: (message: string) => void
}

export class GroqClient {
  private current: { id: string; controller: AbortController } | null = null

  abort(): void {
    if (this.current) {
      this.current.controller.abort()
      this.current = null
    }
  }

  async streamAnswer(apiKey: string, transcript: string, callbacks: StreamCallbacks): Promise<string> {
    this.abort()
    const requestId = randomUUID()
    const controller = new AbortController()
    this.current = { id: requestId, controller }

    const client = new Groq({ apiKey })
    const userMessage = transcript.trim() || '(no transcript yet — invent a plausible interview question and answer it.)'

    let full = ''
    try {
      const stream = await client.chat.completions.create(
        {
          model: 'openai/gpt-oss-120b',
          stream: true,
          temperature: 0.6,
          max_tokens: 600,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
        },
        { signal: controller.signal },
      )

      let finishReason: string | null | undefined
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        const choice = chunk.choices?.[0]
        const delta = choice?.delta?.content ?? ''
        if (delta) {
          full += delta
          callbacks.onToken(delta)
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
      }
      if (!controller.signal.aborted) callbacks.onDone(full, finishReason)
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string }
      if (e.name === 'AbortError') return requestId
      callbacks.onError(e.message ?? 'Unknown Groq error')
    } finally {
      if (this.current?.id === requestId) this.current = null
    }
    return requestId
  }
}

export const groq = new GroqClient()
