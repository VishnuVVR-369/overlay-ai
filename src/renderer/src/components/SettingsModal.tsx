import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { AnswerStyleId, PresetId, ReadinessStatus, SettingsStatus, VaultData, VaultStory } from '@shared/types'
import { usePresetStore, findPreset } from '../state/preset-store'
import { useUiStore } from '../state/ui-store'
import { useAnswerStyleStore } from '../state/answer-style-store'
import { useVaultStore, emptyVault } from '../state/vault-store'

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
    headlineFirst: true,
    vault: {
      hasResume: false,
      hasJobDescription: false,
      hasCompanyValues: false,
      hasInterviewerNotes: false,
      storiesCount: 0,
    },
  })
  const perms = useUiStore((s) => s.permStatus)
  const setPermStatus = useUiStore((s) => s.setPermStatus)
  const headlineFirst = useUiStore((s) => s.headlineFirst)
  const setHeadlineFirst = useUiStore((s) => s.setHeadlineFirst)
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

  const hydratedVault = useVaultStore((s) => s.data)
  const setVaultState = useVaultStore((s) => s.setState)
  const [vaultDraft, setVaultDraft] = useState<VaultData>(emptyVault())
  const [vaultSaving, setVaultSaving] = useState(false)

  const selectedId = editingId ?? activePresetId
  const selectedPreset = useMemo(() => findPreset(presets, selectedId), [presets, selectedId])

  useEffect(() => {
    if (!open) return
    void window.api.settings.get().then((next) => {
      setStatus(next)
      setVisionModel(next.visionModel)
      setHeadlineFirst(next.headlineFirst)
    })
    void window.api.vault.get().then((v) => {
      setVaultDraft(v)
      setVaultState(v)
    })
    void window.api.permissions.status().then(setPermStatus)
    void runReadiness()
  }, [open, setPermStatus, setHeadlineFirst, setVaultState])

  useEffect(() => {
    if (!open) return
    setVaultDraft(hydratedVault)
  }, [open, hydratedVault])

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

  const toggleHeadlineFirst = async (next: boolean): Promise<void> => {
    setHeadlineFirst(next)
    setStatus((s) => ({ ...s, headlineFirst: next }))
    await window.api.settings.set({ headlineFirst: next })
  }

  const updateVaultField = (key: keyof Omit<VaultData, 'stories'>, value: string): void => {
    setVaultDraft((v) => ({ ...v, [key]: value }))
  }

  const updateStory = (index: number, patch: Partial<VaultStory>): void => {
    setVaultDraft((v) => {
      const next = v.stories.map((s, i) => (i === index ? { ...s, ...patch } : s))
      return { ...v, stories: next }
    })
  }

  const addStory = (): void => {
    setVaultDraft((v) => ({
      ...v,
      stories: [...v.stories, { id: makeStoryId(), title: '', body: '' }],
    }))
  }

  const removeStory = (index: number): void => {
    setVaultDraft((v) => ({ ...v, stories: v.stories.filter((_, i) => i !== index) }))
  }

  const vaultDirty = useMemo(() => vaultEquals(vaultDraft, hydratedVault) === false, [vaultDraft, hydratedVault])

  const saveVault = async (): Promise<void> => {
    setVaultSaving(true)
    try {
      await window.api.vault.set(vaultDraft)
    } finally {
      setVaultSaving(false)
    }
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
            <h3>Personal Context</h3>
            <p className="so-hint">
              Pasted here so the model never has to invent details about you. Stored locally,
              encrypted at rest, and injected into every transcript and screen ask.
            </p>
            <label>
              <span>Resume / background</span>
              <textarea
                value={vaultDraft.resume}
                onChange={(e) => updateVaultField('resume', e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="Paste a short resume summary or the highest-signal bullets."
              />
            </label>
            <label>
              <span>Role / job description</span>
              <textarea
                value={vaultDraft.jobDescription}
                onChange={(e) => updateVaultField('jobDescription', e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="Paste the JD or your understanding of the role."
              />
            </label>
            <label>
              <span>Company values</span>
              <textarea
                value={vaultDraft.companyValues}
                onChange={(e) => updateVaultField('companyValues', e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="Leadership principles, mission, recent news, customer focus."
              />
            </label>
            <label>
              <span>Interviewer notes</span>
              <textarea
                value={vaultDraft.interviewerNotes}
                onChange={(e) => updateVaultField('interviewerNotes', e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="Names, backgrounds, what they usually ask."
              />
            </label>
            <div className="vault-stories">
              <div className="vault-stories-header">
                <span>STAR stories</span>
                <button className="so-button" type="button" onClick={addStory}>+ Add story</button>
              </div>
              {vaultDraft.stories.length === 0 && (
                <div className="vault-stories-empty">
                  No stories yet. Add the 4–6 stories you reach for most often.
                </div>
              )}
              {vaultDraft.stories.map((story, idx) => (
                <div key={story.id} className="vault-story">
                  <input
                    type="text"
                    value={story.title}
                    onChange={(e) => updateStory(idx, { title: e.target.value })}
                    placeholder="Short title (e.g. Stripe payments migration)"
                    aria-label={`Story ${idx + 1} title`}
                  />
                  <textarea
                    value={story.body}
                    onChange={(e) => updateStory(idx, { body: e.target.value })}
                    rows={3}
                    spellCheck={false}
                    placeholder="Situation, task, action, result — terse bullets are fine."
                    aria-label={`Story ${idx + 1} body`}
                  />
                  <button
                    className="so-button"
                    type="button"
                    onClick={() => removeStory(idx)}
                    aria-label={`Remove story ${idx + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="so-button-primary"
              onClick={saveVault}
              disabled={vaultSaving || !vaultDirty}
            >
              {vaultSaving ? 'Saving…' : 'Save personal context'}
            </button>
          </section>

          <section className="so-section">
            <h3>Interview Mode</h3>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={headlineFirst}
                onChange={(e) => { void toggleHeadlineFirst(e.target.checked) }}
                aria-label="Headline-first answers"
              />
              <span>Headline-first answers (lead with one bold speakable sentence)</span>
            </label>
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

function makeStoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function vaultEquals(a: VaultData, b: VaultData): boolean {
  if (a.resume !== b.resume) return false
  if (a.jobDescription !== b.jobDescription) return false
  if (a.companyValues !== b.companyValues) return false
  if (a.interviewerNotes !== b.interviewerNotes) return false
  if (a.stories.length !== b.stories.length) return false
  for (let i = 0; i < a.stories.length; i++) {
    const x = a.stories[i]
    const y = b.stories[i]
    if (x.id !== y.id || x.title !== y.title || x.body !== y.body) return false
  }
  return true
}
