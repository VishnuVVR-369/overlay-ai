import { useCallback, useEffect, useMemo } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { MockSessionAnnotation, MockSessionRecord, MockSessionSummary, TranscriptSegment } from '@shared/types'
import { useMockSessionsStore } from '../../state/mock-sessions-store'
import { formatDateTime } from '../../lib/time'

export function HistoryTab(): JSX.Element {
  const selectedId = useMockSessionsStore((s) => s.selectedId)
  const selectedRecord = useMockSessionsStore((s) => s.selectedRecord)
  const loadingRecord = useMockSessionsStore((s) => s.loadingRecord)
  const setSummaries = useMockSessionsStore((s) => s.setSummaries)
  const setSelected = useMockSessionsStore((s) => s.setSelected)
  const setSelectedRecord = useMockSessionsStore((s) => s.setSelectedRecord)
  const setLoadingRecord = useMockSessionsStore((s) => s.setLoadingRecord)
  const removeSummary = useMockSessionsStore((s) => s.removeSummary)

  useEffect(() => {
    let cancelled = false
    let current = useMockSessionsStore.getState().summaries
    const upserts = new Map<string, MockSessionSummary>()
    const removals = new Set<string>()
    const unsubscribe = useMockSessionsStore.subscribe((state) => {
      const previousById = new Map(current.map((summary) => [summary.id, summary]))
      const nextById = new Map(state.summaries.map((summary) => [summary.id, summary]))
      for (const id of previousById.keys()) {
        if (!nextById.has(id)) {
          upserts.delete(id)
          removals.add(id)
        }
      }
      for (const summary of state.summaries) {
        if (previousById.get(summary.id) !== summary) {
          removals.delete(summary.id)
          upserts.set(summary.id, summary)
        }
      }
      current = state.summaries
    })
    void window.api.mockSessions.list().then((summaries) => {
      if (cancelled) return
      unsubscribe()
      const merged = new Map(summaries.map((summary) => [summary.id, summary]))
      for (const id of removals) merged.delete(id)
      for (const [id, summary] of upserts) merged.set(id, summary)
      setSummaries([...merged.values()].sort((a, b) => b.startedAt - a.startedAt))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setSummaries])

  useEffect(() => {
    if (!selectedId) {
      setSelectedRecord(null)
      return
    }
    let cancelled = false
    setLoadingRecord(true)
    void window.api.mockSessions.get(selectedId).then((rec) => {
      if (cancelled) return
      setSelectedRecord(rec)
      setLoadingRecord(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, setSelectedRecord, setLoadingRecord])

  const onDelete = useCallback(
    async (id: string) => {
      const result = await window.api.mockSessions.delete(id)
      if (result.ok) {
        removeSummary(id)
        setSelected(null)
      }
    },
    [removeSummary, setSelected],
  )

  if (!selectedId) return <SessionList />

  return (
    <>
      <button className="btn btn-quiet self-start" onClick={() => setSelected(null)}>
        <ArrowLeft size={13} strokeWidth={2} />
        All sessions
      </button>
      <SessionDetail
        record={selectedRecord}
        loading={loadingRecord}
        onDelete={(id) => void onDelete(id)}
      />
    </>
  )
}

function SessionList(): JSX.Element {
  const summaries = useMockSessionsStore((s) => s.summaries)
  const loaded = useMockSessionsStore((s) => s.loaded)
  const setSelected = useMockSessionsStore((s) => s.setSelected)

  if (!loaded) return <div className="empty-box">Loading sessions…</div>

  if (summaries.length === 0) {
    return (
      <div className="empty-box">
        No mock sessions yet. Run one from the Practice tab — the transcript, a score per dimension, and
        annotations on your weakest turns are saved here when you end it.
      </div>
    )
  }

  const graded = summaries.filter((s) => s.graded && s.averageScore !== null)
  const recent = graded.slice(0, 8).reverse()

  return (
    <>
      {recent.length >= 2 && (
        <section className="pane">
          <div className="pane-head">
            <h3>Trend</h3>
            <span className="pane-meta">last {recent.length} graded</span>
          </div>
          <Sparkline summaries={recent} />
        </section>
      )}
      <section className="pane">
        <div className="pane-head">
          <h3>Sessions</h3>
          <span className="pane-meta">{summaries.length} total</span>
        </div>
        <ul className="session-list">
          {summaries.map((s) => (
            <li key={s.id}>
              <button className="session-row" onClick={() => setSelected(s.id)}>
                <span className="session-row-main">
                  <span className="session-row-title">{s.presetLabel}</span>
                  <span className="session-row-meta">
                    {formatDateTime(s.startedAt)} · {s.durationMinutes} min
                  </span>
                </span>
                <ScoreBadge score={s.averageScore} graded={s.graded} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function SessionDetail({
  record,
  loading,
  onDelete,
}: {
  record: MockSessionRecord | null
  loading: boolean
  onDelete: (id: string) => void
}): JSX.Element {
  // Hooks must run on every render, including the loading and not-found paths.
  const annotationsByIndex = useMemo(() => {
    const map = new Map<number, MockSessionAnnotation[]>()
    for (const a of record?.annotations ?? []) {
      const arr = map.get(a.transcriptIndex) ?? []
      arr.push(a)
      map.set(a.transcriptIndex, arr)
    }
    return map
  }, [record])

  if (loading) return <div className="empty-box">Loading session…</div>
  if (!record) return <div className="empty-box">Session not found.</div>

  const hasSummary =
    record.strengths.length > 0 || record.gaps.length > 0 || record.nextDrills.length > 0

  return (
    <>
      <section className="pane">
        <div className="pane-head">
          <h3>{record.presetLabel}</h3>
          {record.averageScore !== null && <ScoreBadge score={record.averageScore} graded={record.graded} />}
        </div>
        <span className="pane-meta">
          {formatDateTime(record.startedAt)} · {record.durationMinutes} min · {record.transcript.length} turns
        </span>
      </section>

      {record.graderError && (
        <div className="inline-error">Grading unavailable: {record.graderError}</div>
      )}

      {record.rubric.length > 0 && (
        <section className="pane">
          <h3>Rubric</h3>
          <div className="rubric">
            {record.rubric.map((r) => (
              <div key={r.dimension} className="rubric-row">
                <div className="rubric-label">{r.label}</div>
                <div className="rubric-bar">
                  <span style={{ width: `${(r.score / 5) * 100}%` }} />
                </div>
                <div className="rubric-score">{r.score}</div>
                {r.evidence && <div className="rubric-evidence">{r.evidence}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {hasSummary && (
        <section className="pane">
          <h3>Takeaways</h3>
          {record.strengths.length > 0 && <Takeaway label="Strengths" items={record.strengths} severity="good" />}
          {record.gaps.length > 0 && <Takeaway label="Gaps" items={record.gaps} severity="gap" />}
          {record.nextDrills.length > 0 && <Takeaway label="Next drills" items={record.nextDrills} severity="warn" />}
        </section>
      )}

      {record.legacyFeedback && record.rubric.length === 0 && (
        <section className="pane">
          <h3>Feedback</h3>
          <div className="legacy-feedback">{record.legacyFeedback}</div>
        </section>
      )}

      <section className="pane">
        <h3>Transcript</h3>
        <ol className="turn-list">
          {record.transcript.map((seg, i) => (
            <TurnRow key={seg.id} index={i} segment={seg} annotations={annotationsByIndex.get(i)} />
          ))}
        </ol>
      </section>

      <div className="pane-actions">
        <button className="btn btn-danger" onClick={() => onDelete(record.id)}>
          <Trash2 size={12} strokeWidth={2} />
          Delete session
        </button>
      </div>
    </>
  )
}

function TurnRow({
  index,
  segment,
  annotations,
}: {
  index: number
  segment: TranscriptSegment
  annotations: MockSessionAnnotation[] | undefined
}): JSX.Element {
  return (
    <li className={`turn turn-${segment.speaker}`} data-index={index}>
      <span className="turn-tag">{segment.speaker === 'you' ? 'You' : 'Them'}</span>
      <span className="turn-text">{segment.text}</span>
      {annotations && annotations.length > 0 && (
        <div className="annotations">
          {annotations.map((a, i) => (
            <div key={i} className={`annotation annotation-${a.severity}`}>
              <div className="annotation-note">{a.note}</div>
              {a.betterAnswer && <div className="annotation-better">Stronger: “{a.betterAnswer}”</div>}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

function Takeaway({
  label,
  items,
  severity,
}: {
  label: string
  items: string[]
  severity: 'good' | 'warn' | 'gap'
}): JSX.Element {
  return (
    <div className={`takeaway takeaway-${severity}`}>
      <div className="takeaway-label">{label}</div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ScoreBadge({ score, graded }: { score: number | null; graded: boolean }): JSX.Element {
  if (!graded || score === null) return <span className="score score-ungraded">—</span>
  return <span className={`score score-${tierFor(score)}`}>{score.toFixed(1)}</span>
}

function tierFor(score: number): 'good' | 'ok' | 'warn' {
  return score >= 4 ? 'good' : score >= 3 ? 'ok' : 'warn'
}

function Sparkline({ summaries }: { summaries: MockSessionSummary[] }): JSX.Element | null {
  const scores = summaries
    .map((s) => (s.graded && s.averageScore !== null ? s.averageScore : null))
    .filter((v): v is number => v !== null)
  if (scores.length < 2) return null

  const W = 280
  const H = 40
  const PAD = 3
  const step = (W - PAD * 2) / (scores.length - 1)
  const at = (score: number, i: number): [number, number] => [
    PAD + i * step,
    H - PAD - ((score - 1) / 4) * (H - PAD * 2),
  ]
  const points = scores.map((s, i) => at(s, i).map((n) => n.toFixed(1)).join(',')).join(' ')
  const [lastX, lastY] = at(scores[scores.length - 1], scores.length - 1)

  return (
    <svg
      className="sparkline"
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Score trend across the last ${scores.length} graded sessions`}
    >
      <polyline points={points} fill="none" />
      <circle cx={lastX} cy={lastY} r={2.5} />
    </svg>
  )
}
