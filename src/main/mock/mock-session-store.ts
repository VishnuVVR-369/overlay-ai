import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isPresetId } from '@shared/prompt'
import type {
  MockRubricScore,
  MockSessionAnnotation,
  MockSessionRecord,
  MockSessionSummary,
  PresetId,
  TranscriptSegment,
} from '@shared/types'

const FILE_VERSION = 1
const MAX_TRANSCRIPT_SEGMENTS = 500
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
  private summariesCache: MockSessionSummary[] | null = null

  async load(): Promise<void> {
    this.dirPath = join(app.getPath('userData'), SESSIONS_SUBDIR)
    await fs.mkdir(this.dirPath, { recursive: true })
    this.summariesCache = null
  }

  async save(input: SaveInput): Promise<MockSessionRecord> {
    if (!this.dirPath) await this.load()
    const id = input.id ?? randomUUID()
    const record: MockSessionRecord = {
      id,
      presetId: input.presetId,
      presetLabel: input.presetLabel,
      durationMinutes: input.durationMinutes,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      averageScore: input.averageScore,
      graded: input.graded,
      transcript: input.transcript.slice(-MAX_TRANSCRIPT_SEGMENTS),
      legacyFeedback: input.legacyFeedback,
      rubric: input.rubric,
      annotations: input.annotations,
      strengths: input.strengths,
      gaps: input.gaps,
      nextDrills: input.nextDrills,
      ...(input.graderError ? { graderError: input.graderError } : {}),
    }
    const payload: PersistedSession = { version: FILE_VERSION, record }
    const filename = `${record.startedAt}-${id}.json`
    await fs.writeFile(join(this.dirPath, filename), JSON.stringify(payload, null, 2), 'utf-8')
    this.summariesCache = null
    return record
  }

  async list(): Promise<MockSessionSummary[]> {
    if (this.summariesCache) return this.summariesCache
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
    this.summariesCache = summaries
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
      this.summariesCache = null
      return true
    } catch {
      return false
    }
  }
}

export const mockSessionStore = new MockSessionStore()

function isValidRecord(value: unknown): value is MockSessionRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    isPresetId(v.presetId) &&
    typeof v.presetLabel === 'string' &&
    typeof v.durationMinutes === 'number' &&
    typeof v.startedAt === 'number' &&
    typeof v.endedAt === 'number' &&
    (v.averageScore === null || typeof v.averageScore === 'number') &&
    typeof v.graded === 'boolean' &&
    Array.isArray(v.transcript) &&
    typeof v.legacyFeedback === 'string' &&
    Array.isArray(v.rubric) &&
    Array.isArray(v.annotations) &&
    Array.isArray(v.strengths) &&
    Array.isArray(v.gaps) &&
    Array.isArray(v.nextDrills) &&
    (v.graderError === undefined || typeof v.graderError === 'string')
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
