export type ParseMode = 'contract' | 'fallback'

export type Provenance = 'model' | 'vault-claimed' | 'vault-verified'

export interface RichTextSpan {
  text: string
  source: Provenance
  sourceId?: string
}

export type RichText = RichTextSpan[]

export interface ParsedBeat {
  id: string
  /** Plain text used for delivery matching. Format and provenance markers are removed. */
  text: string
  rich: RichText
}

export interface ParsedAnswer {
  mode: ParseMode
  headline: RichText
  beats: ParsedBeat[]
  detail: RichText
  /** Whether the source stream has reached a terminal state. */
  complete: boolean
}

interface ContractParts {
  headline: string
  beats: string[]
  detail: string
}

interface Marker {
  end: number
  content: string
  source: Provenance
  sourceId?: string
}

const VAULT_HEADER = /^v:([A-Za-z0-9_-]+)\|/

/**
 * Parse an incrementally streamed answer.
 *
 * A stream remains in contract mode for as long as it can still satisfy the
 * line-oriented format. It falls back only after an impossible line arrives,
 * or at stream completion when no usable beat was produced.
 */
export function parseAnswer(text: string, complete = false): ParsedAnswer {
  const normalized = text.replace(/\r\n?/g, '\n')
  const contract = parseContract(normalized, complete)

  return contract
    ? buildAnswer('contract', contract, complete)
    : buildAnswer('fallback', parseFallback(normalized), complete)
}

/** Parse provenance markers while withholding any trailing incomplete marker. */
export function parseRichText(text: string): RichText {
  const spans: RichText = []
  let plainStart = 0
  let cursor = 0

  while (cursor < text.length) {
    if (text[cursor] !== '[') {
      cursor += 1
      continue
    }

    if (cursor + 1 === text.length) {
      appendSpan(spans, text.slice(plainStart, cursor), 'model')
      break
    }

    if (text[cursor + 1] !== '[') {
      cursor += 1
      continue
    }

    const marker = readMarker(text, cursor)
    if (marker === 'incomplete') {
      appendSpan(spans, text.slice(plainStart, cursor), 'model')
      break
    }
    if (marker === null) {
      cursor += 2
      continue
    }

    appendSpan(spans, text.slice(plainStart, cursor), 'model')
    appendSpan(spans, marker.content, marker.source, marker.sourceId)
    cursor = marker.end
    plainStart = cursor
  }

  if (cursor >= text.length) appendSpan(spans, text.slice(plainStart), 'model')
  return spans
}

export function richTextToPlainText(rich: RichText): string {
  return rich.map((span) => span.text).join('')
}

function parseContract(text: string, complete: boolean): ContractParts | null {
  const lines = text.split('\n')
  const headline = lines[0] ?? ''
  const beats: string[] = []
  let detailStart = -1

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]
    // split() represents the not-yet-written line after a trailing newline as
    // a final empty item. That line can still become a beat or delimiter.
    const isCurrentLine = index === lines.length - 1

    if (line === '---') {
      detailStart = index + 1
      break
    }
    if (line.startsWith('- ')) {
      beats.push(line.slice(2))
      continue
    }

    if (isCurrentLine && (line === '' || line === '-' || line === '--')) continue
    return null
  }

  if (complete && (beats.length === 0 || beats.some((beat) => beat.trim() === ''))) return null

  return {
    headline,
    beats,
    detail: detailStart < 0 ? '' : lines.slice(detailStart).join('\n'),
  }
}

function parseFallback(text: string): ContractParts {
  const parts = text
    .split(/\n+/)
    .map(stripFallbackPrefix)
    .filter(Boolean)

  return {
    headline: parts[0] ?? '',
    beats: parts.slice(1),
    detail: '',
  }
}

function stripFallbackPrefix(text: string): string {
  const trimmed = text.trim()
  if (/^#{1,6}$/.test(trimmed) || /^[-*+]$/.test(trimmed) || /^\d+[.)]?$/.test(trimmed)) {
    return ''
  }
  return trimmed
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
}

function buildAnswer(mode: ParseMode, parts: ContractParts, complete: boolean): ParsedAnswer {
  const beats = parts.beats.map((beat, index) => {
    const rich = trimRichText(parseRichText(beat))
    return {
      id: `${mode}:${index}`,
      text: richTextToPlainText(rich),
      rich,
    }
  })

  return {
    mode,
    headline: trimRichText(parseRichText(parts.headline)),
    beats,
    detail: trimRichText(parseRichText(parts.detail)),
    complete,
  }
}

function readMarker(text: string, start: number): Marker | 'incomplete' | null {
  const bodyStart = start + 2
  const suffix = text.slice(bodyStart)
  const unverified = suffix.startsWith('u:')
  const vaultMatch = suffix.match(VAULT_HEADER)

  if (!unverified && !vaultMatch) {
    if (isPossibleMarkerHeader(suffix)) return 'incomplete'
    return null
  }

  const contentStart = bodyStart + (unverified ? 2 : vaultMatch![0].length)
  const end = findBalancedMarkerEnd(text, contentStart)
  if (end < 0) return 'incomplete'

  const rawContent = text.slice(contentStart, end - 2)
  if (rawContent.includes('[[')) {
    return {
      end,
      content: richTextToPlainText(parseRichText(rawContent)),
      source: 'model',
    }
  }

  return unverified
    ? { end, content: rawContent, source: 'model' }
    : { end, content: rawContent, source: 'vault-claimed', sourceId: vaultMatch![1] }
}

function isPossibleMarkerHeader(suffix: string): boolean {
  if ('u:'.startsWith(suffix) || 'v:'.startsWith(suffix)) return true
  return /^v:[A-Za-z0-9_-]*$/.test(suffix)
}

function findBalancedMarkerEnd(text: string, contentStart: number): number {
  let depth = 1
  for (let cursor = contentStart; cursor < text.length - 1; cursor += 1) {
    const pair = text.slice(cursor, cursor + 2)
    if (pair === '[[') {
      depth += 1
      cursor += 1
    } else if (pair === ']]') {
      depth -= 1
      cursor += 1
      if (depth === 0) return cursor + 1
    }
  }
  return -1
}

function appendSpan(
  spans: RichText,
  text: string,
  source: Provenance,
  sourceId?: string,
): void {
  if (!text) return
  const previous = spans.at(-1)
  if (previous && previous.source === source && previous.sourceId === sourceId) {
    previous.text += text
    return
  }
  spans.push(sourceId ? { text, source, sourceId } : { text, source })
}

function trimRichText(rich: RichText): RichText {
  const trimmed = rich.map((span) => ({ ...span }))
  while (trimmed[0]) {
    trimmed[0].text = trimmed[0].text.trimStart()
    if (trimmed[0].text) break
    trimmed.shift()
  }
  while (trimmed.at(-1)) {
    const last = trimmed.at(-1)!
    last.text = last.text.trimEnd()
    if (last.text) break
    trimmed.pop()
  }
  return trimmed
}
