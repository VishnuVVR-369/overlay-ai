export type InterviewMode =
  | 'general'
  | 'dsa'
  | 'system-design'
  | 'behavioral'
  | 'frontend'
  | 'backend'
  | 'ml'
  | 'debugging';

export interface InterviewModeOption {
  id: InterviewMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const DEFAULT_INTERVIEW_MODE: InterviewMode = 'general';

export const INTERVIEW_MODE_OPTIONS: readonly InterviewModeOption[] = [
  {
    id: 'general',
    label: 'General',
    shortLabel: 'General',
    description:
      'Balanced technical interview help across coding, design, and discussion.',
  },
  {
    id: 'dsa',
    label: 'DSA',
    shortLabel: 'DSA',
    description:
      'Focus on clarifying questions, brute-force to optimal progression, edge cases, and complexity.',
  },
  {
    id: 'system-design',
    label: 'System Design',
    shortLabel: 'Design',
    description:
      'Focus on requirements, scale assumptions, architecture, bottlenecks, and tradeoffs.',
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    shortLabel: 'Behavioral',
    description:
      'Focus on concise STAR storytelling, ownership, impact, and measurable outcomes.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    shortLabel: 'Frontend',
    description:
      'Focus on UI requirements, state, accessibility, browser behavior, and performance.',
  },
  {
    id: 'backend',
    label: 'Backend',
    shortLabel: 'Backend',
    description:
      'Focus on APIs, storage, reliability, scalability, and operational tradeoffs.',
  },
  {
    id: 'ml',
    label: 'ML',
    shortLabel: 'ML',
    description:
      'Focus on problem framing, metrics, data, model choice, evaluation, and deployment risks.',
  },
  {
    id: 'debugging',
    label: 'Debugging',
    shortLabel: 'Debugging',
    description:
      'Focus on reproduction, isolation, hypotheses, instrumentation, root cause, and verification.',
  },
] as const;

export function isInterviewMode(value: unknown): value is InterviewMode {
  return INTERVIEW_MODE_OPTIONS.some((option) => option.id === value);
}

export function normalizeInterviewMode(value: unknown): InterviewMode {
  return isInterviewMode(value) ? value : DEFAULT_INTERVIEW_MODE;
}

export function getInterviewModeOption(
  mode: InterviewMode
): InterviewModeOption {
  return (
    INTERVIEW_MODE_OPTIONS.find((option) => option.id === mode) ??
    INTERVIEW_MODE_OPTIONS[0]
  );
}

export function getInterviewModeLabel(mode: InterviewMode): string {
  return getInterviewModeOption(mode).label;
}
