import { memo, useMemo } from 'react'
import { Copy, ChevronRight } from 'lucide-react'
import { useLlmStore, type LlmEntry } from '../state/llm-store'
import { useUiStore } from '../state/ui-store'
import { MarkdownBody } from '../markdown/MarkdownBody'
import { StreamingBody } from '../markdown/StreamingBody'

export function LLMResponsePane(): JSX.Element {
  const entries = useLlmStore((s) => s.entries)

  if (entries.length === 0) {
    return (
      <div className="llm-pane">
        <div className="llm-empty">
          Press <kbd>{cmdKey()}</kbd>+<kbd>\</kbd> to ask, or <kbd>Space</kbd> to start listening
        </div>
      </div>
    )
  }

  const [hero, ...rest] = entries
  return (
    <div className="llm-pane">
      <HeroEntry entry={hero} />
      {rest.map((e) => (
        <CollapsedEntry key={e.requestId} entry={e} />
      ))}
    </div>
  )
}

const HeroEntry = memo(function HeroEntry({ entry }: { entry: LlmEntry }): JSX.Element {
  const streaming = entry.status === 'streaming'
  const error = entry.status === 'error'
  const time = useMemo(() => formatTime(entry.startedAt), [entry.startedAt])
  return (
    <div
      className={`llm-entry hero ${streaming ? 'streaming' : ''} ${error ? 'error' : ''}`}
      data-request-id={entry.requestId}
    >
      <div className="llm-meta">
        <span className="llm-mode-tag">{entry.mode === 'screen' ? 'screen' : 'transcript'}</span>
        <span className="llm-meta-time">{time}</span>
        {streaming && <span className="llm-meta-stream-dot" aria-hidden />}
        {error && <span className="llm-meta-error">error</span>}
        <span className="llm-meta-spacer" />
        {!streaming && entry.text && (
          <button
            type="button"
            className="llm-meta-action"
            onClick={() => void navigator.clipboard.writeText(entry.text)}
            title="Copy answer"
            aria-label="Copy answer"
          >
            <Copy size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {entry.imageDataUrl && (
        <img className="llm-screenshot" src={entry.imageDataUrl} alt="Captured screen" />
      )}
      {error ? (
        <div className="llm-body">
          <p style={{ color: 'var(--danger)' }}>{entry.error ?? 'Request failed'}</p>
        </div>
      ) : streaming ? (
        entry.chunks.length > 0 ? (
          <StreamingBody chunks={entry.chunks} />
        ) : (
          <div className="llm-body">
            <span className="llm-caret" aria-hidden />
          </div>
        )
      ) : entry.text ? (
        <MarkdownBody text={entry.text} streaming={false} />
      ) : (
        <div className="llm-body">
          <span className="llm-caret" aria-hidden />
        </div>
      )}
    </div>
  )
})

function CollapsedEntry({ entry }: { entry: LlmEntry }): JSX.Element {
  const expanded = useUiStore((s) => !!s.expandedEntries[entry.requestId])
  const toggle = useUiStore((s) => s.toggleEntryExpanded)
  const time = useMemo(() => formatTime(entry.startedAt), [entry.startedAt])
  const preview = useMemo(() => firstLine(entry.text || entry.error || ''), [entry.text, entry.error])

  if (expanded) {
    return (
      <div className="llm-entry hero" style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <div className="llm-meta">
          <span className="llm-mode-tag">{entry.mode === 'screen' ? 'screen' : 'transcript'}</span>
          <span className="llm-meta-time">{time}</span>
          <span className="llm-meta-spacer" />
          <button
            type="button"
            className="llm-meta-action"
            style={{ opacity: 1 }}
            onClick={() => toggle(entry.requestId)}
            title="Collapse"
            aria-label="Collapse"
          >
            <ChevronRight size={12} strokeWidth={1.75} style={{ transform: 'rotate(90deg)' }} />
          </button>
        </div>
        {entry.imageDataUrl && (
          <img className="llm-screenshot" src={entry.imageDataUrl} alt="Captured screen" />
        )}
        <MarkdownBody text={entry.text} streaming={false} />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="llm-entry collapsed"
      onClick={() => toggle(entry.requestId)}
      title="Expand"
    >
      <span className="llm-entry-collapsed-text">{preview || '—'}</span>
      <span className="llm-entry-collapsed-time">{time}</span>
    </button>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function firstLine(text: string): string {
  const trimmed = text.trim()
  const nl = trimmed.indexOf('\n')
  const line = nl === -1 ? trimmed : trimmed.slice(0, nl)
  return line.length > 90 ? line.slice(0, 87) + '…' : line
}

function cmdKey(): string {
  return navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
}
