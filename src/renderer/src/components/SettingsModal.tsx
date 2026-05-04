import { useEffect, useState } from 'react'
import type { PermissionStatus, SettingsStatus } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props): JSX.Element | null {
  const [status, setStatus] = useState<SettingsStatus>({ elevenlabsKeySet: false, groqKeySet: false })
  const [perms, setPerms] = useState<PermissionStatus>({ mic: 'unknown', screen: 'unknown' })
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void window.api.settings.get().then(setStatus)
    void window.api.permissions.status().then(setPerms)
  }, [open])

  if (!open) return null

  const save = async (): Promise<void> => {
    setSaving(true)
    const update: { elevenlabsKey?: string; groqKey?: string } = {}
    if (elevenlabsKey.trim()) update.elevenlabsKey = elevenlabsKey.trim()
    if (groqKey.trim()) update.groqKey = groqKey.trim()
    await window.api.settings.set(update)
    const next = await window.api.settings.get()
    setStatus(next)
    setElevenlabsKey('')
    setGroqKey('')
    setSaving(false)
  }

  const recheckPerms = async (): Promise<void> => setPerms(await window.api.permissions.status())

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <section className="modal-section">
          <h3>API Keys</h3>
          <label>
            <span>ElevenLabs API key {status.elevenlabsKeySet && <em className="set">(saved)</em>}</span>
            <input
              type="password"
              placeholder={status.elevenlabsKeySet ? '•••••••• (paste to replace)' : 'sk_...'}
              value={elevenlabsKey}
              onChange={(e) => setElevenlabsKey(e.target.value)}
            />
          </label>
          <label>
            <span>Groq API key {status.groqKeySet && <em className="set">(saved)</em>}</span>
            <input
              type="password"
              placeholder={status.groqKeySet ? '•••••••• (paste to replace)' : 'gsk_...'}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
            />
          </label>
          <button onClick={save} disabled={saving || (!elevenlabsKey && !groqKey)} className="primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </section>

        <section className="modal-section">
          <h3>Permissions</h3>
          <div className="perm-row">
            <span>Microphone</span>
            <span className={`perm-state perm-${perms.mic}`}>{perms.mic}</span>
            {perms.mic !== 'granted' && (
              <button onClick={() => window.api.permissions.requestMic().then(recheckPerms)}>Request</button>
            )}
          </div>
          <div className="perm-row">
            <span>Screen Recording (system audio)</span>
            <span className={`perm-state perm-${perms.screen}`}>{perms.screen}</span>
            {perms.screen !== 'granted' && (
              <button onClick={() => window.api.permissions.openScreenPrefs()}>Open System Settings</button>
            )}
          </div>
          <button onClick={recheckPerms}>Recheck</button>
        </section>

        <section className="modal-section modal-tip">
          Use headphones. Without them, your microphone picks up the interviewer's audio and pollutes the
          "You" stream.
        </section>
      </div>
    </div>
  )
}
