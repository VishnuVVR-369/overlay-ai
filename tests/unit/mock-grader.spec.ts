import { describe, expect, it } from 'vitest'
import {
  averageRubricScore,
  buildGraderUserPayload,
  parseGraderResponse,
} from '@main/mock/mock-grader'
import { rubricDimensionsForPreset } from '@shared/mock-rubric'
import type { TranscriptSegment } from '@shared/types'

const segs = (parts: Array<['you' | 'them', string]>): TranscriptSegment[] =>
  parts.map(([speaker, text], i) => ({
    id: `s${i}`,
    speaker,
    status: 'committed' as const,
    text,
    startedAt: 1_000 + i,
    committedAt: 1_000 + i + 50,
  }))

describe('mock grader user payload', () => {
  it('numbers transcript turns and lists every rubric dimension for the preset', () => {
    const dims = rubricDimensionsForPreset('coding')
    const payload = buildGraderUserPayload('coding', dims, segs([
      ['them', 'Reverse a linked list in place.'],
      ['you', 'I would walk pointers with prev/curr/next.'],
    ]))
    expect(payload).toContain('Interview type: coding')
    expect(payload).toContain('[0] Interviewer: Reverse a linked list')
    expect(payload).toContain('[1] Candidate: I would walk pointers')
    // every dim listed
    for (const d of dims) expect(payload).toContain(`- ${d.dimension}`)
  })

  it('still emits the schema even when transcript is empty', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const payload = buildGraderUserPayload('behavioral', dims, [])
    expect(payload).toContain('"rubric"')
    expect(payload).toContain('(transcript empty)')
  })
})

describe('mock grader response parsing', () => {
  it('parses a well-formed JSON response into clamped rubric + annotations', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const raw = JSON.stringify({
      rubric: [
        { dimension: 'starCompleteness', score: 4, evidence: 'Named outcome' },
        { dimension: 'structure', score: '3', evidence: 'Good flow' },
        { dimension: 'communication', score: 9, evidence: 'Confident' },
        { dimension: 'clarification', score: 0, evidence: 'No clarifying Q' },
      ],
      annotations: [
        { transcriptIndex: 0, severity: 'good', note: 'Strong opening.' },
        { transcriptIndex: 99, severity: 'gap', note: 'Missed result.', betterAnswer: 'Add measured impact.' },
      ],
      strengths: ['Specific result', 'Clear timeline'],
      gaps: ['Did not name the action'],
      nextDrills: ['Practice STAR with metrics'],
    })
    const result = parseGraderResponse(raw, dims, 4)
    // score 9 clamps to 5; "3" coerces; 0 clamps to 1
    expect(result.rubric.find((r) => r.dimension === 'communication')?.score).toBe(5)
    expect(result.rubric.find((r) => r.dimension === 'structure')?.score).toBe(3)
    expect(result.rubric.find((r) => r.dimension === 'clarification')?.score).toBe(1)
    // out-of-range transcriptIndex clamps to last valid index
    expect(result.annotations[1].transcriptIndex).toBe(3)
    expect(result.annotations[1].betterAnswer).toBe('Add measured impact.')
    expect(result.strengths).toHaveLength(2)
  })

  it('rejects rubric entries whose dimension is not allowed for the preset', () => {
    const dims = rubricDimensionsForPreset('coding') // does not include starCompleteness
    const raw = JSON.stringify({
      rubric: [
        { dimension: 'starCompleteness', score: 5, evidence: 'irrelevant' },
        { dimension: 'correctness', score: 4, evidence: 'works' },
      ],
      annotations: [],
      strengths: [],
      gaps: [],
      nextDrills: [],
    })
    const result = parseGraderResponse(raw, dims, 0)
    expect(result.rubric.map((r) => r.dimension)).toEqual(['correctness'])
  })

  it('deduplicates repeated rubric dimensions, keeping the first', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const raw = JSON.stringify({
      rubric: [
        { dimension: 'structure', score: 4, evidence: 'first' },
        { dimension: 'structure', score: 2, evidence: 'second' },
      ],
      annotations: [],
      strengths: [],
      gaps: [],
      nextDrills: [],
    })
    const result = parseGraderResponse(raw, dims, 0)
    const structures = result.rubric.filter((r) => r.dimension === 'structure')
    expect(structures).toHaveLength(1)
    expect(structures[0].evidence).toBe('first')
  })

  it('rejects annotations missing required fields', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const raw = JSON.stringify({
      rubric: [],
      annotations: [
        { transcriptIndex: 0, severity: 'good' }, // no note
        { transcriptIndex: 0, severity: 'sideways', note: 'bad severity' },
        { severity: 'good', note: 'missing index' },
        { transcriptIndex: 0, severity: 'good', note: 'kept' },
      ],
      strengths: [], gaps: [], nextDrills: [],
    })
    const result = parseGraderResponse(raw, dims, 5)
    expect(result.annotations).toHaveLength(1)
    expect(result.annotations[0].note).toBe('kept')
  })

  it('returns empty result on malformed JSON without throwing', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const result = parseGraderResponse('not json {', dims, 0)
    expect(result.rubric).toEqual([])
    expect(result.annotations).toEqual([])
    expect(result.strengths).toEqual([])
  })

  it('caps lists at 4 strengths/gaps/drills and 6 annotations', () => {
    const dims = rubricDimensionsForPreset('behavioral')
    const raw = JSON.stringify({
      rubric: [],
      annotations: Array.from({ length: 10 }, (_, i) => ({
        transcriptIndex: 0, severity: 'good', note: `n${i}`,
      })),
      strengths: ['a', 'b', 'c', 'd', 'e', 'f'],
      gaps: [],
      nextDrills: [],
    })
    const result = parseGraderResponse(raw, dims, 1)
    expect(result.annotations).toHaveLength(6)
    expect(result.strengths).toHaveLength(4)
  })
})

describe('averageRubricScore', () => {
  it('returns null for empty rubric', () => {
    expect(averageRubricScore([])).toBeNull()
  })
  it('rounds to one decimal place', () => {
    const avg = averageRubricScore([
      { dimension: 'structure', label: 'Structure', score: 4, evidence: '' },
      { dimension: 'communication', label: 'Communication', score: 3, evidence: '' },
      { dimension: 'clarification', label: 'Clarification', score: 5, evidence: '' },
    ])
    expect(avg).toBe(4)
  })
  it('handles non-integer averages', () => {
    const avg = averageRubricScore([
      { dimension: 'structure', label: 'Structure', score: 4, evidence: '' },
      { dimension: 'communication', label: 'Communication', score: 3, evidence: '' },
    ])
    expect(avg).toBe(3.5)
  })
})
