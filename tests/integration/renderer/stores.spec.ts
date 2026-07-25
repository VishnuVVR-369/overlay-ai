// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { useTranscriptStore } from '@/state/transcript-store'
import { useStatusStore } from '@/state/status-store'
import { useUiStore } from '@/state/ui-store'
import { useAudioLevelsStore, AUDIO_HISTORY } from '@/state/audio-levels-store'
import { useLlmStore } from '@/state/llm-store'
import { usePresetStore } from '@/state/preset-store'

beforeEach(() => {
  useTranscriptStore.setState({ segments: [], partials: {} })
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle', micMessage: undefined, systemMessage: undefined })
  useUiStore.setState({ mode: 'normal', helpOpen: false, settingsOpen: false, focused: true, permStatus: { mic: 'unknown', screen: 'unknown' }, expandedEntries: {} })
  useAudioLevelsStore.getState().resetAll()
  useLlmStore.setState({ entries: [] })
  usePresetStore.setState({ active: 'behavioral', presets: [], hydrated: false, drafts: {} })
})

describe('transcript store (renderer)', () => {
  it('apply(partial) writes into the speaker partial slot', () => {
    useTranscriptStore.getState().apply({ speaker: 'them', kind: 'partial', segmentId: 'p1', text: 'hi', startedAt: 1 })
    expect(useTranscriptStore.getState().partials.them?.text).toBe('hi')
  })

  it('apply(committed) appends to segments and clears the speaker partial', () => {
    useTranscriptStore.getState().apply({ speaker: 'you', kind: 'partial', segmentId: 'p', text: 'um', startedAt: 1 })
    useTranscriptStore.getState().apply({ speaker: 'you', kind: 'committed', segmentId: 'p', text: 'um, ok', startedAt: 1, committedAt: 2 })
    const s = useTranscriptStore.getState()
    expect(s.segments).toHaveLength(1)
    expect(s.partials.you).toBeUndefined()
  })

  it('reset() clears everything', () => {
    useTranscriptStore.getState().apply({ speaker: 'you', kind: 'committed', segmentId: 'p', text: 'a', startedAt: 1, committedAt: 2 })
    useTranscriptStore.getState().reset()
    expect(useTranscriptStore.getState().segments).toHaveLength(0)
    expect(useTranscriptStore.getState().partials).toEqual({})
  })
})

describe('status store', () => {
  it('setSocket updates only the relevant stream slot', () => {
    useStatusStore.getState().setSocket('mic', 'open', 'msg')
    expect(useStatusStore.getState().micState).toBe('open')
    expect(useStatusStore.getState().systemState).toBe('idle')
    useStatusStore.getState().setSocket('system', 'reconnecting')
    expect(useStatusStore.getState().systemState).toBe('reconnecting')
  })

  it('setRunning toggles the running flag', () => {
    useStatusStore.getState().setRunning(true)
    expect(useStatusStore.getState().running).toBe(true)
  })
})

describe('ui store', () => {
  it('toggleEntryExpanded flips per-id', () => {
    const id = 'r-1'
    useUiStore.getState().toggleEntryExpanded(id)
    expect(useUiStore.getState().expandedEntries[id]).toBe(true)
    useUiStore.getState().toggleEntryExpanded(id)
    expect(useUiStore.getState().expandedEntries[id]).toBeUndefined()
  })
})

describe('audio levels store', () => {
  it('push moves a buffer slot in and writes the latest', () => {
    useAudioLevelsStore.getState().push('mic', 0.42)
    expect(useAudioLevelsStore.getState().micLatest).toBeCloseTo(0.42)
    expect(useAudioLevelsStore.getState().mic[AUDIO_HISTORY - 1]).toBeCloseTo(0.42)
  })

  it('resetAll clears both channels', () => {
    useAudioLevelsStore.getState().push('mic', 0.7)
    useAudioLevelsStore.getState().push('system', 0.5)
    useAudioLevelsStore.getState().resetAll()
    expect(useAudioLevelsStore.getState().micLatest).toBe(0)
    expect(useAudioLevelsStore.getState().systemLatest).toBe(0)
  })
})

describe('llm store', () => {
  it('startEntry prepends a streaming entry', () => {
    useLlmStore.getState().startEntry('r1', 'transcript')
    const e = useLlmStore.getState().entries
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ requestId: 'r1', mode: 'transcript', status: 'streaming' })
  })

  it('bounds retained native screenshots while preserving answer history', () => {
    for (let index = 1; index <= 5; index += 1) {
      useLlmStore.getState().startEntry(
        `screen-${index}`,
        'screen',
        `data:image/png;base64,${'x'.repeat(index)}`,
      )
      useLlmStore.getState().finishEntry(`screen-${index}`, `answer ${index}`)
    }

    const entries = useLlmStore.getState().entries
    expect(entries).toHaveLength(5)
    expect(entries.filter((entry) => entry.imageDataUrl)).toHaveLength(3)
    expect(entries.map((entry) => entry.text)).toEqual([
      'answer 5',
      'answer 4',
      'answer 3',
      'answer 2',
      'answer 1',
    ])
  })

  it('finishEntry sets done with full text', () => {
    useLlmStore.getState().startEntry('r1', 'transcript')
    useLlmStore.getState().finishEntry('r1', 'final answer')
    expect(useLlmStore.getState().entries[0]).toMatchObject({ status: 'done', text: 'final answer' })
  })

  it('errorEntry sets error with message', () => {
    useLlmStore.getState().startEntry('r1', 'transcript')
    useLlmStore.getState().errorEntry('r1', 'oops')
    expect(useLlmStore.getState().entries[0]).toMatchObject({ status: 'error', error: 'oops' })
  })

  it('appendToken queues deltas and rAF flushes them into chunks/text', async () => {
    useLlmStore.getState().startEntry('r1', 'transcript')
    useLlmStore.getState().appendToken('r1', 'a')
    useLlmStore.getState().appendToken('r1', 'b')
    await new Promise((r) => setTimeout(r, 30))
    const e = useLlmStore.getState().entries[0]
    expect(e.text).toBe('ab')
    expect(e.chunks).toEqual(['ab'])
  })
})

describe('preset store', () => {
  it('setState hydrates active and presets', () => {
    usePresetStore.getState().setState({ active: 'coding', presets: [{ id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false }] })
    expect(usePresetStore.getState().active).toBe('coding')
    expect(usePresetStore.getState().hydrated).toBe(true)
  })
})
