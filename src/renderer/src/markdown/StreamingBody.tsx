import { memo } from 'react'

interface Props {
  chunks: string[]
}

/**
 * Streaming-time body. Renders each rAF-batched chunk as its own <span> with a
 * fade-up animation that runs once on mount. Once the entry is `done`, the parent
 * swaps in <MarkdownBody> for the consolidated full text.
 */
function StreamingBodyImpl({ chunks }: Props): JSX.Element {
  return (
    <div className="llm-stream-body">
      {chunks.map((chunk, idx) => (
        <span key={idx} className="reveal-chunk">
          {chunk}
        </span>
      ))}
      <span className="llm-caret" aria-hidden />
    </div>
  )
}

export const StreamingBody = memo(StreamingBodyImpl)
