import type { CommandContext } from '../commands'
import { useUiStore } from '../state/ui-store'
import { useStatusStore } from '../state/status-store'
import { useMockStore } from '../state/mock-store'
import { useLlmStore } from '../state/llm-store'
import { useTranscriptStore } from '../state/transcript-store'

/**
 * The state every command reads to decide its label and whether it applies.
 * Kept in one hook so the palette, the help tab, and the HUD all agree.
 */
export function useCommandContext(): CommandContext {
  const running = useStatusStore((s) => s.running)
  const mockState = useMockStore((s) => s.status.state)
  const mockPaused = useMockStore((s) => s.status.paused)
  const mode = useUiStore((s) => s.mode)
  const hasAnswer = useLlmStore((s) => s.entries.length > 0)
  const hasTranscript = useTranscriptStore(
    (s) => s.segments.length > 0 || Boolean(s.partials.you) || Boolean(s.partials.them),
  )

  return {
    running,
    mockActive: mockState !== 'idle' && mockState !== 'error',
    mockPaused,
    mode,
    hasTranscript,
    hasAnswer,
  }
}
