import { useMemo } from 'react'
import { Maximize2 } from 'lucide-react'
import { useStatusStore } from '../state/status-store'
import { useLlmStore } from '../state/llm-store'
import { useTranscriptStore } from '../state/transcript-store'
import { useMockStore } from '../state/mock-store'
import { toPlainText } from '../lib/plain-text'

interface Props {
  onExpand: () => void
}

/**
 * Compact mode: the glance surface. Whatever is here has to be readable in the
 * half-second someone looks away from the call, so it carries exactly one
 * question and the opening of one answer — no controls competing for space.
 */
export function AnswerCard({ onExpand }: Props): JSX.Element {
  const running = useStatusStore((s) => s.running)
  const entries = useLlmStore((s) => s.entries)
  const segments = useTranscriptStore((s) => s.segments)
  const partials = useTranscriptStore((s) => s.partials)
  const mockState = useMockStore((s) => s.status.state)

  const latest = entries[0]
  const question = latestQuestion(segments, partials)
  const streaming = latest?.status === 'streaming'
  const mockLive = mockState === 'active' || mockState === 'paused'
  const answer = useMemo(() => toPlainText(latest?.text ?? ''), [latest?.text])

  const state = mockLive ? 'mock' : running ? 'live' : 'idle'
  const label = mockLive ? 'Mock' : streaming ? 'Answering' : running ? 'Listening' : 'Idle'

  return (
    <div className={`card card-${state} ${streaming ? 'streaming' : ''}`}>
      <div className="card-top">
        <span className={`hud-lamp ${streaming ? 'streaming' : ''}`} aria-hidden />
        <span className="card-state">{label}</span>
        <span className="card-spacer" />
        <button onClick={onExpand} className="icon-btn" title="Expand overlay" aria-label="Expand overlay">
          <Maximize2 size={13} strokeWidth={1.75} />
        </button>
      </div>

      <div className="card-question" title={question ?? undefined}>
        {question ?? <span className="card-muted">waiting for a question</span>}
      </div>

      <div className="card-answer">
        {answer || <span className="card-muted">{streaming ? 'thinking…' : 'no answer yet'}</span>}
      </div>
    </div>
  )
}

function latestQuestion(
  segments: ReturnType<typeof useTranscriptStore.getState>['segments'],
  partials: ReturnType<typeof useTranscriptStore.getState>['partials'],
): string | null {
  if (partials.them && partials.them.text.trim()) return partials.them.text
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i]
    if (s.speaker === 'them' && s.text.trim()) return s.text
  }
  return null
}
