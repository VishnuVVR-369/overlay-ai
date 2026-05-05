import { Maximize2, Power } from 'lucide-react'
import type { SocketState } from '@shared/types'
import { useStatusStore } from '../state/status-store'
import { useLlmStore } from '../state/llm-store'
import { useTranscriptStore } from '../state/transcript-store'
import { SeamWaveform } from './SeamWaveform'

interface Props {
  onExpand: () => void
  onQuit: () => void
}

export function AnswerCard({ onExpand, onQuit }: Props): JSX.Element {
  const micState = useStatusStore((s) => s.micState)
  const systemState = useStatusStore((s) => s.systemState)
  const running = useStatusStore((s) => s.running)
  const entries = useLlmStore((s) => s.entries)
  const segments = useTranscriptStore((s) => s.segments)
  const partials = useTranscriptStore((s) => s.partials)

  const latest = entries[0]
  const lastQuestion = latestThemQuestion(segments, partials)
  const streaming = latest?.status === 'streaming'

  return (
    <div className={`answer-card ${streaming ? 'streaming' : ''} ${running ? 'live' : ''}`}>
      <div className="answer-card-row">
        <SocketDot state={micState} title={`You · ${micState}`} />
        <SocketDot state={systemState} title={`Them · ${systemState}`} />
        <span className="answer-card-status">
          {running ? 'live' : 'idle'}
          {streaming ? ' · answering' : ''}
        </span>
        <span className="answer-card-spacer" />
        <button onClick={onExpand} className="icon-btn" title="Expand" aria-label="Expand">
          <Maximize2 size={12} strokeWidth={1.75} />
        </button>
        <button onClick={onQuit} className="icon-btn danger" title="Quit" aria-label="Quit">
          <Power size={12} strokeWidth={1.75} />
        </button>
      </div>
      <div className="answer-card-waveform">
        <SeamWaveform height={20} />
      </div>
      {lastQuestion ? (
        <div className="answer-card-question" title={lastQuestion}>
          Q · {lastQuestion}
        </div>
      ) : (
        <div className="answer-card-empty">awaiting question</div>
      )}
      <div className="answer-card-answer">
        {latest?.text || (
          <span className="answer-card-empty">
            {streaming ? 'thinking…' : 'no answer yet'}
          </span>
        )}
      </div>
    </div>
  )
}

function latestThemQuestion(
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

function SocketDot({ state, title }: { state: SocketState; title: string }): JSX.Element {
  return (
    <span className="socket-dot" title={title}>
      <span className="dot" style={{ backgroundColor: colorForState(state) }} />
    </span>
  )
}

function colorForState(state: SocketState): string {
  switch (state) {
    case 'open':
      return '#8fcfb3'
    case 'connecting':
    case 'reconnecting':
      return '#e6c068'
    case 'auth_error':
    case 'error':
      return '#d97a7a'
    case 'closed':
    case 'idle':
    default:
      return '#3a3f47'
  }
}
