import { useEffect, useMemo, useRef } from 'react'
import { useTranscriptStore } from '../state/transcript-store'
import type { TranscriptSegment } from '@shared/types'

export function TranscriptPane(): JSX.Element {
  const segments = useTranscriptStore((s) => s.segments)
  const partials = useTranscriptStore((s) => s.partials)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef(true)

  const { hero, rest } = useMemo(() => {
    const all: TranscriptSegment[] = []
    if (partials.you) all.push(partials.you)
    if (partials.them) all.push(partials.them)
    all.push(...segments)
    all.sort((a, b) => a.startedAt - b.startedAt)

    let heroSeg: TranscriptSegment | null = null
    const restList: TranscriptSegment[] = []
    for (let i = all.length - 1; i >= 0; i--) {
      const seg = all[i]
      if (!heroSeg && seg.speaker === 'them') {
        heroSeg = seg
      } else {
        restList.unshift(seg)
      }
    }
    return { hero: heroSeg, rest: restList }
  }, [segments, partials])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (stickyRef.current) el.scrollTop = el.scrollHeight
  }, [rest, hero])

  const handleScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    stickyRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }

  if (!hero && rest.length === 0) {
    return (
      <div className="transcript-pane">
        <div className="transcript-empty">No speech yet — press <kbd>Space</kbd> to start</div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="transcript-pane">
      {hero && (
        <div className="transcript-hero">
          <div className="transcript-hero-marker">Q</div>
          <div className="transcript-hero-body">
            <div
              key={hero.id}
              className={`transcript-hero-text ${hero.status === 'partial' ? 'partial' : ''}`}
            >
              {hero.text || '…'}
            </div>
            <div className="transcript-hero-time">{formatTime(hero.startedAt)}</div>
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div className="transcript-rest">
          {rest.map((seg) => (
            <div
              key={`${seg.speaker}:${seg.id}:${seg.status}`}
              className={`segment segment-${seg.speaker} ${seg.status === 'partial' ? 'segment-partial' : ''}`}
            >
              <span className="segment-tag">{seg.speaker === 'you' ? 'You' : 'Them'}</span>
              <span className="segment-text">{seg.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
