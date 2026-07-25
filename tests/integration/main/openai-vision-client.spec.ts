import { describe, expect, it, vi, beforeEach } from 'vitest'
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

async function load(): Promise<typeof import('@main/llm/openai-vision-client')> {
  vi.resetModules()
  return await import('@main/llm/openai-vision-client')
}

describe('OpenAIVisionClient', () => {
  it('streams response.output_text.delta events as tokens and resolves onDone with status', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'A' },
      { type: 'response.output_text.delta', delta: 'B' },
      { type: 'response.completed', response: { status: 'completed' } },
    ])
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    const tokens: string[] = []
    let full = ''
    let finishReason: string | null | undefined
    await c.streamScreenAnswer('key', 'gpt-5.1', 'SYS', 'Them: q', 'data:image/png;base64,xxx', {
      onToken: (d) => tokens.push(d),
      onDone: (f, fr) => {
        full = f
        finishReason = fr
      },
      onError: () => {},
    })
    expect(tokens).toEqual(['A', 'B'])
    expect(full).toBe('AB')
    expect(finishReason).toBe('completed')
  })

  it('builds a payload with instructions = system + vision instructions, max_output_tokens 900, image attached', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'x' },
      { type: 'response.completed', response: { status: 'completed' } },
    ])
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    await c.streamScreenAnswer('key', 'm', 'SYS', '', 'data:image/png;base64,xxx', {
      onToken: () => {},
      onDone: () => {},
      onError: () => {},
    })
    const params = mockState.createSpy.mock.calls[0][0] as {
      model: string
      instructions: string
      max_output_tokens: number
      input: Array<{ content: Array<{ type: string; image_url?: string; text?: string }> }>
    }
    expect(params.model).toBe('m')
    expect(params.max_output_tokens).toBe(900)
    expect(params.instructions).toContain('SYS')
    expect(params.instructions).toMatch(/screenshot/)
    const content = params.input[0].content
    expect(content.find((c) => c.type === 'input_image')?.image_url).toBe('data:image/png;base64,xxx')
    expect(content.find((c) => c.type === 'input_text')?.text).toMatch(/No reliable transcript/i)
  })

  it('forwards transcript context when transcript is non-empty', async () => {
    mockState = createOpenAIMock([
      { type: 'response.output_text.delta', delta: 'x' },
      { type: 'response.completed', response: { status: 'completed' } },
    ])
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    await c.streamScreenAnswer('key', 'm', 's', 'Them: hash table?', 'data:img', {
      onToken: () => {},
      onDone: () => {},
      onError: () => {},
    })
    const text = (mockState.createSpy.mock.calls[0][0] as {
      input: Array<{ content: Array<{ type: string; text?: string }> }>
    }).input[0].content.find((c) => c.type === 'input_text')?.text
    expect(text).toContain('Them: hash table?')
  })

  it('response.failed event is reported via onError', async () => {
    mockState = createOpenAIMock([
      { type: 'response.failed', response: { error: { message: 'rate limited' } } },
    ])
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    let err: string | null = null
    await c.streamScreenAnswer('k', 'm', 's', 't', 'i', {
      onToken: () => {},
      onDone: () => {},
      onError: (m) => {
        err = m
      },
    })
    expect(err).toBe('rate limited')
  })

  it('"error" event with message is reported via onError', async () => {
    mockState = createOpenAIMock([{ type: 'error', message: 'boom' }])
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    let err: string | null = null
    await c.streamScreenAnswer('k', 'm', 's', 't', 'i', {
      onToken: () => {},
      onDone: () => {},
      onError: (m) => {
        err = m
      },
    })
    expect(err).toBe('boom')
  })

  it('abort() suppresses onDone', async () => {
    mockState = createOpenAIMock(
      [
        { type: 'response.output_text.delta', delta: 'a' },
        { type: 'response.output_text.delta', delta: 'b' },
        { type: 'response.completed', response: { status: 'completed' } },
      ],
      { delayMs: 100 },
    )
    const { OpenAIVisionClient } = await load()
    const c = new OpenAIVisionClient()
    let done = false
    const p = c.streamScreenAnswer('k', 'm', 's', 't', 'i', {
      onToken: () => {},
      onDone: () => {
        done = true
      },
      onError: () => {},
    })
    await new Promise((r) => setTimeout(r, 30))
    c.abort()
    await p
    expect(done).toBe(false)
  })
})
