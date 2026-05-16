import { useState } from 'react'
import { X } from 'lucide-react'
import type { MockInterviewConfig, PresetId } from '@shared/types'
import { usePresetStore } from '../state/preset-store'

interface Props {
  open: boolean
  starting: boolean
  onClose: () => void
  onStart: (config: MockInterviewConfig) => void
}

const DURATIONS = [15, 30, 45, 60] as const

export function MockInterviewPanel({ open, starting, onClose, onStart }: Props): JSX.Element | null {
  const activePreset = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const [presetId, setPresetId] = useState<PresetId>(activePreset)
  const [durationMinutes, setDurationMinutes] = useState<15 | 30 | 45 | 60>(30)

  if (!open) return null

  return (
    <>
      <div className="slide-over-catcher" onClick={onClose} />
      <aside className="slide-over open" aria-hidden={false}>
        <header className="slide-over-header">
          <h2>Mock Interview</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={1.75} />
          </button>
        </header>
        <div className="slide-over-body">
          <section className="so-section">
            <h3>Session</h3>
            <label>
              <span>Interview type</span>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)}>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Duration</span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) as 15 | 30 | 45 | 60)}
              >
                {DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>{duration} minutes</option>
                ))}
              </select>
            </label>
            <button
              className="so-button-primary"
              disabled={starting}
              onClick={() => onStart({ presetId, durationMinutes })}
            >
              {starting ? 'Starting…' : 'Start mock interview'}
            </button>
          </section>
          <section className="so-tip">
            Uses your saved personal context and writes the mock interviewer into the same transcript
            so transcript ask and screen ask keep working.
          </section>
        </div>
      </aside>
    </>
  )
}
