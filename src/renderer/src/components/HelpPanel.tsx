import { X } from 'lucide-react'

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
    label: 'Ask from transcript',
    detail:
      'Sends the entire session transcript to Groq with a prompt to answer the most recent interviewer question in first person. Stream appears as the hero card. If pressed mid-stream, the previous answer is aborted and a fresh one starts.',
  },
  {
    keys: [cmd(), 'Shift', '\\'],
    label: 'Ask from screen',
    detail:
      'Captures the active display, sends the screenshot plus transcript context to the OpenAI vision model, and streams the answer with a session-only thumbnail.',
  },
  {
    keys: [cmd(), 'B'],
    label: 'Toggle visibility',
    detail:
      'Hides or shows the overlay for you. The window stays excluded from screen capture either way — this is a personal show/hide on your own screen.',
  },
  {
    keys: [cmd(), 'W'],
    label: 'Toggle wide mode',
    detail:
      'Resizes the window between normal (460 px) and wide (760 px) for long code blocks. No effect in compact mode.',
  },
]

const BUTTON_ACTIONS: ShortcutEntry[] = [
  { keys: ['?'], label: 'Help', detail: 'Opens this panel.' },
  {
    keys: ['-'],
    label: 'Compact mode',
    detail:
      'Shrinks the overlay to a 360×120 card showing the latest question and the first lines of the latest answer. Compact mode stays hidden from screen sharing.',
  },
  {
    keys: ['Q'],
    label: 'Quit',
    detail:
      'Fully exits the app: closes both ElevenLabs WebSockets, unregisters global shortcuts. Re-launch from your Applications folder or terminal.',
  },
  {
    keys: ['S'],
    label: 'Settings',
    detail:
      'Edit ElevenLabs, Groq, and OpenAI API keys (encrypted via safeStorage), choose the vision model, edit interview presets, manage permissions.',
  },
  {
    keys: ['Space'],
    label: 'Toggle transcription',
    detail:
      'Opens microphone + system-audio capture and connects two parallel ElevenLabs Scribe v2 Realtime WebSockets. Stop closes both sockets.',
  },
  {
    keys: ['M'],
    label: 'Mock interview',
    detail:
      'Starts or stops an OpenAI Realtime mock interviewer. The mock transcript uses the same You/Them transcript as transcript ask and screen ask.',
  },
  {
    keys: ['C'],
    label: 'Clear transcript',
    detail:
      'Wipes the canonical transcript both in the renderer view and the main-process store. The next ask starts from scratch.',
  },
]

export function HelpPanel({ open, onClose }: Props): JSX.Element | null {
  if (!open) return null

  return (
    <>
      <div className="slide-over-catcher" onClick={onClose} />
      <aside className="slide-over open" aria-hidden={false}>
        <header className="slide-over-header">
          <h2>Help & Shortcuts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} strokeWidth={1.75} />
          </button>
        </header>
        <div className="slide-over-body">
          <section className="so-section">
            <h3>Global shortcuts</h3>
            {SHORTCUTS.map((s) => (
              <ShortcutRow key={s.label} entry={s} />
            ))}
          </section>
          <section className="so-section">
            <h3>In-window keys</h3>
            {BUTTON_ACTIONS.map((s) => (
              <ShortcutRow key={s.label} entry={s} />
            ))}
          </section>
          <section className="so-tip">
            Use headphones during interviews. Without them, the microphone picks up the
            interviewer's audio from your speakers and pollutes the “You” stream.
          </section>
        </div>
      </aside>
    </>
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
  return navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
}
