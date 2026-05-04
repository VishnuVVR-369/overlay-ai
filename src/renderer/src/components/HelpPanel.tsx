interface Props {
  open: boolean
  onClose: () => void
}

interface ShortcutEntry {
  keys: string[]
  label: string
  detail: string
}

const SHORTCUTS: ShortcutEntry[] = [
  {
    keys: [cmd(), '\\'],
    label: 'Ask the LLM',
    detail:
      'Sends the entire session transcript to Groq gpt-oss-120b with a prompt to answer the most recent interviewer question in first person. Stream appears in the bottom pane. If pressed mid-stream, the previous answer is aborted and a fresh one starts.',
  },
  {
    keys: [cmd(), 'B'],
    label: 'Toggle window visibility',
    detail:
      'Hides or shows the overlay for you. The window stays excluded from screen capture either way — this is just a personal show/hide for your own screen.',
  },
]

const BUTTON_ACTIONS: ShortcutEntry[] = [
  {
    keys: ['?'],
    label: 'Help',
    detail: 'Opens this panel.',
  },
  {
    keys: ['-'],
    label: 'Toggle compact mode',
    detail:
      'Switches between the full overlay and a small pill that shows only the status indicators. Compact mode is still hidden from screen sharing.',
  },
  {
    keys: ['Q'],
    label: 'Quit',
    detail:
      'Fully exits the app, closing both ElevenLabs WebSockets and unregistering the global shortcuts. There is no dock icon to relaunch from — start from your Applications folder or terminal.',
  },
  {
    keys: ['S'],
    label: 'Settings',
    detail:
      'Edit ElevenLabs and Groq API keys (encrypted with safeStorage), check microphone and screen-recording permission status, and request them if needed.',
  },
  {
    keys: ['Space'],
    label: 'Toggle transcription',
    detail:
      'Opens microphone + system-audio capture and connects two parallel ElevenLabs Scribe v2 Realtime WebSockets. Stop closes both sockets and frees the audio devices.',
  },
  {
    keys: ['C'],
    label: 'Clear transcript',
    detail:
      'Wipes the canonical transcript both in the renderer view and the main-process store. The next LLM ask starts from scratch.',
  },
]

export function HelpPanel({ open, onClose }: Props): JSX.Element | null {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Help & Shortcuts</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <section className="modal-section">
          <h3>Keyboard shortcuts</h3>
          {SHORTCUTS.map((s) => (
            <ShortcutRow key={s.label} entry={s} />
          ))}
        </section>

        <section className="modal-section">
          <h3>UI buttons</h3>
          {BUTTON_ACTIONS.map((s) => (
            <ShortcutRow key={s.label} entry={s} />
          ))}
        </section>

        <section className="modal-section modal-tip">
          Use headphones during interviews. Without them, the microphone picks up the
          interviewer's audio from your speakers and pollutes the "You" stream.
        </section>
      </div>
    </div>
  )
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }): JSX.Element {
  return (
    <div className="shortcut-row">
      <div className="shortcut-keys">
        {entry.keys.map((k, i) => (
          <span key={i}>
            <kbd>{k}</kbd>
            {i < entry.keys.length - 1 && <span className="shortcut-plus">+</span>}
          </span>
        ))}
      </div>
      <div className="shortcut-body">
        <div className="shortcut-label">{entry.label}</div>
        <div className="shortcut-detail">{entry.detail}</div>
      </div>
    </div>
  )
}

function cmd(): string {
  return navigator.userAgent.includes('Mac') ? 'Cmd' : 'Ctrl'
}
