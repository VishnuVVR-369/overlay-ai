import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { AnswerStyleId, PresetId, ReadinessStatus, SettingsStatus } from '@shared/types'
import { usePresetStore, findPreset } from '../state/preset-store'
import { useUiStore } from '../state/ui-store'
import { useAnswerStyleStore } from '../state/answer-style-store'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props): JSX.Element | null {
  const [status, setStatus] = useState<SettingsStatus>({
    elevenlabsKeySet: false,
    groqKeySet: false,
    openaiKeySet: false,
    visionProvider: 'openai',
    visionModel: 'gpt-5.1',
  })
  const perms = useUiStore((s) => s.permStatus)
  const setPermStatus = useUiStore((s) => s.setPermStatus)
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [visionModel, setVisionModel] = useState('gpt-5.1')
  const [saving, setSaving] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null)
  const [checkingReadiness, setCheckingReadiness] = useState(false)

  const activePresetId = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const activeAnswerStyleId = useAnswerStyleStore((s) => s.active)
  const answerStyles = useAnswerStyleStore((s) => s.styles)
  const [editingId, setEditingId] = useState<PresetId | null>(null)
  const [draft, setDraft] = useState('')
  const [presetSaving, setPresetSaving] = useState(false)

  const selectedId = editingId ?? activePresetId
  const selectedPreset = useMemo(() => findPreset(presets, selectedId), [presets, selectedId])

  useEffect(() => {
    if (!open) return
    void window.api.settings.get().then((next) => {
      setStatus(next)
      setVisionModel(next.visionModel)
    })
    void window.api.permissions.status().then(setPermStatus)
    void runReadiness()
  }, [open, setPermStatus])

  useEffect(() => {
    if (!selectedPreset) return
    setDraft(selectedPreset.effectivePrompt)
  }, [selectedPreset?.id, selectedPreset?.effectivePrompt])

  const save = async (): Promise<void> => {
    setSaving(true)
    const update: { elevenlabsKey?: string; groqKey?: string; openaiKey?: string; visionModel?: string } = {}
    if (elevenlabsKey.trim()) update.elevenlabsKey = elevenlabsKey.trim()
    if (groqKey.trim()) update.groqKey = groqKey.trim()
    if (openaiKey.trim()) update.openaiKey = openaiKey.trim()
    if (visionModel.trim() && visionModel.trim() !== status.visionModel) update.visionModel = visionModel.trim()
    await window.api.settings.set(update)
    const next = await window.api.settings.get()
    setStatus(next)
    setElevenlabsKey('')
    setGroqKey('')
    setOpenaiKey('')
    setVisionModel(next.visionModel)
    setSaving(false)
    await runReadiness()
  }

  const recheckPerms = async (): Promise<void> => setPermStatus(await window.api.permissions.status())

  const runReadiness = async (): Promise<void> => {
    setCheckingReadiness(true)
    try {
      setReadiness(await window.api.readiness.check())
    } finally {
      setCheckingReadiness(false)
    }
  }

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

  const setAnswerStyle = async (id: AnswerStyleId): Promise<void> => {
    await window.api.answerStyles.setActive(id)
  }

  if (!open) return null

  return (
    <>
      <div className="slide-over-catcher" onClick={onClose} />
      <aside className="slide-over open" aria-hidden={false}>
        <header className="slide-over-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={1.75} />
          </button>
        </header>
        <div className="slide-over-body">
          <section className="so-section">
            <h3>Readiness</h3>
            <div className="readiness-header">
              <span>{readiness ? `Checked ${formatReadinessTime(readiness.checkedAt)}` : 'Not checked yet'}</span>
              <button className="so-button" onClick={() => void runReadiness()} disabled={checkingReadiness}>
                {checkingReadiness ? 'Checking…' : 'Run Check'}
              </button>
            </div>
            <div className="readiness-list">
              {(readiness?.checks ?? []).map((check) => (
                <div key={check.id} className={`readiness-row readiness-${check.level}`}>
                  <span className="readiness-dot" aria-hidden />
                  <div>
                    <div className="readiness-label">{check.label}</div>
                    <div className="readiness-detail">{check.detail}</div>
                  </div>
                </div>
              ))}
              {!readiness && <div className="readiness-empty">Run a local check before the interview.</div>}
            </div>
          </section>

          <section className="so-section">
            <h3>API Keys</h3>
            <label>
              <span>
                ElevenLabs
                {status.elevenlabsKeySet && <em className="so-set">saved</em>}
              </span>
              <input
                type="password"
                placeholder={status.elevenlabsKeySet ? '•••••• (paste to replace)' : 'sk_…'}
                value={elevenlabsKey}
                onChange={(e) => setElevenlabsKey(e.target.value)}
              />
            </label>
            <label>
              <span>
                Groq
                {status.groqKeySet && <em className="so-set">saved</em>}
              </span>
              <input
                type="password"
                placeholder={status.groqKeySet ? '•••••• (paste to replace)' : 'gsk_…'}
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
              />
            </label>
            <label>
              <span>
                OpenAI
                {status.openaiKeySet && <em className="so-set">saved</em>}
              </span>
              <input
                type="password"
                placeholder={status.openaiKeySet ? '•••••• (paste to replace)' : 'sk-…'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </label>
            <label>
              <span>Vision model</span>
              <input
                type="text"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                placeholder="gpt-5.1"
                spellCheck={false}
              />
            </label>
            <button
              onClick={save}
              disabled={
                saving ||
                (!elevenlabsKey && !groqKey && !openaiKey && visionModel.trim() === status.visionModel)
              }
              className="so-button-primary"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </section>

          <section className="so-section">
            <h3>Interview Mode</h3>
            {answerStyles.length > 0 && (
              <label>
                <span>Answer style</span>
                <select
                  value={activeAnswerStyleId}
                  onChange={(e) => {
                    void setAnswerStyle(e.target.value as AnswerStyleId)
                  }}
                >
                  {answerStyles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="preset-tabs">
              {presets.map((p) => {
                const isActive = p.id === activePresetId
                const isEditing = p.id === selectedId
                return (
                  <button
                    key={p.id}
                    className={`preset-tab ${isEditing ? 'editing' : ''} ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      void setActive(p.id)
                    }}
                    title={isActive ? 'Active preset' : 'Make active'}
                  >
                    {p.label}
                    {p.overridden && <span className="preset-badge">custom</span>}
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
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={10}
                    spellCheck={false}
                  />
                </label>
                <div className="preset-actions">
                  <button
                    className="so-button-primary"
                    onClick={saveOverride}
                    disabled={presetSaving || !draftDirty}
                  >
                    {presetSaving ? 'Saving…' : draftMatchesDefault ? 'Save (clears override)' : 'Save override'}
                  </button>
                  <button
                    className="so-button"
                    onClick={resetOverride}
                    disabled={presetSaving || !selectedPreset.overridden}
                    title="Replace override with built-in default"
                  >
                    Reset to default
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="so-section">
            <h3>Permissions</h3>
            <div className="perm-row">
              <span>Microphone</span>
              <span className={`perm-state perm-${perms.mic}`}>{perms.mic}</span>
              {perms.mic !== 'granted' && (
                <button
                  className="so-button"
                  onClick={() => window.api.permissions.requestMic().then(recheckPerms)}
                >
                  Request
                </button>
              )}
            </div>
            <div className="perm-row">
              <span>Screen Recording</span>
              <span className={`perm-state perm-${perms.screen}`}>{perms.screen}</span>
              {perms.screen !== 'granted' && (
                <button
                  className="so-button"
                  onClick={() => window.api.permissions.openScreenPrefs()}
                >
                  Open System Settings
                </button>
              )}
            </div>
            <button className="so-button" onClick={recheckPerms}>
              Recheck
            </button>
          </section>

          <section className="so-tip">
            Use headphones. Without them, your microphone picks up the interviewer's audio
            and pollutes the “You” stream.
          </section>
        </div>
      </aside>
    </>
  )
}

function formatReadinessTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
