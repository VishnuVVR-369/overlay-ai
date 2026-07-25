// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LLMResponsePane } from '@/components/LLMResponsePane'
import { useLlmStore } from '@/state/llm-store'
import { useUiStore } from '@/state/ui-store'

vi.mock('@/markdown/MarkdownBody', () => ({
  MarkdownBody: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}))
vi.mock('@/markdown/StreamingBody', () => ({
  StreamingBody: ({ chunks }: { chunks: string[] }) => <div data-testid="streaming">{chunks.join('')}</div>,
}))

beforeEach(() => {
  useLlmStore.setState({ entries: [] })
  useUiStore.setState({
    mode: 'normal',
    consoleTab: null,
    paletteOpen: false,
    focused: true,
    permStatus: { mic: 'unknown', screen: 'unknown' },
    expandedEntries: {},
  })
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('LLMResponsePane', () => {
  it('shows an empty state that names every way to ask', () => {
    render(<LLMResponsePane />)
    expect(screen.getByText('Nothing asked yet')).toBeTruthy()
    expect(screen.getByText(/answer the last thing they asked/i)).toBeTruthy()
    expect(screen.getByText(/answer what is on your screen/i)).toBeTruthy()
  })

  it('renders StreamingBody and a Transcript tag while streaming', () => {
    useLlmStore.setState({
      entries: [{ requestId: 'r1', mode: 'transcript', text: 'hi', chunks: ['hi'], status: 'streaming', startedAt: 1 }],
    })
    render(<LLMResponsePane />)
    expect(screen.getByTestId('streaming').textContent).toBe('hi')
    expect(screen.getByText('Transcript')).toBeTruthy()
  })

  it('swaps to MarkdownBody and offers Copy once the entry is done', () => {
    useLlmStore.setState({
      entries: [{ requestId: 'r1', mode: 'transcript', text: 'final', chunks: ['final'], status: 'done', startedAt: 1 }],
    })
    render(<LLMResponsePane />)
    expect(screen.getByTestId('md').textContent).toBe('final')
    expect(screen.getByLabelText('Copy answer')).toBeTruthy()
  })

  it('renders the screenshot thumbnail for vision-mode entries', () => {
    useLlmStore.setState({
      entries: [
        { requestId: 'r1', mode: 'screen', imageDataUrl: 'data:image/png;base64,xxx', text: 't', chunks: [], status: 'done', startedAt: 1 },
      ],
    })
    const { container } = render(<LLMResponsePane />)
    const img = container.querySelector('img.answer-shot') as HTMLImageElement | null
    expect(img?.src).toBe('data:image/png;base64,xxx')
    expect(screen.getByText('Screen')).toBeTruthy()
  })

  it('surfaces the error message when an entry failed', () => {
    useLlmStore.setState({
      entries: [{ requestId: 'r1', mode: 'transcript', text: '', chunks: [], status: 'error', error: 'rate limited', startedAt: 1 }],
    })
    render(<LLMResponsePane />)
    expect(screen.getByText('rate limited')).toBeTruthy()
    expect(screen.getByText('error')).toBeTruthy()
  })

  it('collapses older entries to a clickable one-line preview', () => {
    useLlmStore.setState({
      entries: [
        { requestId: 'a', mode: 'transcript', text: 'newest', chunks: ['newest'], status: 'done', startedAt: 2 },
        { requestId: 'b', mode: 'transcript', text: 'older entry first line', chunks: [], status: 'done', startedAt: 1 },
      ],
    })
    const { container } = render(<LLMResponsePane />)
    const collapsed = container.querySelector('button.answer-collapsed')
    expect(collapsed).toBeTruthy()
    expect(collapsed?.textContent).toContain('older entry first line')
  })

  it('clicking a collapsed entry expands it', () => {
    useLlmStore.setState({
      entries: [
        { requestId: 'a', mode: 'transcript', text: 'newest', chunks: [], status: 'done', startedAt: 2 },
        { requestId: 'b', mode: 'transcript', text: 'history', chunks: [], status: 'done', startedAt: 1 },
      ],
    })
    const { container } = render(<LLMResponsePane />)
    fireEvent.click(container.querySelector('button.answer-collapsed')!)
    expect(useUiStore.getState().expandedEntries['b']).toBe(true)
  })

  it('Copy writes the entry text and confirms it in the tooltip', () => {
    const writeText = navigator.clipboard.writeText as unknown as ReturnType<typeof vi.fn>
    useLlmStore.setState({
      entries: [{ requestId: 'r1', mode: 'transcript', text: 'copy me', chunks: [], status: 'done', startedAt: 1 }],
    })
    render(<LLMResponsePane />)
    fireEvent.click(screen.getByLabelText('Copy answer'))
    expect(writeText).toHaveBeenCalledWith('copy me')
    expect(screen.getByLabelText('Copy answer').getAttribute('title')).toBe('Copied')
  })
})
