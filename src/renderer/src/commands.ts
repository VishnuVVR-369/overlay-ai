import type { WindowMode } from '@shared/types'

/**
 * Single source of truth for every action the overlay exposes.
 *
 * The command palette, the help tab, and button tooltips all read from here, so
 * a shortcut can never be renamed in one surface and go stale in another.
 */

export type CommandId =
  | 'ask'
  | 'screenAsk'
  | 'listen'
  | 'clearTranscript'
  | 'copyAnswer'
  | 'mock'
  | 'mockPause'
  | 'history'
  | 'setup'
  | 'context'
  | 'prompts'
  | 'help'
  | 'cycleSize'
  | 'hide'
  | 'panic'
  | 'quit'

export type CommandGroup = 'Live' | 'Practice' | 'Setup' | 'Overlay'

/** `global` shortcuts fire while the overlay is unfocused; `window` ones need focus. */
export type CommandScope = 'global' | 'window'

export interface CommandContext {
  running: boolean
  mockActive: boolean
  mockPaused: boolean
  mode: WindowMode
  hasTranscript: boolean
  hasAnswer: boolean
}

export interface CommandDef {
  id: CommandId
  group: CommandGroup
  scope: CommandScope
  /** Keys as displayed, already platform-resolved. */
  keys: string[]
  /** Label may depend on state — "Start listening" vs "Stop listening". */
  label: (ctx: CommandContext) => string
  /** One sentence shown under the label in the palette and the help tab. */
  hint: string
  /** Extra palette search terms that do not appear in the label. */
  keywords?: string[]
  /** Hidden from the palette entirely when this returns false. */
  available?: (ctx: CommandContext) => boolean
  /** Shown but visually flagged, and confirmed before running. */
  danger?: boolean
}

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

/** Modifier glyph for the current platform. */
export const mod = (): string => (isMac() ? '⌘' : 'Ctrl')
const shift = (): string => (isMac() ? '⇧' : 'Shift')

export const COMMANDS: CommandDef[] = [
  {
    id: 'ask',
    group: 'Live',
    scope: 'global',
    keys: [mod(), '\\'],
    label: () => 'Ask from transcript',
    hint: 'Answer the interviewer’s most recent question using the running transcript.',
    keywords: ['answer', 'openai', 'question'],
  },
  {
    id: 'screenAsk',
    group: 'Live',
    scope: 'global',
    keys: [mod(), shift(), '\\'],
    label: () => 'Ask from screen',
    hint: 'Capture the screen and answer what is on it — shared code, a diagram, a spec.',
    keywords: ['vision', 'screenshot', 'capture', 'openai'],
  },
  {
    id: 'listen',
    group: 'Live',
    scope: 'global',
    keys: [mod(), shift(), 'L'],
    label: (ctx) => (ctx.running ? 'Stop listening' : 'Start listening'),
    hint: 'Open microphone and system audio, and transcribe both sides of the call.',
    keywords: ['transcribe', 'record', 'mic', 'audio'],
  },
  {
    id: 'clearTranscript',
    group: 'Live',
    scope: 'window',
    keys: [],
    label: () => 'Clear transcript',
    hint: 'Wipe the conversation so the next answer starts from a clean slate.',
    keywords: ['reset', 'erase', 'wipe'],
    available: (ctx) => ctx.hasTranscript,
  },
  {
    id: 'copyAnswer',
    group: 'Live',
    scope: 'window',
    keys: [],
    label: () => 'Copy latest answer',
    hint: 'Put the most recent answer on the clipboard.',
    keywords: ['clipboard'],
    available: (ctx) => ctx.hasAnswer,
  },

  {
    id: 'mock',
    group: 'Practice',
    scope: 'window',
    keys: [],
    label: (ctx) => (ctx.mockActive ? 'End mock interview' : 'Start a mock interview'),
    hint: 'Practise against an AI interviewer that speaks, listens, and grades you afterwards.',
    keywords: ['practice', 'rehearse', 'drill', 'simulate'],
  },
  {
    id: 'mockPause',
    group: 'Practice',
    scope: 'window',
    keys: [],
    label: (ctx) => (ctx.mockPaused ? 'Resume mock interviewer' : 'Pause mock interviewer'),
    hint: 'Hold the interviewer mid-session without losing the transcript.',
    keywords: ['hold', 'break'],
    available: (ctx) => ctx.mockActive,
  },
  {
    id: 'history',
    group: 'Practice',
    scope: 'window',
    keys: [],
    label: () => 'Mock history & scores',
    hint: 'Past sessions with per-dimension scores, weak-turn annotations, and drills.',
    keywords: ['past', 'review', 'rubric', 'feedback', 'grade'],
  },

  {
    id: 'setup',
    group: 'Setup',
    scope: 'window',
    keys: [mod(), ','],
    label: () => 'Setup & API keys',
    hint: 'Readiness check, API keys, and microphone / screen permissions.',
    keywords: ['settings', 'preferences', 'config', 'openai'],
  },
  {
    id: 'context',
    group: 'Setup',
    scope: 'window',
    keys: [],
    label: () => 'Personal context',
    hint: 'Your resume, the role, company values, and the STAR stories you reach for.',
    keywords: ['resume', 'vault', 'stories', 'job description', 'star'],
  },
  {
    id: 'prompts',
    group: 'Setup',
    scope: 'window',
    keys: [],
    label: () => 'Interview mode & prompts',
    hint: 'Pick behavioral / coding / system design, set answer style, edit system prompts.',
    keywords: ['preset', 'style', 'system prompt', 'behavioral', 'coding'],
  },
  {
    id: 'help',
    group: 'Setup',
    scope: 'window',
    keys: ['?'],
    label: () => 'Shortcuts & help',
    hint: 'Every shortcut, what it does, and how to run a clean interview.',
    keywords: ['keys', 'docs', 'guide'],
  },

  {
    id: 'cycleSize',
    group: 'Overlay',
    scope: 'global',
    keys: [mod(), shift(), 'E'],
    label: (ctx) => `Resize overlay (now ${ctx.mode})`,
    hint: 'Cycle compact → normal → wide. Compact is a glanceable strip; wide fits code.',
    keywords: ['expand', 'shrink', 'compact', 'wide', 'size'],
  },
  {
    id: 'hide',
    group: 'Overlay',
    scope: 'global',
    keys: [mod(), shift(), 'B'],
    label: () => 'Hide overlay',
    hint: 'Show/hide on your own screen. It stays excluded from screen capture either way.',
    keywords: ['stealth', 'conceal', 'invisible', 'show'],
  },
  {
    id: 'panic',
    group: 'Overlay',
    scope: 'global',
    keys: [mod(), shift(), 'Esc'],
    label: () => 'Panic — wipe and hide',
    hint: 'Instantly stop capture, erase the transcript and answers, and hide the window.',
    keywords: ['emergency', 'kill', 'clear all'],
    danger: true,
  },
  {
    id: 'quit',
    group: 'Overlay',
    scope: 'window',
    keys: [],
    label: () => 'Quit Overlay',
    hint: 'Close sockets, release shortcuts, and exit.',
    keywords: ['exit', 'close'],
    danger: true,
  },
]

const BY_ID = new Map(COMMANDS.map((c) => [c.id, c]))

export function getCommand(id: CommandId): CommandDef {
  const command = BY_ID.get(id)
  if (!command) throw new Error(`Unknown command: ${id}`)
  return command
}

/** "Copy latest answer" or "Start listening · ⌘⇧L" — for button tooltips. */
export function commandTitle(id: CommandId, ctx: CommandContext): string {
  const command = getCommand(id)
  const label = command.label(ctx)
  return command.keys.length > 0 ? `${label} · ${command.keys.join('')}` : label
}

export function visibleCommands(ctx: CommandContext): CommandDef[] {
  return COMMANDS.filter((c) => c.available?.(ctx) ?? true)
}

/**
 * Ranks commands against a palette query. Matches on label, hint, group, and
 * keywords; a prefix hit on the label outranks a hit buried in the hint.
 */
export function searchCommands(query: string, ctx: CommandContext): CommandDef[] {
  const available = visibleCommands(ctx)
  const needle = query.trim().toLowerCase()
  if (!needle) return available

  const scored: Array<{ command: CommandDef; score: number }> = []
  for (const command of available) {
    const label = command.label(ctx).toLowerCase()
    const haystacks = [label, command.group.toLowerCase(), ...(command.keywords ?? []), command.hint.toLowerCase()]
    let score = 0
    if (label.startsWith(needle)) score = 100
    else if (label.includes(needle)) score = 70
    else if ((command.keywords ?? []).some((k) => k.includes(needle))) score = 50
    else if (haystacks.some((h) => h.includes(needle))) score = 20
    if (score > 0) scored.push({ command, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || COMMANDS.indexOf(a.command) - COMMANDS.indexOf(b.command))
    .map((entry) => entry.command)
}
