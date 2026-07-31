import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import type { ResponseStreamEvent } from 'openai/resources/responses/responses'
import type { StreamCallbacks } from './openai-answer-client'

const VISION_INSTRUCTIONS = `You are answering a live technical interview screen ask.

Treat the screenshot as the primary source of truth for visible code, diagrams, prompts, constraints, examples, errors, and whiteboard content. Use the transcript only as supporting context. If the screenshot contains a coding problem or code editor, explain the approach first, then provide concise code or pseudocode when useful. If it contains a system design diagram or prompt, identify the components, bottlenecks, trade-offs, and the next talking points. Keep the response concise and interview-spoken. Do not mention that you are looking at a screenshot unless it is necessary to disambiguate.`

export class OpenAIVisionClient {
  private current: { id: string; controller: AbortController } | null = null

  abort(): void {
    if (this.current) {
      this.current.controller.abort()
      this.current = null
    }
  }

  async streamScreenAnswer(
    apiKey: string,
    model: string,
    systemPrompt: string,
    transcript: string,
    imageDataUrl: string,
    callbacks: StreamCallbacks,
  ): Promise<string> {
    this.abort()
    const requestId = randomUUID()
    const controller = new AbortController()
    this.current = { id: requestId, controller }

    const client = new OpenAI({ apiKey })
    const userMessage = buildUserMessage(transcript)
    const instructions = `${systemPrompt}\n\n${VISION_INSTRUCTIONS}`

    let full = ''
    try {
      const stream = await client.responses.create(
        {
          model,
          instructions,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: userMessage },
                { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
              ],
            },
          ],
          max_output_tokens: 900,
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
          const errorMessage = errorMessageForEvent(event)
          if (errorMessage) throw new Error(errorMessage)
        }
      }
      if (!controller.signal.aborted) callbacks.onDone(full, finishReason)
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string }
      if (e.name === 'AbortError') return requestId
      callbacks.onError(e.message ?? 'Unknown OpenAI vision error')
    } finally {
      if (this.current?.id === requestId) this.current = null
    }
    return requestId
  }
}

function buildUserMessage(transcript: string): string {
  const trimmed = transcript.trim()
  if (!trimmed) {
    return 'No reliable transcript is available. Answer based on the visible screen content.'
  }
  return `Recent interview transcript for context:\n\n${trimmed}\n\nAnswer the technical prompt or code/design content visible on screen.`
}

function errorMessageForEvent(event: ResponseStreamEvent): string | null {
  if (event.type === 'error') return event.message
  if (event.type === 'response.failed') {
    return event.response.error?.message ?? 'OpenAI vision response failed.'
  }
  if (event.type === 'response.incomplete') {
    return event.response.incomplete_details?.reason ?? 'OpenAI vision response was incomplete.'
  }
  return null
}

export const openaiVision = new OpenAIVisionClient()
