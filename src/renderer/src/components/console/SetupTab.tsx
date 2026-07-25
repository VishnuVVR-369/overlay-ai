import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ReadinessStatus, SettingsStatus } from '@shared/types'
import { useUiStore } from '../../state/ui-store'

const EMPTY_STATUS: SettingsStatus = {
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
}

export function SetupTab(): JSX.Element {
  const [status, setStatus] = useState<SettingsStatus>(EMPTY_STATUS)
  const [elevenlabsKey, setElevenlabsKey] = useState('')
  const [groqKey, setGroqKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [visionModel, setVisionModel] = useState(EMPTY_STATUS.visionModel)
  const [saving, setSaving] = useState(false)
  const [readiness, setReadiness] = useState<ReadinessStatus | null>(null)
  const [checking, setChecking] = useState(false)

  const perms = useUiStore((s) => s.permStatus)
  const setPermStatus = useUiStore((s) => s.setPermStatus)
  const setHeadlineFirst = useUiStore((s) => s.setHeadlineFirst)

  const runReadiness = useCallback(async (): Promise<void> => {
    setChecking(true)
    try {
      setReadiness(await window.api.readiness.check())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void window.api.settings.get().then((next) => {
      setStatus(next)
      setVisionModel(next.visionModel)
      setHeadlineFirst(next.headlineFirst)
    })
    void window.api.permissions.status().then(setPermStatus)
    void runReadiness()
  }, [runReadiness, setHeadlineFirst, setPermStatus])

  const recheckPerms = useCallback(async (): Promise<void> => {
    setPermStatus(await window.api.permissions.status())
  }, [setPermStatus])

  const dirty =
    Boolean(elevenlabsKey || groqKey || openaiKey) || visionModel.trim() !== status.visionModel

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const update: Record<string, string> = {}
      if (elevenlabsKey.trim()) update.elevenlabsKey = elevenlabsKey.trim()
      if (groqKey.trim()) update.groqKey = groqKey.trim()
      if (openaiKey.trim()) update.openaiKey = openaiKey.trim()
      if (visionModel.trim() && visionModel.trim() !== status.visionModel) {
        update.visionModel = visionModel.trim()
      }
      const result = await window.api.settings.set(update)
      if (!result.ok) return
      const next = await window.api.settings.get()
      setStatus(next)
      setElevenlabsKey('')
      setGroqKey('')
      setOpenaiKey('')
      setVisionModel(next.visionModel)
    } finally {
      setSaving(false)
    }
    await runReadiness()
  }

  const blocking = (readiness?.checks ?? []).filter((c) => c.level === 'fail').length

  return (
    <>
      <section className="pane">
        <div className="pane-head">
          <h3>Readiness</h3>
          <button className="btn btn-quiet" onClick={() => void runReadiness()} disabled={checking}>
            <RefreshCw size={12} strokeWidth={2} className={checking ? 'spin' : undefined} />
            {checking ? 'Checking' : 'Recheck'}
          </button>
        </div>
        <p className="pane-lede">
          {readiness === null
            ? 'Running a local check…'
            : blocking === 0
              ? 'Everything needed for a live interview is in place.'
              : `${blocking} ${blocking === 1 ? 'thing is' : 'things are'} blocking a live interview.`}
        </p>
        <div className="check-list">
          {(readiness?.checks ?? []).map((check) => (
            <div key={check.id} className={`check check-${check.level}`}>
              <span className="check-dot" aria-hidden />
              <div className="check-body">
                <div className="check-label">{check.label}</div>
                <div className="check-detail">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pane">
        <h3>API keys</h3>
        <p className="pane-lede">Encrypted with the OS keychain and never sent anywhere but their own provider.</p>
        <KeyField
          label="ElevenLabs"
          note="Realtime transcription"
          saved={status.elevenlabsKeySet}
          placeholder="sk_…"
          value={elevenlabsKey}
          onChange={setElevenlabsKey}
        />
        <KeyField
          label="Groq"
          note="Transcript answers"
          saved={status.groqKeySet}
          placeholder="gsk_…"
          value={groqKey}
          onChange={setGroqKey}
        />
        <KeyField
          label="OpenAI"
          note="Screen ask and mock interviews"
          saved={status.openaiKeySet}
          placeholder="sk-…"
          value={openaiKey}
          onChange={setOpenaiKey}
        />
        <label className="field">
          <span className="field-label">Vision model</span>
          <input
            type="text"
            value={visionModel}
            onChange={(e) => setVisionModel(e.target.value)}
            placeholder="gpt-5.1"
            spellCheck={false}
          />
        </label>
        <button onClick={() => void save()} disabled={saving || !dirty} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save keys'}
        </button>
      </section>

      <section className="pane">
        <h3>Permissions</h3>
        <p className="pane-lede">
          Microphone captures you; screen recording captures the interviewer’s audio and powers screen ask.
        </p>
        <div className="perm-row">
          <span className="perm-name">Microphone</span>
          <span className={`pill perm-${perms.mic}`}>{perms.mic}</span>
          {perms.mic !== 'granted' && (
            <button
              className="btn btn-quiet"
              onClick={() => void window.api.permissions.requestMic().then(recheckPerms)}
            >
              Request
            </button>
          )}
        </div>
        <div className="perm-row">
          <span className="perm-name">Screen recording</span>
          <span className={`pill perm-${perms.screen}`}>{perms.screen}</span>
          {perms.screen !== 'granted' && (
            <button className="btn btn-quiet" onClick={() => void window.api.permissions.openScreenPrefs()}>
              Open settings
            </button>
          )}
        </div>
        <button className="btn btn-quiet self-start" onClick={() => void recheckPerms()}>
          Recheck permissions
        </button>
      </section>

      <p className="pane-note">
        Wear headphones. Without them your microphone picks the interviewer up off your speakers and both
        sides land in the “You” stream.
      </p>
    </>
  )
}

function KeyField({
  label,
  note,
  saved,
  placeholder,
  value,
  onChange,
}: {
  label: string
  note: string
  saved: boolean
  placeholder: string
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        <span className="field-note">{note}</span>
        {saved && <span className="pill pill-ok">saved</span>}
      </span>
      <input
        type="password"
        placeholder={saved ? '•••••••••  paste to replace' : placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
