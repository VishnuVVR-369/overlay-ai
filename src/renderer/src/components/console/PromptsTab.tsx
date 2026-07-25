import { useMemo, useState } from 'react'
import type { AnswerStyleId, PresetId } from '@shared/types'
import { usePresetStore, findPreset } from '../../state/preset-store'
import { useAnswerStyleStore } from '../../state/answer-style-store'
import { useUiStore } from '../../state/ui-store'

export function PromptsTab(): JSX.Element {
  const activePresetId = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const activeStyleId = useAnswerStyleStore((s) => s.active)
  const styles = useAnswerStyleStore((s) => s.styles)
  const headlineFirst = useUiStore((s) => s.headlineFirst)
  const setHeadlineFirst = useUiStore((s) => s.setHeadlineFirst)

  const drafts = usePresetStore((s) => s.drafts)
  const setPresetDraft = usePresetStore((s) => s.setDraft)
  const clearPresetDraft = usePresetStore((s) => s.clearDraft)

  const [editingId, setEditingId] = useState<PresetId | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedId = editingId ?? activePresetId
  const selected = useMemo(() => findPreset(presets, selectedId), [presets, selectedId])

  const draft = selected ? (drafts[selected.id] ?? selected.effectivePrompt) : ''

  const dirty = !!selected && draft !== selected.effectivePrompt
  const matchesDefault = !!selected && draft.trim() === selected.defaultPrompt.trim()

  const saveOverride = async (): Promise<void> => {
    if (!selected) return
    setSaving(true)
    try {
      await window.api.presets.setOverride({ id: selected.id, prompt: matchesDefault ? null : draft })
      clearPresetDraft(selected.id)
    } finally {
      setSaving(false)
    }
  }

  const resetOverride = async (): Promise<void> => {
    if (!selected) return
    setSaving(true)
    try {
      await window.api.presets.setOverride({ id: selected.id, prompt: null })
      clearPresetDraft(selected.id)
    } finally {
      setSaving(false)
    }
  }

  const toggleHeadline = async (next: boolean): Promise<void> => {
    setHeadlineFirst(next)
    await window.api.settings.set({ headlineFirst: next })
  }

  return (
    <>
      <section className="pane">
        <h3>Interview mode</h3>
        <p className="pane-lede">
          Sets the system prompt behind every answer. Whatever is selected here is what{' '}
          <kbd>⌘</kbd>
          <kbd>\</kbd> uses.
        </p>
        <div className="mode-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`mode-card ${preset.id === activePresetId ? 'active' : ''}`}
              onClick={() => {
                setEditingId(preset.id)
                void window.api.presets.setActive(preset.id)
              }}
              aria-pressed={preset.id === activePresetId}
            >
              <span className="mode-card-label">{preset.label}</span>
              {preset.overridden && <span className="pill pill-warn">custom</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="pane">
        <h3>Answer shape</h3>
        <label className="switch">
          <input
            type="checkbox"
            checked={headlineFirst}
            onChange={(e) => void toggleHeadline(e.target.checked)}
            aria-label="Headline-first answers"
          />
          <span>
            <strong>Headline first</strong>
            <span className="switch-note">
              Lead with one bold sentence you can say out loud immediately, then the detail.
            </span>
          </span>
        </label>
        {styles.length > 0 && (
          <label className="field">
            <span className="field-label">
              Answer style
              <span className="field-note">Layered on top of the interview mode</span>
            </span>
            <select
              value={activeStyleId}
              onChange={(e) => void window.api.answerStyles.setActive(e.target.value as AnswerStyleId)}
            >
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selected && (
        <section className="pane">
          <div className="pane-head">
            <h3>System prompt · {selected.label}</h3>
            {selected.overridden && <span className="pill pill-warn">custom</span>}
          </div>
          <textarea
            className="prompt-editor"
            value={draft}
            onChange={(e) => setPresetDraft(selected.id, e.target.value)}
            rows={12}
            spellCheck={false}
            aria-label={`System prompt for ${selected.label}`}
          />
          <div className="pane-actions">
            <button className="btn btn-primary" onClick={() => void saveOverride()} disabled={saving || !dirty}>
              {saving ? 'Saving…' : matchesDefault ? 'Save (clears override)' : 'Save override'}
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => void resetOverride()}
              disabled={saving || !selected.overridden}
              title="Replace the override with the built-in default"
            >
              Reset to default
            </button>
          </div>
        </section>
      )}
    </>
  )
}
