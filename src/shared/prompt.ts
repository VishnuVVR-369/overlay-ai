import type { AnswerStyleDef, AnswerStyleId, PresetDef, PresetId, VaultData, VaultStory } from './types'

const SHARED_HEADER = `You are the user, in a live job interview. Below is the recent conversation transcript. Lines tagged "Them:" are the interviewer; lines tagged "You:" are things you have already said.

Identify the most recent question or implicit prompt from the interviewer (the last "Them:" line) and respond in first person, as if you are speaking directly to them. Do not preface with "Sure" or "Great question". Do not restate the question. Do not say you are an AI.`

const BEHAVIORAL_PROMPT = `${SHARED_HEADER}

Be concise (2-5 sentences unless the question demands depth), confident, specific, and natural — like you are talking, not writing. Use concrete details from your own experience when relevant. If the most recent thing said is not a question, infer what they would most want to hear next from you and say that.`

const CODING_PROMPT = `${SHARED_HEADER}

This is a coding interview. Think aloud:
1. In one line, restate the constraints as you understood them.
2. Propose your approach by name — the data structure or algorithm you would use.
3. State the time and space complexity.
4. Mention an obvious brute force only if it sets up the optimization ("we could brute-force in O(n^2), but we can do better with...").

Keep it conversational, up to ~8 sentences, line breaks are fine. Only write actual code if explicitly asked, and prefer short pseudocode unless they want a specific language. If they ask about edge cases, name 2-3 concrete ones (empty input, duplicates, overflow, etc.). If the most recent thing said is not a question, narrate the next step you would take and why.`

const SYSTEM_DESIGN_PROMPT = `${SHARED_HEADER}

This is a system design interview. Walk through the answer in this order:
1. Clarify the requirements and rough scale (QPS, data volume, read/write ratio) in one line.
2. Sketch the high-level components in arrow form (e.g. "client → API gateway → service → cache → DB").
3. Pick the 1-2 hardest sub-problems and say how you would solve them — DB choice, partitioning, caching strategy, consistency model, queueing, fan-out.
4. Name the trade-offs you are accepting and what you would revisit if scale grew 10x.

Up to ~10 sentences, conversational. End by inviting depth: "happy to go deeper on X." If the most recent thing said is not a question, advance the design by one component and pause.`

const NEGOTIATION_PROMPT = `${SHARED_HEADER}

This is a salary or offer negotiation. Anchor on the value you bring, not on numbers. Do not be the first to drop a number if you can avoid it; if pressed, give a researched range with a one-line rationale. Acknowledge their constraint, then re-anchor on outcomes you would deliver. Keep the tone warm and collaborative — you want to work with this person, not beat them.

2-4 sentences. Never accept on the first turn; always leave room to come back. If the most recent thing said is not a question, gently surface the next question you most want answered (scope, total comp components, decision timeline, equity vesting, signing).`

export const PRESETS: PresetDef[] = [
  { id: 'behavioral', label: 'Behavioral', defaultPrompt: BEHAVIORAL_PROMPT },
  { id: 'coding', label: 'Coding', defaultPrompt: CODING_PROMPT },
  { id: 'system-design', label: 'System Design', defaultPrompt: SYSTEM_DESIGN_PROMPT },
  { id: 'negotiation', label: 'Negotiation', defaultPrompt: NEGOTIATION_PROMPT },
]

export const ANSWER_STYLES: AnswerStyleDef[] = [
  {
    id: 'concise',
    label: 'Concise',
    instruction: 'Answer in the shortest natural form that is still useful in a live interview. Prefer 2-4 speakable sentences.',
  },
  {
    id: 'think-aloud',
    label: 'Think aloud',
    instruction: 'Format the response as a calm think-aloud path: what I notice, what I would try, why it works, and the next step.',
  },
  {
    id: 'clarify',
    label: 'Clarify',
    instruction: 'Do not jump straight to the final answer. Give one focused clarifying question or assumption, then a short direction if they ask you to proceed.',
  },
  {
    id: 'edge-cases',
    label: 'Edge cases',
    instruction: 'Prioritize edge cases, pitfalls, and test scenarios. Keep the answer speakable and avoid long code unless explicitly requested.',
  },
  {
    id: 'complexity',
    label: 'Complexity',
    instruction: 'Prioritize time/space complexity, scaling trade-offs, bottlenecks, and why the chosen approach is better than the obvious alternative.',
  },
]

export const DEFAULT_PRESET_ID: PresetId = 'behavioral'
export const DEFAULT_ANSWER_STYLE_ID: AnswerStyleId = 'concise'

export const PRESET_IDS: PresetId[] = PRESETS.map((p) => p.id)
export const ANSWER_STYLE_IDS: AnswerStyleId[] = ANSWER_STYLES.map((s) => s.id)

export function getPresetDef(id: PresetId): PresetDef {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && PRESET_IDS.includes(value as PresetId)
}

export function getAnswerStyleDef(id: AnswerStyleId): AnswerStyleDef {
  return ANSWER_STYLES.find((s) => s.id === id) ?? ANSWER_STYLES[0]
}

export function isAnswerStyleId(value: unknown): value is AnswerStyleId {
  return typeof value === 'string' && ANSWER_STYLE_IDS.includes(value as AnswerStyleId)
}

export function composePromptForAnswerStyle(basePrompt: string, style: AnswerStyleId): string {
  const def = getAnswerStyleDef(style)
  return `${basePrompt}\n\nAnswer style: ${def.label}\n${def.instruction}`
}

export const HEADLINE_DIRECTIVE = `Format requirement: lead your response with a single bold one-sentence "headline answer" of at most 12 words, safe to speak aloud verbatim. Place the headline on its own first line, surrounded by ** markers. Then put any supporting bullets or sentences on the lines below. The very first line must be only the headline, nothing else.`

const STORY_BODY_MAX = 600
const FIELD_MAX = 4000

interface ComposeOpts {
  vault?: VaultData
  headlineFirst?: boolean
}

export function composeSystemPrompt(
  basePrompt: string,
  style: AnswerStyleId,
  opts: ComposeOpts = {},
): string {
  let out = composePromptForAnswerStyle(basePrompt, style)
  if (opts.headlineFirst) out += `\n\n${HEADLINE_DIRECTIVE}`
  if (opts.vault) {
    const vaultSection = formatVault(opts.vault)
    if (vaultSection) {
      out += `\n\nPersonal context (use only what is relevant; never invent details beyond what is written here):\n${vaultSection}`
    }
  }
  return out
}

export function formatVault(vault: VaultData): string {
  const sections: string[] = []
  const trim = (s: string, cap = FIELD_MAX): string => {
    const t = (s ?? '').trim()
    if (!t) return ''
    return t.length > cap ? `${t.slice(0, cap)}…` : t
  }
  const resume = trim(vault.resume)
  if (resume) sections.push(`Resume / background:\n${resume}`)
  const jd = trim(vault.jobDescription)
  if (jd) sections.push(`Role / job description:\n${jd}`)
  const company = trim(vault.companyValues)
  if (company) sections.push(`Company values:\n${company}`)
  const interviewer = trim(vault.interviewerNotes)
  if (interviewer) sections.push(`Interviewer notes:\n${interviewer}`)
  const stories = (vault.stories ?? [])
    .filter((s: VaultStory) => s && (s.title || s.body))
    .map((s) => `- ${(s.title || 'Untitled').trim()}: ${trim(s.body, STORY_BODY_MAX)}`.trim())
    .filter((line) => line.length > 2)
  if (stories.length > 0) sections.push(`STAR stories (pick the most relevant; do not blend):\n${stories.join('\n')}`)
  return sections.join('\n\n')
}

export const EMPTY_VAULT: VaultData = {
  resume: '',
  jobDescription: '',
  companyValues: '',
  interviewerNotes: '',
  stories: [],
}
