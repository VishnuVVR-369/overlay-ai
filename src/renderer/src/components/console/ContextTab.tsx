import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { VaultData, VaultStory } from '@shared/types'
import {
  useVaultStore,
  emptyVault,
  validateVault,
  vaultEquals,
  type VaultIssue,
} from '../../state/vault-store'

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)
  const draft = storedDraft ?? emptyVault()

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    void window.api.vault.get().then(
      (value) => {
        if (!cancelled) setVaultState(value)
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(describeError(err))
      },
    )
    return () => {
      cancelled = true
    }
  }, [reloadCount, setVaultState])

  useEffect(() => {
    if (hydrated && storedDraft === null) setStoredDraft(stored)
  }, [hydrated, setStoredDraft, stored, storedDraft])

  const dirty = useMemo(() => !vaultEquals(draft, stored), [draft, stored])
  const validation = useMemo(() => validateVault(draft), [draft])

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
    if (!validation.ok) return
    const submitted = draft
    setSaving(true)
    setSaveError(null)
    try {
      const result = await window.api.vault.set(submitted)
      if (!result.ok) {
        setSaveError('Could not save your context. Your edits are still here — try again.')
        return
      }
      const persisted = await window.api.vault.get()
      setVaultState(persisted)
      const current = useVaultStore.getState().draft
      if (current === null || vaultEquals(current, submitted)) setStoredDraft(persisted)
    } catch (err) {
      setSaveError(`Could not save your context. Your edits are still here. ${describeError(err)}`)
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
        {loadError === null ? (
          <div className="empty-box">Loading your saved context…</div>
        ) : (
          <>
            <div className="inline-error">
              Could not load your saved context, so editing is disabled to avoid overwriting it.{' '}
              {loadError}
            </div>
            <div className="pane-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setReloadCount((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          </>
        )}
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
              aria-invalid={validation.fields[field.key] ? true : undefined}
            />
            {validation.fields[field.key] && (
              <span className="field-error">{issueMessage(validation.fields[field.key]!)}</span>
            )}
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
            <div key={story.id} className={`story ${validation.stories[idx] ? 'story-invalid' : ''}`}>
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
              {validation.stories[idx] && (
                <span className="field-error">{issueMessage(validation.stories[idx])}</span>
              )}
            </div>
          ))
        )}
      </section>

      {saveError !== null && <div className="inline-error">{saveError}</div>}

      <div className="pane-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving || !dirty || !validation.ok}
        >
          {saving ? 'Saving…' : dirty ? 'Save personal context' : 'Saved'}
        </button>
        {!validation.ok && (
          <span className="pane-meta">
            Finish or remove the flagged entries above — saving now would drop them.
          </span>
        )}
      </div>
    </>
  )
}

function issueMessage(issue: VaultIssue): string {
  switch (issue.kind) {
    case 'missing-title':
      return 'Needs a title before it can be saved — add one or remove the story.'
    case 'missing-body':
      return 'Needs a body before it can be saved — add one or remove the story.'
    case 'title-too-long':
      return `Title is ${issue.length} characters; only the first ${issue.limit} are saved.`
    case 'body-too-long':
      return `Body is ${issue.length} characters; only the first ${issue.limit} are saved.`
    case 'over-story-limit':
      return `Only the first ${issue.limit} stories are saved — remove one before saving.`
    case 'too-long':
      return `${issue.length} characters; only the first ${issue.limit} are saved. Trim it first.`
  }
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.trim().length > 0 ? message : 'Unknown error.'
}

function makeStoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
