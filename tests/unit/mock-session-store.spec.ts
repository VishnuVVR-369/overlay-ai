import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { makeTempUserData } from '../helpers/temp-userdata'

const tmp = { path: '', cleanup: () => {} }

vi.mock('electron', () => ({
  app: { getPath: (_key: string) => tmp.path },
}))

import { MockSessionStore } from '@main/mock/mock-session-store'
import type { MockRubricScore, MockSessionAnnotation, TranscriptSegment } from '@shared/types'

const baseTranscript = (): TranscriptSegment[] => [
  { id: 't1', speaker: 'them', status: 'committed', text: 'Q1', startedAt: 100, committedAt: 110 },
  { id: 't2', speaker: 'you', status: 'committed', text: 'A1', startedAt: 200, committedAt: 250 },
]

const baseRubric = (): MockRubricScore[] => [
  { dimension: 'structure', label: 'Structure', score: 4, evidence: 'clear' },
  { dimension: 'communication', label: 'Communication', score: 3, evidence: 'paced' },
]

const baseAnnotations = (): MockSessionAnnotation[] => [
  { transcriptIndex: 1, severity: 'gap', note: 'Missed metric', betterAnswer: 'Cut latency 40%' },
]

describe('MockSessionStore', () => {
  let store: MockSessionStore

  beforeEach(async () => {
    const t = makeTempUserData()
    tmp.path = t.path
    tmp.cleanup = t.cleanup
    store = new MockSessionStore()
    await store.load()
  })

  afterEach(() => {
    tmp.cleanup()
  })

  it('writes session JSON to <userData>/mock-sessions/<startedAt>-<id>.json', async () => {
    const rec = await store.save({
      presetId: 'behavioral',
      presetLabel: 'Behavioral',
      durationMinutes: 30,
      startedAt: 1000,
      endedAt: 2000,
      transcript: baseTranscript(),
      legacyFeedback: 'good job',
      rubric: baseRubric(),
      annotations: baseAnnotations(),
      strengths: ['s'],
      gaps: ['g'],
      nextDrills: ['d'],
      averageScore: 3.5,
      graded: true,
    })
    const files = await fs.readdir(join(tmp.path, 'mock-sessions'))
    expect(files).toContain(`1000-${rec.id}.json`)
    const raw = await fs.readFile(join(tmp.path, 'mock-sessions', `1000-${rec.id}.json`), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(1)
    expect(parsed.record.transcript).toHaveLength(2)
    expect(parsed.record.annotations[0].betterAnswer).toBe('Cut latency 40%')
  })

  it('lists sessions sorted newest-first by startedAt', async () => {
    await store.save({ ...basicInput(), startedAt: 1000, endedAt: 1500 })
    await store.save({ ...basicInput(), startedAt: 3000, endedAt: 3500 })
    await store.save({ ...basicInput(), startedAt: 2000, endedAt: 2500 })
    const list = await store.list()
    expect(list.map((s) => s.startedAt)).toEqual([3000, 2000, 1000])
  })

  it('list returns summary fields only (no transcript)', async () => {
    await store.save(basicInput())
    const list = await store.list()
    expect(list[0]).toHaveProperty('averageScore')
    expect(list[0]).not.toHaveProperty('transcript')
    expect(list[0]).not.toHaveProperty('rubric')
  })

  it('get returns the full record', async () => {
    const rec = await store.save(basicInput())
    const fetched = await store.get(rec.id)
    expect(fetched?.transcript).toHaveLength(2)
    expect(fetched?.rubric).toHaveLength(2)
  })

  it('get returns null for unknown id', async () => {
    expect(await store.get('does-not-exist')).toBeNull()
  })

  it('delete removes the file from subsequent lists', async () => {
    const rec = await store.save(basicInput())
    await store.list()
    const ok = await store.delete(rec.id)
    expect(ok).toBe(true)
    const list = await store.list()
    expect(list).toHaveLength(0)
    expect(await store.get(rec.id)).toBeNull()
  })

  it('delete returns false for unknown id', async () => {
    expect(await store.delete('nope')).toBe(false)
  })

  it('skips malformed JSON files without throwing', async () => {
    await store.save(basicInput())
    await fs.writeFile(join(tmp.path, 'mock-sessions', 'corrupt.json'), '{ not json', 'utf-8')
    const list = await store.list()
    expect(list).toHaveLength(1)
  })

  it('skips records that fail the type guard (missing presetId)', async () => {
    await fs.writeFile(
      join(tmp.path, 'mock-sessions', '1-bad.json'),
      JSON.stringify({ version: 1, record: { id: 'bad', startedAt: 1, endedAt: 2 } }),
      'utf-8',
    )
    await store.save(basicInput())
    const list = await store.list()
    expect(list).toHaveLength(1)
  })

  it('skips incomplete version-1 records that would crash the history renderer', async () => {
    const incomplete = {
      ...await store.save(basicInput()),
      id: 'incomplete',
      strengths: undefined,
    }
    await fs.writeFile(
      join(tmp.path, 'mock-sessions', '2-incomplete.json'),
      JSON.stringify({ version: 1, record: incomplete }),
      'utf-8',
    )
    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(await store.get(incomplete.id)).toBeNull()
  })

  it.each([
    ['transcript', [null]],
    ['rubric', [null]],
    ['annotations', [null]],
    ['strengths', [null]],
    ['gaps', [{}]],
    ['nextDrills', [1]],
  ])('skips records with malformed nested %s elements', async (field, malformed) => {
    const invalid = {
      ...await store.save(basicInput()),
      id: `invalid-${field}`,
      [field]: malformed,
    }
    await fs.writeFile(
      join(tmp.path, 'mock-sessions', `2-invalid-${field}.json`),
      JSON.stringify({ version: 1, record: invalid }),
      'utf-8',
    )

    const list = await store.list()
    expect(list.map((item) => item.id)).not.toContain(invalid.id)
    expect(await store.get(invalid.id)).toBeNull()
  })

  it('truncates oversized transcripts on save', async () => {
    const huge: TranscriptSegment[] = Array.from({ length: 600 }, (_, i) => ({
      id: `t${i}`,
      speaker: i % 2 === 0 ? 'them' : 'you',
      status: 'committed',
      text: `turn ${i}`,
      startedAt: i,
      committedAt: i + 1,
    }))
    const rec = await store.save({
      ...basicInput(),
      transcript: huge,
      annotations: [
        { transcriptIndex: 50, severity: 'warn', note: 'discarded' },
        { transcriptIndex: 100, severity: 'good', note: 'first retained' },
        { transcriptIndex: 599, severity: 'gap', note: 'last retained' },
      ],
    })
    expect(rec.transcript).toHaveLength(500)
    expect(rec.transcript[rec.transcript.length - 1].text).toBe('turn 599')
    expect(rec.annotations).toEqual([
      expect.objectContaining({ transcriptIndex: 0, note: 'first retained' }),
      expect.objectContaining({ transcriptIndex: 499, note: 'last retained' }),
    ])
  })

  it('list() returns [] if directory does not exist (lazy init)', async () => {
    const store2 = new MockSessionStore()
    // Don't call load(); list() should still cope.
    tmp.cleanup()
    tmp.path = makeTempUserData().path
    // Don't pre-create the dir
    await fs.rm(join(tmp.path, 'mock-sessions'), { recursive: true, force: true })
    const list = await store2.list()
    expect(list).toEqual([])
  })
})

function basicInput(): Parameters<MockSessionStore['save']>[0] {
  return {
    presetId: 'behavioral',
    presetLabel: 'Behavioral',
    durationMinutes: 30,
    startedAt: 1000,
    endedAt: 2000,
    transcript: baseTranscript(),
    legacyFeedback: 'ok',
    rubric: baseRubric(),
    annotations: baseAnnotations(),
    strengths: [],
    gaps: [],
    nextDrills: [],
    averageScore: 3.5,
    graded: true,
  }
}
