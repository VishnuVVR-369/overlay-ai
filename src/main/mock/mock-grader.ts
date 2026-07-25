import OpenAI from 'openai'
import type {
  MockRubricDimension,
  MockRubricScore,
  MockSessionAnnotation,
  PresetId,
  TranscriptSegment,
} from '@shared/types'
import { rubricDimensionLabel, rubricDimensionsForPreset } from '@shared/mock-rubric'

const GRADER_MODEL = 'gpt-4.1-mini'
const MAX_OUTPUT_TOKENS = 1400

export interface GraderResult {
  rubric: MockRubricScore[]
  annotations: MockSessionAnnotation[]
  strengths: string[]
  gaps: string[]
  nextDrills: string[]
}

export interface GraderClient {
  grade(
    apiKey: string,
    presetId: PresetId,
    transcript: TranscriptSegment[],
  ): Promise<GraderResult>
}

export class OpenAIMockGrader implements GraderClient {
  async grade(
    apiKey: string,
    presetId: PresetId,
    transcript: TranscriptSegment[],
  ): Promise<GraderResult> {
    const dims = rubricDimensionsForPreset(presetId)
    const client = new OpenAI({ apiKey })
    const userPayload = buildGraderUserPayload(presetId, dims, transcript)

    const completion = await client.chat.completions.create({
      model: GRADER_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPayload },
      ],
    })

    const text = completion.choices?.[0]?.message?.content ?? ''
    return parseGraderResponse(text, dims, transcript.length)
  }
}

export const mockGrader: GraderClient = new OpenAIMockGrader()

export const SYSTEM_PROMPT = `You grade mock interview transcripts. Output STRICT JSON only, no commentary. Be specific, concise, and honest — under-score rather than inflate. Quote the candidate's words as evidence when possible. Annotations point to specific transcript turns by integer index (0-based) and identify the moment that was strong, that needed work, or that was missed entirely.`

interface RawScore {
  dimension: unknown
  score: unknown
  evidence: unknown
}
interface RawAnnotation {
  transcriptIndex: unknown
  severity: unknown
  note: unknown
  betterAnswer: unknown
}

export function buildGraderUserPayload(
  presetId: PresetId,
  dims: ReturnType<typeof rubricDimensionsForPreset>,
  transcript: TranscriptSegment[],
): string {
  const numbered = transcript
    .map((seg, i) => `[${i}] ${seg.speaker === 'you' ? 'Candidate' : 'Interviewer'}: ${seg.text}`)
    .join('\n')
  const dimsBlock = dims
    .map((d) => `- ${d.dimension} ("${d.label}"): ${d.description}`)
    .join('\n')
  return [
    `Interview type: ${presetId}.`,
    `Score the candidate on these dimensions (each 1=poor, 3=adequate, 5=excellent):`,
    dimsBlock,
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "rubric": [{"dimension": "<one of the dimension keys above>", "score": <integer 1-5>, "evidence": "<short quote or paraphrase>"}],',
    '  "annotations": [{"transcriptIndex": <integer>, "severity": "good"|"warn"|"gap", "note": "<one sentence>", "betterAnswer": "<optional one-sentence stronger phrasing>"}],',
    '  "strengths": ["<one bullet>", ...],',
    '  "gaps": ["<one bullet>", ...],',
    '  "nextDrills": ["<one bullet>", ...]',
    '}',
    '',
    'Constraints: rubric must include EXACTLY the dimensions listed above, no others. Up to 6 annotations. Up to 4 items in each strengths/gaps/nextDrills list. Each note <= 25 words.',
    '',
    'Transcript:',
    numbered || '(transcript empty)',
  ].join('\n')
}

export function parseGraderResponse(
  text: string,
  dims: ReturnType<typeof rubricDimensionsForPreset>,
  transcriptLength: number,
): GraderResult {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    parsed = {}
  }

  const allowedDims = new Set<MockRubricDimension>(dims.map((d) => d.dimension))
  const rawRubric = Array.isArray(parsed.rubric) ? (parsed.rubric as RawScore[]) : []
  const seen = new Set<MockRubricDimension>()
  const rubric: MockRubricScore[] = []
  for (const item of rawRubric) {
    if (!item || typeof item !== 'object') continue
    const dim = item.dimension
    if (typeof dim !== 'string' || !allowedDims.has(dim as MockRubricDimension)) continue
    if (seen.has(dim as MockRubricDimension)) continue
    const scoreNum = typeof item.score === 'number' ? item.score : Number(item.score)
    if (!Number.isFinite(scoreNum)) continue
    const clamped = Math.max(1, Math.min(5, Math.round(scoreNum)))
    const evidence = typeof item.evidence === 'string' ? item.evidence.slice(0, 400) : ''
    rubric.push({
      dimension: dim as MockRubricDimension,
      label: rubricDimensionLabel(dim as MockRubricDimension),
      score: clamped,
      evidence,
    })
    seen.add(dim as MockRubricDimension)
  }

  const rawAnnotations = Array.isArray(parsed.annotations) ? (parsed.annotations as RawAnnotation[]) : []
  const annotations: MockSessionAnnotation[] = []
  for (const item of rawAnnotations) {
    if (annotations.length >= 6) break
    if (!item || typeof item !== 'object') continue
    const idxRaw = item.transcriptIndex
    const idx = typeof idxRaw === 'number' ? idxRaw : Number(idxRaw)
    if (!Number.isFinite(idx)) continue
    const clampedIdx = Math.max(0, Math.min(Math.max(0, transcriptLength - 1), Math.floor(idx)))
    const sev = item.severity
    if (sev !== 'good' && sev !== 'warn' && sev !== 'gap') continue
    const note = typeof item.note === 'string' ? item.note.trim().slice(0, 400) : ''
    if (!note) continue
    const better = typeof item.betterAnswer === 'string' ? item.betterAnswer.trim().slice(0, 600) : ''
    annotations.push({
      transcriptIndex: clampedIdx,
      severity: sev,
      note,
      ...(better ? { betterAnswer: better } : {}),
    })
  }

  const strengths = toStringList(parsed.strengths)
  const gaps = toStringList(parsed.gaps)
  const nextDrills = toStringList(parsed.nextDrills)

  return { rubric, annotations, strengths, gaps, nextDrills }
}

function toStringList(input: unknown, maxItems = 4, maxLen = 240): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    if (out.length >= maxItems) break
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue
    out.push(trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed)
  }
  return out
}

export function averageRubricScore(rubric: MockRubricScore[]): number | null {
  if (rubric.length === 0) return null
  const sum = rubric.reduce((acc, item) => acc + item.score, 0)
  return Math.round((sum / rubric.length) * 10) / 10
}
