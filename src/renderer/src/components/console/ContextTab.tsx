import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { VaultData, VaultStory } from '@shared/types'
import { useVaultStore, emptyVault, vaultEquals } from '../../state/vault-store'

const LEDE =
  'Injected into every transcript and screen ask so answers use your real history instead of plausible fiction. Stored locally and encrypted at rest.'

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
  const stored = useVaultStore((s) => s.data)
  const hydrated = useVaultStore((s) => s.hydrated)
  const storedDraft = useVaultStore((s) => s.draft)
  const setVaultState = useVaultStore((s) => s.setState)
  const setStoredDraft = useVaultStore((s) => s.setDraft)
  const [saving, setSaving] = useState(false)
  const draft = storedDraft ?? emptyVault()

  useEffect(() => {
    void window.api.vault.get().then((value) => {
      setVaultState(value)
    })
  }, [setVaultState])

  useEffect(() => {
    if (hydrated && storedDraft === null) setStoredDraft(stored)
  }, [hydrated, setStoredDraft, stored, storedDraft])

  const dirty = useMemo(() => !vaultEquals(draft, stored), [draft, stored])

  const updateField = (key: keyof Omit<VaultData, 'stories'>, value: string): void => {
    setStoredDraft({ ...draft, [key]: value })
  }

  const updateStory = (index: number, patch: Partial<VaultStory>): void => {
    setStoredDraft({
      ...draft,
      stories: draft.stories.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const result = await window.api.vault.set(draft)
      if (!result.ok) return
      const persisted = await window.api.vault.get()
      setVaultState(persisted)
      setStoredDraft(persisted)
    } finally {
      setSaving(false)
    }
  }

  const filled = FIELDS.filter((f) => draft[f.key].trim().length > 0).length

  if (!hydrated || storedDraft === null) {
    return (
      <section className="pane">
        <h3>Personal context</h3>
        <p className="pane-lede">{LEDE}</p>
        <div className="empty-box">Loading your saved context…</div>
      </section>
    )
  }

  return (
    <>
      <section className="pane">
        <h3>Personal context</h3>
        <p className="pane-lede">{LEDE}</p>
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
              setStoredDraft({
                ...draft,
                stories: [...draft.stories, { id: makeStoryId(), title: '', body: '' }],
              })
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
                  onClick={() =>
                    setStoredDraft({
                      ...draft,
                      stories: draft.stories.filter((_, i) => i !== idx),
                    })
                  }
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
