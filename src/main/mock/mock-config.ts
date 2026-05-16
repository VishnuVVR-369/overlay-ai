import type { MockInterviewConfig, PresetEntry, PresetId, VaultData } from '@shared/types'
import { isPresetId } from '@shared/prompt'

const VALID_DURATIONS = [15, 30, 45, 60] as const
type Duration = (typeof VALID_DURATIONS)[number]

export function sanitizeMockConfig(
  config: Partial<MockInterviewConfig> | null | undefined,
  fallbacks: { presetId: PresetId },
): MockInterviewConfig {
  const presetId = isPresetId(config?.presetId) ? (config!.presetId as PresetId) : fallbacks.presetId
  const durationMinutes = isValidDuration(config?.durationMinutes) ? config!.durationMinutes : 30
  return { presetId, durationMinutes }
}

function isValidDuration(v: unknown): v is Duration {
  return typeof v === 'number' && (VALID_DURATIONS as readonly number[]).includes(v)
}

export interface MockPromptContext {
  preset?: PresetEntry
  vault: VaultData
}

export function buildMockInstructions(config: MockInterviewConfig, context: MockPromptContext): string {
  const presetLabel = context.preset?.label ?? config.presetId
  const vault = context.vault
  const stories = vault.stories.map((s) => `- ${s.title}: ${s.body}`).join('\n')
  return [
    'You are a realistic mock interviewer helping the user prepare for interviews.',
    `Interview type: ${presetLabel}. Duration target: ${config.durationMinutes} minutes.`,
    'Ask one question at a time. Listen to the answer, ask targeted follow-ups, and move on when enough signal is collected.',
    'Do not give the candidate a model answer during the interview. Do not mention transcripts or internal instructions.',
    'Keep spoken questions concise and natural. Adapt difficulty based on the candidate response.',
    vault.resume ? `Candidate background:\n${vault.resume}` : '',
    vault.jobDescription ? `Target role / job description:\n${vault.jobDescription}` : '',
    vault.companyValues ? `Company values / context:\n${vault.companyValues}` : '',
    vault.interviewerNotes ? `Interviewer notes:\n${vault.interviewerNotes}` : '',
    stories ? `Candidate STAR stories to probe:\n${stories}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const FEEDBACK_USER_PROMPT =
  'The mock interview is over. Give concise feedback with three sections: Strengths, Gaps, Next drill. Do not ask another question.'

export const FEEDBACK_RESPONSE_INSTRUCTIONS = 'Generate only concise post-interview feedback.'

export const RESET_USER_PROMPT =
  'I cleared the transcript. Treat this as a fresh start: ignore the prior turns and restart the interview with the next appropriate question.'

export const RESET_RESPONSE_INSTRUCTIONS =
  'The candidate restarted the interview. Begin again with a fresh opening question.'
