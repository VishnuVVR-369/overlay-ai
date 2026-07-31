import OpenAI from 'openai'
import { OpenAIResponseStreamRunner, type StreamCallbacks } from './openai-response-stream'

const ANSWER_MODEL = 'gpt-5.6-sol'

export type { StreamCallbacks } from './openai-response-stream'

export class OpenAIAnswerClient {
  private readonly runner = new OpenAIResponseStreamRunner()

  abort(): void {
    this.runner.abort()
  }

  async streamAnswer(
    apiKey: string,
    systemPrompt: string,
    transcript: string,
    callbacks: StreamCallbacks,
  ): Promise<string> {
    const client = new OpenAI({ apiKey })
    const input = transcript.trim() || '(no transcript yet — invent a plausible interview question and answer it.)'
    return this.runner.run(
      (signal) => client.responses.create(
        {
          model: ANSWER_MODEL,
          instructions: systemPrompt,
          input,
          reasoning: { effort: 'low' },
          max_output_tokens: 600,
          stream: true,
        },
        { signal },
      ),
      callbacks,
      {
        failed: 'OpenAI answer response failed.',
        incomplete: 'OpenAI answer response was incomplete.',
        unknown: 'Unknown OpenAI answer error',
      },
    )
  }
}

export const openaiAnswer = new OpenAIAnswerClient()
