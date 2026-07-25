import type { MockRubricDimension, PresetId } from './types'

export interface RubricDimensionDef {
  dimension: MockRubricDimension
  label: string
  description: string
}

const CLARIFICATION: RubricDimensionDef = {
  dimension: 'clarification',
  label: 'Clarification',
  description: 'Asked the right scoping/assumption questions before answering.',
}
const STRUCTURE: RubricDimensionDef = {
  dimension: 'structure',
  label: 'Structure',
  description: 'Organized the response so the listener could follow it.',
}
const COMMUNICATION: RubricDimensionDef = {
  dimension: 'communication',
  label: 'Communication',
  description: 'Spoke clearly, paced well, avoided filler and rambling.',
}
const CORRECTNESS: RubricDimensionDef = {
  dimension: 'correctness',
  label: 'Correctness',
  description: 'Technical accuracy and depth of the substantive answer.',
}
const STAR: RubricDimensionDef = {
  dimension: 'starCompleteness',
  label: 'STAR completeness',
  description: 'Situation, Task, Action, Result — all four present with concrete detail.',
}
const TRADEOFFS: RubricDimensionDef = {
  dimension: 'tradeoffs',
  label: 'Trade-offs',
  description: 'Named alternatives and explained why this choice over those.',
}
const COMPLEXITY: RubricDimensionDef = {
  dimension: 'complexity',
  label: 'Complexity',
  description: 'Stated time/space complexity (or scale numbers for system design).',
}

const BEHAVIORAL: RubricDimensionDef[] = [STAR, STRUCTURE, COMMUNICATION, CLARIFICATION]
const CODING: RubricDimensionDef[] = [CLARIFICATION, CORRECTNESS, COMPLEXITY, COMMUNICATION]
const SYSTEM_DESIGN: RubricDimensionDef[] = [CLARIFICATION, STRUCTURE, TRADEOFFS, COMMUNICATION]
const NEGOTIATION: RubricDimensionDef[] = [STRUCTURE, COMMUNICATION, TRADEOFFS, CLARIFICATION]

export const RUBRIC_BY_PRESET: Record<PresetId, RubricDimensionDef[]> = {
  behavioral: BEHAVIORAL,
  coding: CODING,
  'system-design': SYSTEM_DESIGN,
  negotiation: NEGOTIATION,
}

export function rubricDimensionsForPreset(presetId: PresetId): RubricDimensionDef[] {
  return RUBRIC_BY_PRESET[presetId] ?? BEHAVIORAL
}

export function rubricDimensionLabel(dim: MockRubricDimension): string {
  switch (dim) {
    case 'clarification': return CLARIFICATION.label
    case 'structure': return STRUCTURE.label
    case 'communication': return COMMUNICATION.label
    case 'correctness': return CORRECTNESS.label
    case 'starCompleteness': return STAR.label
    case 'tradeoffs': return TRADEOFFS.label
    case 'complexity': return COMPLEXITY.label
  }
}
