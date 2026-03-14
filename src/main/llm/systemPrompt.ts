import {
  DEFAULT_INTERVIEW_MODE,
  getInterviewModeLabel,
  type InterviewMode,
} from '../../lib/interviewModes';
import { getSettings, getInterviewModeFromSettings } from '../settingsStore';

export const LEGACY_DEFAULT_SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. You have access to the last 20 minutes of conversation. The user just asked a specific question or the interviewer posed a problem.
1. Identify the core question.
2. If it is a Coding question: Provide Python code, time complexity, and brief explanation.
3. If it is System Design: Outline high-level components and trade-offs.
4. Ignore small talk in the transcript.`;

export const BASE_SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. You have access to the last 20 minutes of conversation.

Your job:
1. Identify the most recent substantive interviewer question, prompt, or problem.
2. Ignore filler and small talk unless it changes the answer.
3. Give a high-signal answer optimized for the active interview mode.
4. Be concise, structured, and immediately useful in a live interview setting.
5. If the transcript is ambiguous, briefly state the ambiguity and make the best reasonable assumption.`;

export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
export const DEFAULT_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

const MODE_INSTRUCTIONS: Record<InterviewMode, string> = {
  general: `Mode: General
- Adapt to the question type without overfitting too early.
- For coding questions, provide a direct solution, complexity, and key edge cases.
- For design questions, cover components, constraints, and tradeoffs.
- For discussion questions, prioritize clarity and concise reasoning.`,
  dsa: `Mode: DSA
- Start with the core problem statement and any clarifying questions worth asking.
- Progress from brute force to the best practical solution.
- Call out the data structures and invariants that matter.
- Include edge cases, time complexity, and space complexity.
- Prefer Python when code is appropriate.`,
  'system-design': `Mode: System Design
- Start with requirements and assumptions.
- State scale, traffic, consistency, and availability expectations explicitly.
- Outline architecture, key components, storage, and APIs.
- Identify bottlenecks, failure modes, and tradeoffs.
- Prefer a top-down structure over implementation details.`,
  behavioral: `Mode: Behavioral
- Answer in a concise STAR structure.
- Emphasize ownership, decisions, collaboration, and measurable impact.
- Avoid unnecessary technical depth unless it strengthens the story.
- Prefer tight, interview-ready phrasing over long narration.`,
  frontend: `Mode: Frontend
- Focus on UI requirements, component boundaries, and state management.
- Cover accessibility, responsiveness, browser behavior, and performance.
- Call out rendering tradeoffs, data fetching, and failure states.
- When code is needed, keep it implementation-oriented and practical.`,
  backend: `Mode: Backend
- Focus on APIs, contracts, data flow, persistence, and reliability.
- Cover consistency, scaling, caching, concurrency, and operational concerns.
- Highlight observability, failure handling, and security where relevant.
- Prefer clear interfaces and system behavior over vague abstractions.`,
  ml: `Mode: ML
- Start with the problem framing and success metrics.
- Cover data requirements, baselines, feature considerations, and model choices.
- Discuss evaluation, offline and online validation, and deployment risks.
- Mention monitoring, drift, and iteration strategy when relevant.`,
  debugging: `Mode: Debugging
- Start with symptom summary and likely reproduction path.
- Generate the most plausible hypotheses and how to isolate them.
- Recommend instrumentation, logs, or experiments to narrow the problem.
- End with the most likely root cause, fix direction, and verification steps.`,
};

const MODE_USER_PROMPT_HINTS: Record<InterviewMode, string> = {
  general: 'Use a balanced technical interview structure that matches the question type.',
  dsa: 'Optimize for clarifying questions, brute force to optimal progression, edge cases, and complexity.',
  'system-design':
    'Optimize for requirements, scale assumptions, architecture, bottlenecks, and tradeoffs.',
  behavioral: 'Optimize for concise STAR storytelling with clear ownership and impact.',
  frontend:
    'Optimize for UI requirements, state, accessibility, browser behavior, and performance.',
  backend:
    'Optimize for APIs, storage, reliability, scaling, and operational tradeoffs.',
  ml: 'Optimize for metrics, data, baselines, model choice, evaluation, and deployment risks.',
  debugging:
    'Optimize for reproduction, hypotheses, isolation, instrumentation, fix plan, and verification.',
};

export function getModeInstructions(mode: InterviewMode): string {
  return MODE_INSTRUCTIONS[mode];
}

export function normalizeCustomSystemPrompt(
  prompt?: string | null
): string | undefined {
  const trimmed = prompt?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (
    trimmed === LEGACY_DEFAULT_SYSTEM_PROMPT.trim() ||
    trimmed === BASE_SYSTEM_PROMPT.trim()
  ) {
    return undefined;
  }

  return trimmed;
}

export function buildSystemPrompt(
  mode: InterviewMode = DEFAULT_INTERVIEW_MODE,
  customSystemPrompt?: string | null
): string {
  const sections = [
    BASE_SYSTEM_PROMPT,
    `Active interview mode: ${getInterviewModeLabel(mode)}`,
    getModeInstructions(mode),
  ];

  const normalizedCustomPrompt =
    normalizeCustomSystemPrompt(customSystemPrompt);
  if (normalizedCustomPrompt) {
    sections.push(
      `Additional user instructions that override the default behavior when relevant:\n${normalizedCustomPrompt}`
    );
  }

  return sections.join('\n\n');
}

export function getSystemPrompt(): string {
  const settings = getSettings();
  return buildSystemPrompt(
    settings.interviewMode ?? DEFAULT_INTERVIEW_MODE,
    settings.customSystemPrompt
  );
}

export function buildUserPrompt(
  context: string,
  mode: InterviewMode = getInterviewModeFromSettings()
): string {
  return `Interview mode: ${getInterviewModeLabel(mode)}
Mode-specific answer focus: ${MODE_USER_PROMPT_HINTS[mode]}

Here is the conversation transcript from the last 20 minutes:

${context}

Based on the above conversation, identify the most recent substantive question or problem and provide the most helpful response for this interview mode.`;
}
