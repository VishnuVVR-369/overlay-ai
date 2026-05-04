import { useLlmStore } from '../state/llm-store'

export function LLMResponsePane(): JSX.Element {
  const entries = useLlmStore((s) => s.entries)

  return (
    <div className="llm-pane">
      {entries.length === 0 && (
        <div className="llm-empty">
          Press <kbd>{cmdKey()}+\</kbd> to ask the LLM about the latest question.
        </div>
      )}
      {entries.map((entry) => (
        <div key={entry.requestId} className={`llm-entry llm-${entry.status}`}>
          <div className="llm-meta">
            {new Date(entry.startedAt).toLocaleTimeString()}
            {entry.status === 'streaming' && <span className="llm-streaming-dot"> • streaming</span>}
            {entry.status === 'error' && <span className="llm-error-tag"> • error</span>}
          </div>
          <div className="llm-text">{entry.status === 'error' ? entry.error : entry.text || '…'}</div>
        </div>
      ))}
    </div>
  )
}

function cmdKey(): string {
  return navigator.userAgent.includes('Mac') ? 'Cmd' : 'Ctrl'
}
