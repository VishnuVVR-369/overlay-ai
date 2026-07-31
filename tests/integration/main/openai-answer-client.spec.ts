import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpenAIMock } from '../../helpers/openai-mock'

let mockState: ReturnType<typeof createOpenAIMock>

vi.mock('openai', () => ({
  default: class {
    responses: { create: typeof mockState.createSpy }
    constructor(_opts: unknown) {
      this.responses = { create: mockState.createSpy }
    }
  },
}))

beforeEach(() => {
  mockState = createOpenAIMock([])
})

async function load(): Promise<typeof import('@main/llm/openai-answer-client')> {
  vi.resetModules()
  return await import('@main/llm/openai-answer-client')
}

describe('OpenAIAnswerClient', () => {
  it('streams every text delta and reports the completed response status', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'Hi ' },
      { type: 'response.output_text.delta', delta: 'there' },
      { type: 'response.completed', response: { status: 'completed' } },
    ])
    const { OpenAIAnswerClient } = await load()
    const client = new OpenAIAnswerClient()
    const tokens: string[] = []
    let full = ''
    let status: string | null | undefined
    await client.streamAnswer('key', 'sys', 'Them: hello', {
      onToken: (delta) => tokens.push(delta),
      onDone: (text, finishReason) => {
        full = text
        status = finishReason
      },
      onError: () => {},
    })
    expect(tokens).toEqual(['Hi ', 'there'])
    expect(full).toBe('Hi there')
    expect(status).toBe('completed')
  })

  it('uses GPT-5.6 Sol with low reasoning and the Responses API contract', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'x' },
      { type: 'response.completed', response: { status: 'completed' } },
    ])
    const { OpenAIAnswerClient } = await load()
    const client = new OpenAIAnswerClient()
    await client.streamAnswer('key', 'SYSTEM', 'Them: q', {
      onToken: () => {}, onDone: () => {}, onError: () => {},
    })
    const params = mockState.createSpy.mock.calls[0][0]
    expect(params).toMatchObject({
      model: 'gpt-5.6-sol',
      instructions: 'SYSTEM',
      input: 'Them: q',
      reasoning: { effort: 'low' },
      max_output_tokens: 600,
      stream: true,
    })
  })

  it('uses the existing placeholder when the transcript is empty', async () => {
    mockState = createOpenAIMock([{ type: 'response.completed', response: { status: 'completed' } }])
    const { OpenAIAnswerClient } = await load()
    await new OpenAIAnswerClient().streamAnswer('key', 'sys', '', {
      onToken: () => {}, onDone: () => {}, onError: () => {},
    })
    expect(mockState.createSpy.mock.calls[0][0].input).toMatch(/no transcript yet/i)
  })

  it('reports API failures and does not call onDone', async () => {
    mockState = createOpenAIMock([
      { type: 'response.failed', response: { error: { message: 'rate limited' } } },
    ])
    const { OpenAIAnswerClient } = await load()
    let error = ''
    let done = false
    await new OpenAIAnswerClient().streamAnswer('key', 'sys', 't', {
      onToken: () => {},
      onDone: () => { done = true },
      onError: (message) => { error = message },
    })
    expect(error).toBe('rate limited')
    expect(done).toBe(false)
  })

  it('abort suppresses completion for an in-flight request', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'a' },
      { type: 'response.completed', response: { status: 'completed' } },
    ], { delayMs: 50 })
    const { OpenAIAnswerClient } = await load()
    const client = new OpenAIAnswerClient()
    let done = false
    const pending = client.streamAnswer('key', 'sys', 't', {
      onToken: () => {}, onDone: () => { done = true }, onError: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    client.abort()
    await pending
    expect(mockState.signals[0]?.aborted).toBe(true)
    expect(done).toBe(false)
  })
})
