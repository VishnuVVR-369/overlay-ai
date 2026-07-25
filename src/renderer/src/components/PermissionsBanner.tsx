import { AlertTriangle } from 'lucide-react'
import { useUiStore } from '../state/ui-store'

interface Props {
  onRecheck: () => void
}

export function PermissionsBanner({ onRecheck }: Props): JSX.Element | null {
  const perms = useUiStore((s) => s.permStatus)

  const micMissing = perms.mic !== 'granted' && perms.mic !== 'unknown'
  const screenMissing = perms.screen !== 'granted' && perms.screen !== 'unknown'

  if (!micMissing && !screenMissing) return null

  const label = micMissing && screenMissing
    ? 'Microphone & screen access needed'
    : micMissing
      ? 'Microphone access needed'
      : 'Screen recording access needed'

  const grant = async (): Promise<void> => {
    if (micMissing) {
      await window.api.permissions.requestMic()
    }
    if (screenMissing) {
      await window.api.permissions.openScreenPrefs()
    }
    onRecheck()
  }

  return (
    <div className="perm-banner" role="status">
      <AlertTriangle size={12} strokeWidth={1.75} aria-hidden />
      <span className="perm-banner-text">{label}</span>
      <div className="perm-banner-actions">
        <button type="button" onClick={() => void grant()}>
          Grant
        </button>
      </div>
    </div>
  )
}
