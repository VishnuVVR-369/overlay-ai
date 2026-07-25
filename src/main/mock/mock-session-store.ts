import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isPresetId } from '@shared/prompt'
import type {
  MockRubricDimension,
  MockRubricScore,
  MockSessionAnnotation,
  MockSessionRecord,
  MockSessionSummary,
  PresetId,
  TranscriptSegment,
} from '@shared/types'

const FILE_VERSION = 1
export const MAX_TRANSCRIPT_SEGMENTS = 500
const SESSIONS_SUBDIR = 'mock-sessions'

interface PersistedSession {
  version: number
  record: MockSessionRecord
}

export interface SaveInput {
  id?: string
  presetId: PresetId
  presetLabel: string
  durationMinutes: number
  startedAt: number
  endedAt: number
  transcript: TranscriptSegment[]
  legacyFeedback: string
  rubric: MockRubricScore[]
  annotations: MockSessionAnnotation[]
  strengths: string[]
  gaps: string[]
  nextDrills: string[]
  averageScore: number | null
  graded: boolean
  graderError?: string
}

export class MockSessionStore {
  private dirPath = ''

  async load(): Promise<void> {
    this.dirPath = join(app.getPath('userData'), SESSIONS_SUBDIR)
    await fs.mkdir(this.dirPath, { recursive: true })
  }

  async save(input: SaveInput): Promise<MockSessionRecord> {
    if (!this.dirPath) await this.load()
    const id = input.id ?? randomUUID()
    const transcriptOffset = Math.max(0, input.transcript.length - MAX_TRANSCRIPT_SEGMENTS)
    const transcript = truncateMockTranscript(input.transcript)
    const annotations = input.annotations
      .filter((annotation) =>
        annotation.transcriptIndex >= transcriptOffset &&
        annotation.transcriptIndex < input.transcript.length,
      )
      .map((annotation) => ({
        ...annotation,
        transcriptIndex: annotation.transcriptIndex - transcriptOffset,
      }))
    const record: MockSessionRecord = {
      id,
      presetId: input.presetId,
      presetLabel: input.presetLabel,
      durationMinutes: input.durationMinutes,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      averageScore: input.averageScore,
      graded: input.graded,
      transcript,
      legacyFeedback: input.legacyFeedback,
      rubric: input.rubric,
      annotations,
      strengths: input.strengths,
      gaps: input.gaps,
      nextDrills: input.nextDrills,
      ...(input.graderError ? { graderError: input.graderError } : {}),
    }
    const payload: PersistedSession = { version: FILE_VERSION, record }
    const filename = `${record.startedAt}-${id}.json`
    await fs.writeFile(join(this.dirPath, filename), JSON.stringify(payload, null, 2), 'utf-8')
    return record
  }

  async list(): Promise<MockSessionSummary[]> {
    if (!this.dirPath) await this.load()
    let names: string[] = []
    try {
      names = await fs.readdir(this.dirPath)
    } catch {
      return []
    }
    const summaries: MockSessionSummary[] = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const full = join(this.dirPath, name)
      try {
        const raw = await fs.readFile(full, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<PersistedSession>
        const rec = parsed.record
        if (parsed.version !== FILE_VERSION || !isValidRecord(rec)) continue
        summaries.push(toSummary(rec))
      } catch {
        // skip malformed files
      }
    }
    summaries.sort((a, b) => b.startedAt - a.startedAt)
    return summaries
  }

  async get(id: string): Promise<MockSessionRecord | null> {
    if (!this.dirPath) await this.load()
    let names: string[] = []
    try {
      names = await fs.readdir(this.dirPath)
    } catch {
      return null
    }
    const match = names.find((n) => n.endsWith(`-${id}.json`))
    if (!match) return null
    try {
      const raw = await fs.readFile(join(this.dirPath, match), 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PersistedSession>
      if (parsed.version !== FILE_VERSION || !isValidRecord(parsed.record)) return null
      return parsed.record as MockSessionRecord
    } catch {
      return null
    }
  }

  async delete(id: string): Promise<boolean> {
    if (!this.dirPath) await this.load()
    let names: string[] = []
    try {
      names = await fs.readdir(this.dirPath)
    } catch {
      return false
    }
    const match = names.find((n) => n.endsWith(`-${id}.json`))
    if (!match) return false
    try {
      await fs.unlink(join(this.dirPath, match))
      return true
    } catch {
      return false
    }
  }
}

export const mockSessionStore = new MockSessionStore()

export function truncateMockTranscript(transcript: TranscriptSegment[]): TranscriptSegment[] {
  return transcript.slice(-MAX_TRANSCRIPT_SEGMENTS)
}

function isValidRecord(value: unknown): value is MockSessionRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    isPresetId(v.presetId) &&
    typeof v.presetLabel === 'string' &&
    isFiniteNumber(v.durationMinutes) &&
    isFiniteNumber(v.startedAt) &&
    isFiniteNumber(v.endedAt) &&
    (v.averageScore === null || isFiniteNumber(v.averageScore)) &&
    typeof v.graded === 'boolean' &&
    isArrayOf(v.transcript, isTranscriptSegment) &&
    typeof v.legacyFeedback === 'string' &&
    isArrayOf(v.rubric, isRubricScore) &&
    isArrayOf(v.annotations, isSessionAnnotation) &&
    isArrayOf(v.strengths, isString) &&
    isArrayOf(v.gaps, isString) &&
    isArrayOf(v.nextDrills, isString) &&
    (v.graderError === undefined || typeof v.graderError === 'string')
  )
}

function isArrayOf<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isTranscriptSegment(value: unknown): value is TranscriptSegment {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    (v.speaker === 'you' || v.speaker === 'them') &&
    (v.status === 'partial' || v.status === 'committed') &&
    typeof v.text === 'string' &&
    isFiniteNumber(v.startedAt) &&
    (v.committedAt === undefined || isFiniteNumber(v.committedAt))
  )
}

function isRubricScore(value: unknown): value is MockRubricScore {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    isRubricDimension(v.dimension) &&
    typeof v.label === 'string' &&
    isFiniteNumber(v.score) &&
    v.score >= 1 &&
    v.score <= 5 &&
    typeof v.evidence === 'string'
  )
}

function isRubricDimension(value: unknown): value is MockRubricDimension {
  return (
    value === 'clarification' ||
    value === 'structure' ||
    value === 'communication' ||
    value === 'correctness' ||
    value === 'starCompleteness' ||
    value === 'tradeoffs' ||
    value === 'complexity'
  )
}

function isSessionAnnotation(value: unknown): value is MockSessionAnnotation {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    isFiniteNumber(v.transcriptIndex) &&
    Number.isInteger(v.transcriptIndex) &&
    v.transcriptIndex >= 0 &&
    (v.severity === 'good' || v.severity === 'warn' || v.severity === 'gap') &&
    typeof v.note === 'string' &&
    (v.betterAnswer === undefined || typeof v.betterAnswer === 'string')
  )
}

function toSummary(rec: MockSessionRecord): MockSessionSummary {
  return {
    id: rec.id,
    presetId: rec.presetId,
    presetLabel: rec.presetLabel,
    durationMinutes: rec.durationMinutes,
    startedAt: rec.startedAt,
    endedAt: rec.endedAt,
    averageScore: rec.averageScore,
    graded: rec.graded,
  }
}
