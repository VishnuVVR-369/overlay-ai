import OpenAI from 'openai'
import { OpenAIResponseStreamRunner, type StreamCallbacks } from './openai-response-stream'

const VISION_INSTRUCTIONS = `You are answering a live technical interview screen ask.

Treat the screenshot as the primary source of truth for visible code, diagrams, prompts, constraints, examples, errors, and whiteboard content. Use the transcript only as supporting context. If the screenshot contains a coding problem or code editor, explain the approach first, then provide concise code or pseudocode when useful. If it contains a system design diagram or prompt, identify the components, bottlenecks, trade-offs, and the next talking points. Keep the response concise and interview-spoken. Do not mention that you are looking at a screenshot unless it is necessary to disambiguate.`

export class OpenAIVisionClient {
  private readonly runner = new OpenAIResponseStreamRunner()

  abort(): void {
    this.runner.abort()
  }

  async streamScreenAnswer(
    apiKey: string,
    model: string,
    systemPrompt: string,
    transcript: string,
    imageDataUrl: string,
    callbacks: StreamCallbacks,
  ): Promise<string> {
    const client = new OpenAI({ apiKey })
    const userMessage = buildUserMessage(transcript)
    const instructions = `${systemPrompt}\n\n${VISION_INSTRUCTIONS}`

    return this.runner.run(
      (signal) => client.responses.create(
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
        { signal },
      ),
      callbacks,
      {
        failed: 'OpenAI vision response failed.',
        incomplete: 'OpenAI vision response was incomplete.',
        unknown: 'Unknown OpenAI vision error',
      },
    )
  }
}

function buildUserMessage(transcript: string): string {
  const trimmed = transcript.trim()
  if (!trimmed) {
    return 'No reliable transcript is available. Answer based on the visible screen content.'
  }
  return `Recent interview transcript for context:\n\n${trimmed}\n\nAnswer the technical prompt or code/design content visible on screen.`
}

export const openaiVision = new OpenAIVisionClient()
