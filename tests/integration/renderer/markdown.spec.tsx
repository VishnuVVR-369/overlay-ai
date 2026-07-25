// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MarkdownBody } from '@/markdown/MarkdownBody'
import { StreamingBody } from '@/markdown/StreamingBody'
import { CodeBlock } from '@/markdown/CodeBlock'

vi.mock('@/markdown/highlighter', () => ({
  SHIKI_THEME: 'vitesse-black',
  getHighlighter: vi.fn(async () => ({
    codeToHtml: (code: string, opts: { lang: string }) => `<pre><code data-lang="${opts.lang}">${code}</code></pre>`,
  })),
}))

describe('MarkdownBody', () => {
  it('renders plain markdown', () => {
    render(<MarkdownBody text={'# Hello\n\nworld'} streaming={false} />)
    expect(screen.getByRole('heading')).toBeTruthy()
    expect(screen.getByText('world')).toBeTruthy()
  })

  it('renders GFM tables (remark-gfm)', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |'
    render(<MarkdownBody text={md} streaming={false} />)
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('renders inline code without using the highlighter', () => {
    const { container } = render(<MarkdownBody text={'use `foo()` here'} streaming={false} />)
    expect(container.querySelector('code')).toBeTruthy()
    // No code block was rendered
    expect(container.querySelector('.llm-codeblock')).toBeNull()
  })

  it('shows a streaming caret when streaming=true', () => {
    const { container } = render(<MarkdownBody text="hi" streaming={true} />)
    expect(container.querySelector('.llm-caret')).toBeTruthy()
  })
})

describe('StreamingBody', () => {
  it('renders one .reveal-chunk per chunk and a trailing caret', () => {
    const { container } = render(<StreamingBody chunks={['ab', 'cd', 'ef']} />)
    expect(container.querySelectorAll('.reveal-chunk').length).toBe(3)
    expect(container.querySelector('.llm-caret')).toBeTruthy()
  })
})

describe('CodeBlock', () => {
  it('renders plain pre when highlight=false', () => {
    const { container } = render(<CodeBlock code="const x = 1" lang="ts" highlight={false} />)
    expect(container.querySelector('.llm-codeblock-plain')).toBeTruthy()
    expect(container.querySelector('.llm-codeblock')).toBeNull()
  })

  it('renders highlighter HTML when highlight=true', async () => {
    const { container } = render(<CodeBlock code="const x = 1" lang="ts" highlight={true} />)
    await waitFor(() => expect(container.querySelector('.llm-codeblock')).toBeTruthy())
    expect(container.innerHTML).toContain('data-lang="typescript"')
  })

  it('aliases js/sh/py to javascript/bash/python', async () => {
    const { container, rerender } = render(<CodeBlock code="x" lang="js" highlight={true} />)
    await waitFor(() => expect(container.innerHTML).toContain('data-lang="javascript"'))
    rerender(<CodeBlock code="x" lang="sh" highlight={true} />)
    await waitFor(() => expect(container.innerHTML).toContain('data-lang="bash"'))
    rerender(<CodeBlock code="x" lang="py" highlight={true} />)
    await waitFor(() => expect(container.innerHTML).toContain('data-lang="python"'))
  })

  it('falls back to typescript for unsupported languages', async () => {
    const { container } = render(<CodeBlock code="x" lang="brainfuck" highlight={true} />)
    await waitFor(() => expect(container.innerHTML).toContain('data-lang="typescript"'))
  })
})
