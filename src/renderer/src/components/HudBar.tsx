import { useEffect, useState } from 'react'
import { Command, PanelBottom, Radio, SlidersHorizontal } from 'lucide-react'
import type { SocketState } from '@shared/types'
import { useStatusStore } from '../state/status-store'
import { usePresetStore } from '../state/preset-store'
import { useMockStore } from '../state/mock-store'
import { useLlmStore } from '../state/llm-store'
import { useUiStore } from '../state/ui-store'
import { commandTitle } from '../commands'
import { useCommandContext } from '../hooks/useCommandContext'
import { formatClock, remainingMs } from '../lib/time'

interface Props {
  onToggleListening: () => void
  onOpenPalette: () => void
  onOpenPrompts: () => void
  onOpenSetup: () => void
}

/**
 * The one piece of chrome that is always on screen. It is also the drag handle,
 * so the window stays movable without a separate invisible strip, and it is the
 * only place a mouse-only user needs to look: state on the left, the single
 * primary action and the palette on the right.
 */
export function HudBar({
  onToggleListening,
  onOpenPalette,
  onOpenPrompts,
  onOpenSetup,
}: Props): JSX.Element {
  const ctx = useCommandContext()
  const running = useStatusStore((s) => s.running)
  const startedAt = useStatusStore((s) => s.startedAt)
  const micState = useStatusStore((s) => s.micState)
  const systemState = useStatusStore((s) => s.systemState)
  const mock = useMockStore((s) => s.status)
  const streaming = useLlmStore((s) => s.entries[0]?.status === 'streaming')
  const transcriptOpen = useUiStore((s) => s.transcriptOpen)
  const toggleTranscript = useUiStore((s) => s.toggleTranscript)

  const mockLive = mock.state === 'active' || mock.state === 'paused' || mock.state === 'connecting'
  const clock = useSessionClock(mockLive ? mock.endsAt : startedAt, mockLive)

  const state = mockLive
    ? mock.state === 'connecting'
      ? 'connecting'
      : mock.paused
        ? 'paused'
        : 'mock'
    : running
      ? 'live'
      : 'idle'

  const label = mockLive
    ? mock.state === 'connecting'
      ? 'Connecting'
      : mock.paused
        ? 'Mock paused'
        : 'Mock interview'
    : running
      ? streaming
        ? 'Answering'
        : 'Listening'
      : 'Idle'

  return (
    <header className={`hud-bar hud-${state}`}>
      <div className="hud-drag" aria-hidden />
      <div className="hud-left">
        <span className={`hud-lamp ${streaming ? 'streaming' : ''}`} aria-hidden />
        <span className="hud-state">{label}</span>
        {clock && <span className="hud-clock">{clock}</span>}
        {!mockLive && (
          <span className="hud-signals" title={`You · ${micState} — Them · ${systemState}`}>
            <Signal state={micState} label="You" />
            <Signal state={systemState} label="Them" />
          </span>
        )}
      </div>

      <div className="hud-right">
        <PresetChip onOpenPrompts={onOpenPrompts} />
        {!mockLive && (
          <button
            type="button"
            onClick={onToggleListening}
            className={`hud-listen ${running ? 'on' : ''}`}
            title={commandTitle('listen', ctx)}
          >
            <Radio size={12} strokeWidth={2.25} aria-hidden />
            {running ? 'Stop' : 'Listen'}
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTranscript}
          title={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
          aria-label={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
          aria-pressed={transcriptOpen}
        >
          <PanelBottom size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSetup}
          title={commandTitle('setup', ctx)}
          aria-label="Open console"
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-btn hud-palette"
          onClick={onOpenPalette}
          title="All actions · ⌘K"
          aria-label="Open command palette"
        >
          <Command size={14} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}

/** Elapsed since `anchor`, or remaining until it when `countdown` is set. */
function useSessionClock(anchor: number | null | undefined, countdown: boolean): string | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (typeof anchor !== 'number') return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [anchor])

  if (typeof anchor !== 'number') return null
  if (countdown) {
    const left = remainingMs(anchor, now)
    return left === null ? null : formatClock(left)
  }
  return formatClock(Math.max(0, now - anchor))
}

function PresetChip({ onOpenPrompts }: { onOpenPrompts: () => void }): JSX.Element | null {
  const active = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const hydrated = usePresetStore((s) => s.hydrated)

  if (!hydrated || presets.length === 0) return null
  const current = presets.find((p) => p.id === active)
  if (!current) return null

  return (
    <button type="button" className="hud-preset" onClick={onOpenPrompts} title="Interview mode & prompts">
      {current.label}
    </button>
  )
}

function Signal({ state, label }: { state: SocketState; label: string }): JSX.Element {
  return (
    <span className={`signal signal-${signalTone(state)}`} title={`${label} · ${state}`}>
      <span className="signal-dot" />
    </span>
  )
}

function signalTone(state: SocketState): 'ok' | 'pending' | 'bad' | 'off' {
  switch (state) {
    case 'open':
      return 'ok'
    case 'connecting':
    case 'reconnecting':
      return 'pending'
    case 'auth_error':
    case 'error':
      return 'bad'
    default:
      return 'off'
  }
}
