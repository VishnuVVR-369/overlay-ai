import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

interface Props {
  text: string
  streaming: boolean
}

function MarkdownBodyImpl({ text, streaming }: Props): JSX.Element {
  const components: Components = {
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children, node, ...rest }) => {
      const isBlock = !!node && node.position?.start.line !== node.position?.end.line
      const match = /language-([\w-]+)/.exec(className || '')
      const lang = match?.[1]
      if (isBlock || lang) {
        const raw = String(children).replace(/\n$/, '')
        return <CodeBlock code={raw} lang={lang} highlight={!streaming} />
      }
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      )
    },
  }

  return (
    <div className="llm-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
      {streaming && <span className="llm-caret" aria-hidden />}
    </div>
  )
}

export const MarkdownBody = memo(MarkdownBodyImpl)
