import { useEffect, useMemo, useRef } from 'react'
import { useTranscriptStore } from '../state/transcript-store'
import type { TranscriptSegment } from '@shared/types'

export function TranscriptPane(): JSX.Element {
  const segments = useTranscriptStore((s) => s.segments)
  const partials = useTranscriptStore((s) => s.partials)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef(true)

  const items = useMemo<TranscriptSegment[]>(() => {
    const live: TranscriptSegment[] = []
    if (partials.you) live.push(partials.you)
    if (partials.them) live.push(partials.them)
    const all = [...segments, ...live]
    return all.sort((a, b) => a.startedAt - b.startedAt)
  }, [segments, partials])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (stickyRef.current) el.scrollTop = el.scrollHeight
  }, [items])

  const handleScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    stickyRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="transcript-pane">
      {items.length === 0 && (
        <div className="transcript-empty">Waiting for speech…</div>
      )}
      {items.map((seg) => (
        <div
          key={`${seg.speaker}:${seg.id}:${seg.status}`}
          className={`segment segment-${seg.speaker} ${seg.status === 'partial' ? 'segment-partial' : ''}`}
        >
          <span className="segment-tag">{seg.speaker === 'you' ? 'You' : 'Them'}</span>
          <span className="segment-text">{seg.text}</span>
        </div>
      ))}
    </div>
  )
}
