import { useEffect, useMemo, useState } from 'react'
import type { PermissionStatus, PresetId, SettingsStatus } from '@shared/types'
import { usePresetStore, findPreset } from '../state/preset-store'

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

  const activePresetId = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const [editingId, setEditingId] = useState<PresetId | null>(null)
  const [draft, setDraft] = useState('')
  const [presetSaving, setPresetSaving] = useState(false)

  const selectedId = editingId ?? activePresetId
  const selectedPreset = useMemo(() => findPreset(presets, selectedId), [presets, selectedId])

  useEffect(() => {
    if (!open) return
    void window.api.settings.get().then(setStatus)
    void window.api.permissions.status().then(setPerms)
  }, [open])

  useEffect(() => {
    if (!selectedPreset) return
    setDraft(selectedPreset.effectivePrompt)
  }, [selectedPreset?.id, selectedPreset?.effectivePrompt])

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

  const draftDirty = !!selectedPreset && draft !== selectedPreset.effectivePrompt
  const draftMatchesDefault = !!selectedPreset && draft.trim() === selectedPreset.defaultPrompt.trim()

  const saveOverride = async (): Promise<void> => {
    if (!selectedPreset) return
    setPresetSaving(true)
    const prompt = draftMatchesDefault ? null : draft
    await window.api.presets.setOverride({ id: selectedPreset.id, prompt })
    setPresetSaving(false)
  }

  const resetOverride = async (): Promise<void> => {
    if (!selectedPreset) return
    setPresetSaving(true)
    await window.api.presets.setOverride({ id: selectedPreset.id, prompt: null })
    setPresetSaving(false)
  }

  const setActive = async (id: PresetId): Promise<void> => {
    setEditingId(id)
    await window.api.presets.setActive(id)
  }

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
          <h3>Interview Mode</h3>
          <div className="preset-tabs">
            {presets.map((p) => {
              const isActive = p.id === activePresetId
              const isEditing = p.id === selectedId
              return (
                <button
                  key={p.id}
                  className={`preset-tab ${isEditing ? 'editing' : ''} ${isActive ? 'active' : ''}`}
                  onClick={() => { void setActive(p.id) }}
                  title={isActive ? 'Active preset' : 'Make active'}
                >
                  {p.label}
                  {p.overridden && <span className="preset-badge" title="Custom prompt">custom</span>}
                  {isActive && <span className="preset-active-dot" aria-hidden />}
                </button>
              )
            })}
          </div>
          {selectedPreset && (
            <>
              <label>
                <span>System prompt for {selectedPreset.label}</span>
                <textarea
                  className="preset-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  spellCheck={false}
                />
              </label>
              <div className="preset-actions">
                <button
                  className="primary"
                  onClick={saveOverride}
                  disabled={presetSaving || !draftDirty}
                >
                  {presetSaving ? 'Saving…' : draftMatchesDefault ? 'Save (clears override)' : 'Save override'}
                </button>
                <button
                  onClick={resetOverride}
                  disabled={presetSaving || !selectedPreset.overridden}
                  title="Replace your override with the built-in default prompt"
                >
                  Reset to default
                </button>
              </div>
            </>
          )}
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
