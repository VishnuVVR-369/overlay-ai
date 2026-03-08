export type AnswerFormatMode =
  | 'full_answer'
  | 'short_hint'
  | 'clarifying_questions'
  | 'next_best_step'
  | 'follow_up_response'
  | 'star_version';

export const ANSWER_FORMAT_MODES = [
  'full_answer',
  'short_hint',
  'clarifying_questions',
  'next_best_step',
  'follow_up_response',
  'star_version',
] as const satisfies readonly AnswerFormatMode[];

export interface AnswerModeDefinition {
  id: AnswerFormatMode;
  label: string;
  shortLabel: string;
  description: string;
  hotkeyDisplay: string;
  hotkeyLetter: string;
}

export const DEFAULT_ANSWER_MODE: AnswerFormatMode = 'full_answer';

export const ANSWER_MODE_DEFINITIONS: readonly AnswerModeDefinition[] = [
  {
    id: 'full_answer',
    label: 'Full Answer',
    shortLabel: 'Full',
    description: 'Complete answer for the latest meaningful interview question.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+X',
    hotkeyLetter: 'X',
  },
  {
    id: 'short_hint',
    label: 'Short Hint',
    shortLabel: 'Hint',
    description: 'Quick nudge without a full wall of text.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+V',
    hotkeyLetter: 'V',
  },
  {
    id: 'clarifying_questions',
    label: 'Clarifying Questions',
    shortLabel: 'Clarify',
    description: 'Questions the candidate can ask to unblock the conversation.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+C',
    hotkeyLetter: 'C',
  },
  {
    id: 'next_best_step',
    label: 'Next Best Step',
    shortLabel: 'Next',
    description: 'The single best immediate move to make next.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+B',
    hotkeyLetter: 'B',
  },
  {
    id: 'follow_up_response',
    label: 'Follow-up Response',
    shortLabel: 'Follow-up',
    description: 'Natural spoken continuation of the candidate’s answer.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+N',
    hotkeyLetter: 'N',
  },
  {
    id: 'star_version',
    label: 'STAR Version',
    shortLabel: 'STAR',
    description: 'Situation / Task / Action / Result response for behavioral prompts.',
    hotkeyDisplay: 'Cmd/Ctrl+Shift+S',
    hotkeyLetter: 'S',
  },
] as const;

export const ANSWER_MODE_MAP: Readonly<
  Record<AnswerFormatMode, AnswerModeDefinition>
> = ANSWER_MODE_DEFINITIONS.reduce(
  (acc, mode) => {
    acc[mode.id] = mode;
    return acc;
  },
  {} as Record<AnswerFormatMode, AnswerModeDefinition>
);
