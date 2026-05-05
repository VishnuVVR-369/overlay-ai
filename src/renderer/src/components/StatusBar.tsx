import { useState } from 'react'
import { Eraser, HelpCircle, Settings, Minus, Power } from 'lucide-react'
import type { PresetId, SocketState } from '@shared/types'
import { useStatusStore } from '../state/status-store'
import { usePresetStore } from '../state/preset-store'

interface Props {
  onToggleSettings: () => void
  onToggleRunning: () => void
  onClearTranscript: () => void
  onOpenHelp: () => void
  onToggleCompact: () => void
  onQuit: () => void
}

export function StatusBar(props: Props): JSX.Element {
  const running = useStatusStore((s) => s.running)
  const micState = useStatusStore((s) => s.micState)
  const systemState = useStatusStore((s) => s.systemState)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`status-bar ${hovered ? 'expanded' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="status-bar-quiet">
        <SocketDot state={micState} title={`You · ${micState}`} />
        <SocketDot state={systemState} title={`Them · ${systemState}`} />
        <PresetChip />
      </div>
      <div className="status-bar-controls">
        <button
          onClick={props.onToggleRunning}
          className={running ? 'status-btn running' : 'status-btn'}
          title={running ? 'Stop listening (Space)' : 'Start listening (Space)'}
        >
          {running ? 'Stop' : 'Start'}
        </button>
        <button
          onClick={props.onClearTranscript}
          className="icon-btn"
          title="Clear transcript (C)"
          aria-label="Clear transcript"
        >
          <Eraser size={13} strokeWidth={1.75} />
        </button>
        <button
          onClick={props.onOpenHelp}
          className="icon-btn"
          title="Help (?)"
          aria-label="Help"
        >
          <HelpCircle size={13} strokeWidth={1.75} />
        </button>
        <button
          onClick={props.onToggleSettings}
          className="icon-btn"
          title="Settings (S)"
          aria-label="Settings"
        >
          <Settings size={13} strokeWidth={1.75} />
        </button>
        <button
          onClick={props.onToggleCompact}
          className="icon-btn"
          title="Compact (-)"
          aria-label="Compact"
        >
          <Minus size={13} strokeWidth={1.75} />
        </button>
        <button
          onClick={props.onQuit}
          className="icon-btn danger"
          title="Quit (Q)"
          aria-label="Quit"
        >
          <Power size={13} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

function PresetChip(): JSX.Element | null {
  const active = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const hydrated = usePresetStore((s) => s.hydrated)

  if (!hydrated || presets.length === 0) return null

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    void window.api.presets.setActive(e.target.value as PresetId)
  }

  return (
    <select
      className="preset-select"
      value={active}
      onChange={onChange}
      title="Interview mode"
      aria-label="Interview mode"
    >
      {presets.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
          {p.overridden ? ' •' : ''}
        </option>
      ))}
    </select>
  )
}

function SocketDot({ state, title }: { state: SocketState; title: string }): JSX.Element {
  return (
    <span className="socket-dot" title={title}>
      <span className="dot" style={{ backgroundColor: colorForState(state) }} />
    </span>
  )
}

function colorForState(state: SocketState): string {
  switch (state) {
    case 'open':
      return '#8fcfb3'
    case 'connecting':
    case 'reconnecting':
      return '#e6c068'
    case 'auth_error':
    case 'error':
      return '#d97a7a'
    case 'closed':
    case 'idle':
    default:
      return '#3a3f47'
  }
}
