import type { SocketState } from '@shared/types'
import { useStatusStore } from '../state/status-store'

interface Props {
  compact: boolean
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

  if (props.compact) {
    return (
      <div className="status-bar compact">
        <SocketDot label="You" state={micState} />
        <SocketDot label="Them" state={systemState} />
        <div className="status-spacer" />
        <button onClick={props.onToggleCompact} className="ghost-btn" title="Expand" aria-label="Expand">-</button>
        <button onClick={props.onQuit} className="ghost-btn danger" title="Quit" aria-label="Quit">×</button>
      </div>
    )
  }

  return (
    <div className="status-bar">
      <button onClick={props.onToggleRunning} className={running ? 'status-btn running' : 'status-btn'}>
        {running ? 'Stop' : 'Start'}
      </button>
      <SocketDot label="You" state={micState} />
      <SocketDot label="Them" state={systemState} />
      <div className="status-spacer" />
      <button onClick={props.onClearTranscript} className="ghost-btn" title="Clear transcript">Clear</button>
      <button onClick={props.onOpenHelp} className="ghost-btn" title="Help" aria-label="Help">?</button>
      <button onClick={props.onToggleSettings} className="ghost-btn" title="Settings" aria-label="Settings">⚙</button>
      <button onClick={props.onToggleCompact} className="ghost-btn" title="Minimize" aria-label="Minimize">-</button>
      <button onClick={props.onQuit} className="ghost-btn danger" title="Quit" aria-label="Quit">×</button>
    </div>
  )
}

function SocketDot({ label, state }: { label: string; state: SocketState }): JSX.Element {
  const color = colorForState(state)
  return (
    <div className="socket-dot" title={`${label}: ${state}`}>
      <span className="dot" style={{ backgroundColor: color }} />
      <span className="socket-label">{label}</span>
    </div>
  )
}

function colorForState(state: SocketState): string {
  switch (state) {
    case 'open': return '#3ddc97'
    case 'connecting':
    case 'reconnecting': return '#f0b429'
    case 'auth_error':
    case 'error': return '#e53e3e'
    case 'closed':
    case 'idle': return '#6b7280'
    default: return '#6b7280'
  }
}
