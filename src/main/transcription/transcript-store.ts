import { randomUUID } from 'node:crypto'
import type { Speaker, TranscriptSegment, TranscriptSnapshot, TranscriptUpdate } from '@shared/types'

export class TranscriptStore {
  private segments: TranscriptSegment[] = []
  private partials: { you?: TranscriptSegment; them?: TranscriptSegment } = {}
  private partialItemIds: { you?: string; them?: string } = {}

  applyPartial(speaker: Speaker, text: string, itemId?: string): TranscriptUpdate {
    const existing = !itemId || this.partialItemIds[speaker] === itemId
      ? this.partials[speaker]
      : undefined
    const startedAt = existing?.startedAt ?? Date.now()
    const id = existing?.id ?? randomUUID()
    const seg: TranscriptSegment = { id, speaker, status: 'partial', text, startedAt }
    this.partials[speaker] = seg
    this.partialItemIds[speaker] = itemId
    return { speaker, kind: 'partial', segmentId: id, text, startedAt }
  }

  applyCommitted(speaker: Speaker, text: string, itemId?: string): TranscriptUpdate {
    const matchesPartial = !itemId || this.partialItemIds[speaker] === itemId
    const existing = matchesPartial ? this.partials[speaker] : undefined
    const startedAt = existing?.startedAt ?? Date.now()
    const id = existing?.id ?? randomUUID()
    const committedAt = Date.now()
    const seg: TranscriptSegment = { id, speaker, status: 'committed', text, startedAt, committedAt }
    this.segments.push(seg)
    if (matchesPartial) {
      this.partials[speaker] = undefined
      this.partialItemIds[speaker] = undefined
    }
    return { speaker, kind: 'committed', segmentId: id, text, startedAt, committedAt }
  }

  snapshot(): TranscriptSnapshot {
    return {
      segments: [...this.segments],
      partials: { ...this.partials },
    }
  }

  clear(): void {
    this.segments = []
    this.partials = {}
    this.partialItemIds = {}
  }

  /** Flatten committed segments into "Them: ...\nYou: ..." lines, merging consecutive same-speaker turns. */
  flattenForPrompt(): string {
    if (this.segments.length === 0) return ''
    const merged: { speaker: Speaker; text: string }[] = []
    for (const seg of this.segments) {
      const last = merged[merged.length - 1]
      if (last && last.speaker === seg.speaker) {
        last.text = `${last.text} ${seg.text}`.trim()
      } else {
        merged.push({ speaker: seg.speaker, text: seg.text })
      }
    }
    return merged.map(({ speaker, text }) => `${speaker === 'you' ? 'You' : 'Them'}: ${text}`).join('\n')
  }
}
