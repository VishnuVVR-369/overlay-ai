import { memo, useMemo } from 'react'
import { Check, ChevronDown, Copy, Monitor, MessageSquareText } from 'lucide-react'
import { useLlmStore, type LlmEntry } from '../state/llm-store'
import { useUiStore } from '../state/ui-store'
import { MarkdownBody } from '../markdown/MarkdownBody'
import { StreamingBody } from '../markdown/StreamingBody'
import { mod } from '../commands'
import { formatTime } from '../lib/time'
import { toPlainText } from '../lib/plain-text'
import { useCopy } from '../hooks/useCopy'

export function LLMResponsePane(): JSX.Element {
  const entries = useLlmStore((s) => s.entries)

  if (entries.length === 0) return <EmptyState />

  const [hero, ...rest] = entries
  return (
    <div className="answer-pane">
      <HeroEntry entry={hero} />
      {rest.length > 0 && (
        <div className="answer-history">
          {rest.map((e) => (
            <PastEntry key={e.requestId} entry={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState(): JSX.Element {
  return (
    <div className="answer-pane">
      <div className="answer-empty">
        <p className="answer-empty-title">Nothing asked yet</p>
        <ul className="answer-empty-hints">
          <li>
            <span className="keys">
              <kbd>{mod()}</kbd>
              <kbd>\</kbd>
            </span>
            answer the last thing they asked
          </li>
          <li>
            <span className="keys">
              <kbd>{mod()}</kbd>
              <kbd>⇧</kbd>
              <kbd>\</kbd>
            </span>
            answer what is on your screen
          </li>
          <li>
            <span className="keys">
              <kbd>{mod()}</kbd>
              <kbd>K</kbd>
            </span>
            everything else
          </li>
        </ul>
      </div>
    </div>
  )
}

const HeroEntry = memo(function HeroEntry({ entry }: { entry: LlmEntry }): JSX.Element {
  const streaming = entry.status === 'streaming'
  const error = entry.status === 'error'

  return (
    <article
      className={`answer ${streaming ? 'streaming' : ''} ${error ? 'error' : ''}`}
      data-request-id={entry.requestId}
    >
      <EntryMeta entry={entry} />
      {entry.imageDataUrl && (
        <img className="answer-shot" src={entry.imageDataUrl} alt="Captured screen" />
      )}
      {error ? (
        <div className="answer-body answer-error">{entry.error ?? 'Request failed'}</div>
      ) : streaming && entry.chunks.length > 0 ? (
        <StreamingBody chunks={entry.chunks} />
      ) : entry.text ? (
        <MarkdownBody text={entry.text} streaming={false} />
      ) : (
        <div className="answer-body">
          <span className="answer-caret" aria-hidden />
        </div>
      )}
    </article>
  )
})

function PastEntry({ entry }: { entry: LlmEntry }): JSX.Element {
  const expanded = useUiStore((s) => !!s.expandedEntries[entry.requestId])
  const toggle = useUiStore((s) => s.toggleEntryExpanded)
  const preview = useMemo(() => firstLine(entry.text || entry.error || ''), [entry.text, entry.error])

  if (expanded) {
    return (
      <article className="answer answer-past">
        <EntryMeta entry={entry} onCollapse={() => toggle(entry.requestId)} />
        {entry.imageDataUrl && (
          <img className="answer-shot" src={entry.imageDataUrl} alt="Captured screen" />
        )}
        <MarkdownBody text={entry.text} streaming={false} />
      </article>
    )
  }

  return (
    <button type="button" className="answer-collapsed" onClick={() => toggle(entry.requestId)} title="Expand">
      <ModeIcon mode={entry.mode} />
      <span className="answer-collapsed-text">{preview || '—'}</span>
      <span className="answer-collapsed-time">{formatTime(entry.startedAt)}</span>
    </button>
  )
}

function EntryMeta({ entry, onCollapse }: { entry: LlmEntry; onCollapse?: () => void }): JSX.Element {
  const streaming = entry.status === 'streaming'
  const { copied, copy } = useCopy()

  return (
    <div className="answer-meta">
      <ModeIcon mode={entry.mode} />
      <span className="answer-meta-mode">{entry.mode === 'screen' ? 'Screen' : 'Transcript'}</span>
      <span className="answer-meta-time">{formatTime(entry.startedAt)}</span>
      {streaming && <span className="answer-meta-live">thinking</span>}
      {entry.status === 'error' && <span className="answer-meta-error">error</span>}
      <span className="spacer" />
      {!streaming && entry.text && (
        <button
          type="button"
          className="icon-btn answer-meta-action"
          onClick={() => copy(entry.text)}
          title={copied ? 'Copied' : 'Copy answer'}
          aria-label="Copy answer"
        >
          {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
        </button>
      )}
      {onCollapse && (
        <button
          type="button"
          className="icon-btn answer-meta-action always"
          onClick={onCollapse}
          title="Collapse"
          aria-label="Collapse"
        >
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}

function ModeIcon({ mode }: { mode: LlmEntry['mode'] }): JSX.Element {
  return (
    <span className="answer-mode-icon" aria-hidden>
      {mode === 'screen' ? (
        <Monitor size={12} strokeWidth={1.75} />
      ) : (
        <MessageSquareText size={12} strokeWidth={1.75} />
      )}
    </span>
  )
}

/** One-line, markup-free preview for a collapsed past answer. */
function firstLine(text: string): string {
  const plain = toPlainText(text)
  return plain.length > 90 ? `${plain.slice(0, 87)}…` : plain
}
