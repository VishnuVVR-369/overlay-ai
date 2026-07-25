import { useEffect, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import type { MockInterviewConfig, PresetId } from '@shared/types'
import { usePresetStore } from '../../state/preset-store'
import { useMockStore } from '../../state/mock-store'
import { formatClock, remainingMs } from '../../lib/time'

interface Props {
  starting: boolean
  onStart: (config: MockInterviewConfig) => void
  onStop: () => void
}

const DURATIONS = [15, 30, 45, 60] as const
type Duration = (typeof DURATIONS)[number]

export function PracticeTab({ starting, onStart, onStop }: Props): JSX.Element {
  const activePreset = usePresetStore((s) => s.active)
  const presets = usePresetStore((s) => s.presets)
  const status = useMockStore((s) => s.status)
  const [presetId, setPresetId] = useState<PresetId>(activePreset)
  const [durationMinutes, setDurationMinutes] = useState<Duration>(30)

  const live = status.state === 'active' || status.state === 'paused'

  if (live || status.state === 'connecting' || status.state === 'stopping') {
    return <LiveSession onStop={onStop} />
  }

  return (
    <>
      <section className="pane">
        <h3>Mock interview</h3>
        <p className="pane-lede">
          A voice interviewer asks, listens, and follows up. It writes into the same transcript as a real
          call, so <kbd>⌘</kbd>
          <kbd>\</kbd> still works if you want to see what the assistant would have said.
        </p>
      </section>

      <section className="pane">
        <span className="field-label">Interview type</span>
        <div className="mode-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`mode-card ${preset.id === presetId ? 'active' : ''}`}
              onClick={() => setPresetId(preset.id)}
              aria-pressed={preset.id === presetId}
            >
              <span className="mode-card-label">{preset.label}</span>
            </button>
          ))}
        </div>

        <span className="field-label">Duration</span>
        <div className="segmented" role="group" aria-label="Duration">
          {DURATIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              className={`seg-option ${duration === durationMinutes ? 'active' : ''}`}
              onClick={() => setDurationMinutes(duration)}
              aria-pressed={duration === durationMinutes}
            >
              {duration}m
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary btn-lg"
          disabled={starting}
          onClick={() => onStart({ presetId, durationMinutes })}
        >
          {starting ? 'Starting…' : `Start ${durationMinutes}-minute mock`}
        </button>
        {status.state === 'error' && status.message && (
          <div className="inline-error">{status.message}</div>
        )}
      </section>

      <p className="pane-note">
        Listening stops while a mock runs, so the two never fight over your microphone. Scores and
        annotations land in History as soon as you end the session.
      </p>
    </>
  )
}

function LiveSession({ onStop }: { onStop: () => void }): JSX.Element {
  const status = useMockStore((s) => s.status)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const remaining = remainingMs(status.endsAt, now)
  const connecting = status.state === 'connecting'
  const stopping = status.state === 'stopping'

  const togglePause = async (): Promise<void> => {
    setBusy(true)
    try {
      if (status.paused) await window.api.mock.resume()
      else await window.api.mock.pause()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="pane">
        <div className="session-state">
          <span className={`session-badge ${status.paused ? 'paused' : connecting ? 'connecting' : 'live'}`}>
            {connecting ? 'Connecting' : stopping ? 'Wrapping up' : status.paused ? 'Paused' : 'Live'}
          </span>
          <h3>Mock interview in progress</h3>
        </div>
        {remaining !== null && (
          <div className="session-clock" aria-label="Time remaining">
            <span className="session-clock-value">{formatClock(remaining)}</span>
            <span className="session-clock-unit">remaining</span>
          </div>
        )}
        <p className="pane-lede">
          {connecting
            ? 'Opening the realtime session…'
            : status.paused
              ? 'The interviewer is holding. Nothing is being recorded into the transcript.'
              : 'Answer out loud. The interviewer follows up on what you actually say.'}
        </p>
      </section>

      <section className="pane">
        <div className="pane-actions">
          <button className="btn btn-quiet" onClick={() => void togglePause()} disabled={busy || connecting || stopping}>
            {status.paused ? <Play size={13} strokeWidth={2} /> : <Pause size={13} strokeWidth={2} />}
            {status.paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-danger" onClick={onStop} disabled={stopping}>
            <Square size={12} strokeWidth={2} />
            End & grade
          </button>
        </div>
        <p className="pane-note">
          Ending the session saves the transcript and runs the grader. The result appears in History.
        </p>
      </section>
    </>
  )
}
