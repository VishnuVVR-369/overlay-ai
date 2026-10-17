import { describe, expect, it } from 'vitest'
import {
  parseAnswer,
  parseRichText,
  richTextToPlainText,
  type ParsedAnswer,
  type RichText,
} from '@shared/answer-format'

function rendered(answer: ParsedAnswer): string {
  return [
    richTextToPlainText(answer.headline),
    ...answer.beats.map((beat) => beat.text),
    richTextToPlainText(answer.detail),
  ].join('\n')
}

function expectPrefix(previous: string, current: string): void {
  expect(current.startsWith(previous), `Expected ${JSON.stringify(current)} to retain ${JSON.stringify(previous)}`).toBe(true)
}

describe('parseAnswer', () => {
  it('parses the line contract across headline, beats, and detail', () => {
    const answer = parseAnswer('Monotonic stacks solve this directly.\n- Push unresolved indices\n- Pop when a larger value arrives\n---\n```ts\nconst stack = []\n```', true)

    expect(answer.mode).toBe('contract')
    expect(answer.complete).toBe(true)
    expect(richTextToPlainText(answer.headline)).toBe('Monotonic stacks solve this directly.')
    expect(answer.beats.map(({ id, text }) => ({ id, text }))).toEqual([
      { id: 'contract:0', text: 'Push unresolved indices' },
      { id: 'contract:1', text: 'Pop when a larger value arrives' },
    ])
    expect(richTextToPlainText(answer.detail)).toBe('```ts\nconst stack = []\n```')
  })

  it('keeps ids stable and rendered text monotonic for every streaming prefix', () => {
    const sample = 'Use a queue for bounded work.\n- [[v:S1|Cap concurrency at four]]\n- Retry transient failures\n---\nShow the worker loop.'
    let previous: ParsedAnswer | null = null

    for (let length = 0; length <= sample.length; length += 1) {
      const current = parseAnswer(sample.slice(0, length))
      expect(current.mode).toBe('contract')
      expect(() => rendered(current)).not.toThrow()

      if (previous) {
        expectPrefix(richTextToPlainText(previous.headline), richTextToPlainText(current.headline))
        for (let index = 0; index < previous.beats.length; index += 1) {
          expect(current.beats[index]?.id).toBe(previous.beats[index].id)
          expectPrefix(previous.beats[index].text, current.beats[index].text)
        }
        expectPrefix(richTextToPlainText(previous.detail), richTextToPlainText(current.detail))
      }
      previous = current
    }
  })

  it('switches namespaces when a malformed contract falls back', () => {
    const partial = parseAnswer('I would isolate the write path.\n- Keep reads available')
    const malformed = parseAnswer('I would isolate the write path.\n- Keep reads available\nThis line violates the contract')

    expect(partial.mode).toBe('contract')
    expect(partial.beats[0].id).toBe('contract:0')
    expect(malformed.mode).toBe('fallback')
    expect(malformed.beats.map((beat) => beat.id)).toEqual(['fallback:0', 'fallback:1'])

    const deliveredBeatIds = new Set([partial.beats[0].id])
    expect(malformed.beats.some((beat) => deliveredBeatIds.has(beat.id))).toBe(false)
  })

  it('waits until completion before falling back from an answer with no beats', () => {
    expect(parseAnswer('A short answer').mode).toBe('contract')
    expect(parseAnswer('A short answer', true).mode).toBe('fallback')
  })

  it('buffers fallback list prefixes so rendered beats never shrink', () => {
    const samples = [
      'Headline\n* Supporting point',
      'Headline\n1. Supporting point',
      'Headline\n## Supporting point',
    ]

    for (const sample of samples) {
      let previous = ''
      for (let length = 'Headline\n'.length + 1; length <= sample.length; length += 1) {
        const answer = parseAnswer(sample.slice(0, length))
        expect(answer.mode).toBe('fallback')
        const current = answer.beats[0]?.text ?? ''
        expectPrefix(previous, current)
        previous = current
      }
    }
  })

  it('normalizes CRLF without changing the contract', () => {
    const answer = parseAnswer('Headline\r\n- First\r\n- Second', true)
    expect(answer.mode).toBe('contract')
    expect(answer.beats.map((beat) => beat.text)).toEqual(['First', 'Second'])
  })
})

describe('provenance markers', () => {
  it('parses claimed vault and explicit model spans on every answer surface', () => {
    const answer = parseAnswer(
      'I [[v:S1|cut latency 40%]] safely.\n- [[u:I would start with a canary]]\n---\nThe [[v:story_2|rollback runbook]] is relevant.',
      true,
    )

    expect(answer.headline).toEqual([
      { text: 'I ', source: 'model' },
      { text: 'cut latency 40%', source: 'vault-claimed', sourceId: 'S1' },
      { text: ' safely.', source: 'model' },
    ])
    expect(answer.beats[0].rich).toEqual([{ text: 'I would start with a canary', source: 'model' }])
    expect(answer.beats[0].text).toBe('I would start with a canary')
    expect(answer.detail).toEqual([
      { text: 'The ', source: 'model' },
      { text: 'rollback runbook', source: 'vault-claimed', sourceId: 'story_2' },
      { text: ' is relevant.', source: 'model' },
    ])
  })

  it('never manufactures verified provenance', () => {
    const rich = parseRichText('[[v:S1|Claimed]] and [[u:unverified]]')
    expect(rich.map((span) => span.source)).toEqual(['vault-claimed', 'model'])
    expect(rich.some((span) => span.source === 'vault-verified')).toBe(false)
  })

  it('buffers an incomplete marker instead of exposing syntax', () => {
    const full = 'Before [[v:S1|the payments migration]] after'
    const markerEnd = full.indexOf(']]')

    for (let length = 'Before '.length + 1; length < markerEnd + 2; length += 1) {
      expect(richTextToPlainText(parseRichText(full.slice(0, length)))).toBe('Before ')
    }
    expect(richTextToPlainText(parseRichText(full.slice(0, markerEnd + 2)))).toBe('Before the payments migration')
  })

  it('keeps a stream ending mid-marker invisible even when the answer is complete', () => {
    const answer = parseAnswer('Safe headline\n- Visible [[v:S1|withheld', true)
    expect(answer.beats[0].text).toBe('Visible')
    expect(rendered(answer)).not.toContain('[[v:')
    expect(rendered(answer)).not.toContain('withheld')
  })

  it('treats nested markers conservatively as model text', () => {
    const rich = parseRichText('[[v:S1|outer [[v:S2|inner]] text]]')
    expect(richTextToPlainText(rich)).toBe('outer inner text')
    expect(rich).toEqual([{ text: 'outer inner text', source: 'model' }])
  })

  it('renders a sequence as literal text as soon as it cannot be a marker', () => {
    expect(parseRichText('Use [[brackets]] here')).toEqual([
      { text: 'Use [[brackets]] here', source: 'model' },
    ])
  })

  it('merges adjacent spans with the same provenance', () => {
    const rich: RichText = parseRichText('one [[u:two]] three')
    expect(rich).toEqual([{ text: 'one two three', source: 'model' }])
  })
})
