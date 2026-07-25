import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { VaultData, VaultStory } from '@shared/types'
import { useVaultStore, emptyVault } from '../../state/vault-store'

const FIELDS: Array<{
  key: keyof Omit<VaultData, 'stories'>
  label: string
  note: string
  placeholder: string
  rows: number
}> = [
  {
    key: 'resume',
    label: 'Resume / background',
    note: 'So the model never invents your history',
    placeholder: 'Paste a short resume summary or your highest-signal bullets.',
    rows: 5,
  },
  {
    key: 'jobDescription',
    label: 'Role / job description',
    note: 'Anchors answers to what they are hiring for',
    placeholder: 'Paste the JD, or your own understanding of the role.',
    rows: 4,
  },
  {
    key: 'companyValues',
    label: 'Company values',
    note: 'Leadership principles, mission, recent news',
    placeholder: 'What this company says it cares about.',
    rows: 3,
  },
  {
    key: 'interviewerNotes',
    label: 'Interviewer notes',
    note: 'Who is in the room',
    placeholder: 'Names, backgrounds, what they usually ask.',
    rows: 3,
  },
]

export function ContextTab(): JSX.Element {
  const hydrated = useVaultStore((s) => s.data)
  const setVaultState = useVaultStore((s) => s.setState)
  const [draft, setDraft] = useState<VaultData>(emptyVault())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void window.api.vault.get().then((value) => {
      setDraft(value)
      setVaultState(value)
    })
  }, [setVaultState])

  useEffect(() => {
    setDraft(hydrated)
  }, [hydrated])

  const dirty = useMemo(() => !vaultEquals(draft, hydrated), [draft, hydrated])

  const updateField = (key: keyof Omit<VaultData, 'stories'>, value: string): void => {
    setDraft((v) => ({ ...v, [key]: value }))
  }

  const updateStory = (index: number, patch: Partial<VaultStory>): void => {
    setDraft((v) => ({ ...v, stories: v.stories.map((s, i) => (i === index ? { ...s, ...patch } : s)) }))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.vault.set(draft)
    } finally {
      setSaving(false)
    }
  }

  const filled = FIELDS.filter((f) => draft[f.key].trim().length > 0).length

  return (
    <>
      <section className="pane">
        <h3>Personal context</h3>
        <p className="pane-lede">
          Injected into every transcript and screen ask so answers use your real history instead of
          plausible fiction. Stored locally and encrypted at rest.
        </p>
        <div className="context-progress">
          <span>
            {filled} of {FIELDS.length} sections filled · {draft.stories.length}{' '}
            {draft.stories.length === 1 ? 'story' : 'stories'}
          </span>
        </div>
      </section>

      <section className="pane">
        {FIELDS.map((field) => (
          <label className="field" key={field.key}>
            <span className="field-label">
              {field.label}
              <span className="field-note">{field.note}</span>
            </span>
            <textarea
              value={draft[field.key]}
              onChange={(e) => updateField(field.key, e.target.value)}
              rows={field.rows}
              spellCheck={false}
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </section>

      <section className="pane">
        <div className="pane-head">
          <h3>STAR stories</h3>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() =>
              setDraft((v) => ({ ...v, stories: [...v.stories, { id: makeStoryId(), title: '', body: '' }] }))
            }
          >
            <Plus size={12} strokeWidth={2} />
            Add
          </button>
        </div>
        {draft.stories.length === 0 ? (
          <div className="empty-box">
            No stories yet. Add the four to six you reach for most often — the model will pick the one
            that fits the question instead of inventing a new one.
          </div>
        ) : (
          draft.stories.map((story, idx) => (
            <div key={story.id} className="story">
              <div className="story-head">
                <input
                  type="text"
                  value={story.title}
                  onChange={(e) => updateStory(idx, { title: e.target.value })}
                  placeholder="Short title, e.g. Stripe payments migration"
                  aria-label={`Story ${idx + 1} title`}
                />
                <button
                  className="icon-btn danger"
                  type="button"
                  onClick={() => setDraft((v) => ({ ...v, stories: v.stories.filter((_, i) => i !== idx) }))}
                  aria-label={`Remove story ${idx + 1}`}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </div>
              <textarea
                value={story.body}
                onChange={(e) => updateStory(idx, { body: e.target.value })}
                rows={3}
                spellCheck={false}
                placeholder="Situation, task, action, result — terse bullets are fine."
                aria-label={`Story ${idx + 1} body`}
              />
            </div>
          ))
        )}
      </section>

      <div className="pane-actions">
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Saving…' : dirty ? 'Save personal context' : 'Saved'}
        </button>
      </div>
    </>
  )
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
