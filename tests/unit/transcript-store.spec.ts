import { describe, expect, it } from 'vitest'
import { TranscriptStore } from '@main/transcription/transcript-store'

describe('TranscriptStore', () => {
  it('starts empty with no segments and no partials', () => {
    const s = new TranscriptStore()
    const snap = s.snapshot()
    expect(snap.segments).toEqual([])
    expect(snap.partials).toEqual({})
  })

  it('applyPartial creates a partial under the speaker slot with a stable id', () => {
    const s = new TranscriptStore()
    const a = s.applyPartial('them', 'why ')
    const b = s.applyPartial('them', 'why are')
    expect(a.segmentId).toEqual(b.segmentId)
    expect(s.snapshot().partials.them?.text).toBe('why are')
    expect(s.snapshot().partials.them?.status).toBe('partial')
  })

  it('applyCommitted moves the partial into segments with a committedAt timestamp', () => {
    const s = new TranscriptStore()
    s.applyPartial('them', 'final?')
    const before = Date.now()
    const update = s.applyCommitted('them', 'final question?')
    expect(update.kind).toBe('committed')
    expect(update.committedAt).toBeGreaterThanOrEqual(before)
    const snap = s.snapshot()
    expect(snap.segments).toHaveLength(1)
    expect(snap.segments[0]).toMatchObject({ speaker: 'them', status: 'committed', text: 'final question?' })
    expect(snap.partials.them).toBeUndefined()
  })

  it('preserves the partial id when committing', () => {
    const s = new TranscriptStore()
    const partial = s.applyPartial('you', 'hello')
    const committed = s.applyCommitted('you', 'hello there')
    expect(committed.segmentId).toBe(partial.segmentId)
  })

  it('keeps "you" and "them" partials independent', () => {
    const s = new TranscriptStore()
    s.applyPartial('you', 'um')
    s.applyPartial('them', 'so')
    const snap = s.snapshot()
    expect(snap.partials.you?.text).toBe('um')
    expect(snap.partials.them?.text).toBe('so')
  })

  it('committing one speaker does not clear the other partial', () => {
    const s = new TranscriptStore()
    s.applyPartial('you', 'um')
    s.applyPartial('them', 'so')
    s.applyCommitted('them', 'so what is hashing?')
    expect(s.snapshot().partials.you?.text).toBe('um')
    expect(s.snapshot().segments).toHaveLength(1)
  })

  it('clear() empties everything', () => {
    const s = new TranscriptStore()
    s.applyPartial('them', 'x')
    s.applyCommitted('them', 'xx')
    s.applyPartial('you', 'y')
    s.clear()
    const snap = s.snapshot()
    expect(snap.segments).toHaveLength(0)
    expect(snap.partials).toEqual({})
  })

  it('flattenForPrompt is empty when there are no committed segments', () => {
    const s = new TranscriptStore()
    s.applyPartial('them', 'partial only')
    expect(s.flattenForPrompt()).toBe('')
  })

  it('flattenForPrompt merges consecutive same-speaker turns into a single line', () => {
    const s = new TranscriptStore()
    s.applyCommitted('them', 'one.')
    s.applyCommitted('them', 'two.')
    s.applyCommitted('you', 'reply.')
    s.applyCommitted('them', 'three.')
    expect(s.flattenForPrompt()).toBe('Them: one. two.\nYou: reply.\nThem: three.')
  })

  it('snapshot returns copies that do not leak internal arrays', () => {
    const s = new TranscriptStore()
    s.applyCommitted('you', 'hi')
    const snap = s.snapshot()
    snap.segments.push({ id: 'x', speaker: 'them', status: 'committed', text: 'leak', startedAt: 0 })
    expect(s.snapshot().segments).toHaveLength(1)
  })
})
