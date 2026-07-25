import { COMMANDS, mod, type CommandDef, type CommandGroup } from '../../commands'
import { useCommandContext } from '../../hooks/useCommandContext'

const GROUP_ORDER: CommandGroup[] = ['Live', 'Practice', 'Setup', 'Overlay']

const GROUP_NOTE: Record<CommandGroup, string> = {
  Live: 'What you use during a real interview.',
  Practice: 'Rehearsing and reviewing before the real thing.',
  Setup: 'Everything you configure ahead of time.',
  Overlay: 'Controlling the window itself.',
}

export function HelpTab(): JSX.Element {
  const ctx = useCommandContext()

  return (
    <>
      <section className="pane">
        <h3>How it works</h3>
        <p className="pane-lede">
          The overlay never takes focus, so during a call your keystrokes still go to Zoom or your editor.
          Only the shortcuts marked <span className="pill pill-ok">global</span> reach the overlay from
          there — the rest need you to click it first, or open the palette with <kbd>{mod()}</kbd>
          <kbd>K</kbd>.
        </p>
      </section>

      {GROUP_ORDER.map((group) => {
        const commands = COMMANDS.filter((c) => c.group === group)
        if (commands.length === 0) return null
        return (
          <section className="pane" key={group}>
            <div className="pane-head">
              <h3>{group}</h3>
              <span className="pane-meta">{GROUP_NOTE[group]}</span>
            </div>
            <div className="help-list">
              {commands.map((command) => (
                <HelpRow key={command.id} command={command} label={command.label(ctx)} />
              ))}
            </div>
          </section>
        )
      })}

      <section className="pane">
        <h3>Running a clean interview</h3>
        <ul className="tip-list">
          <li>
            Wear headphones. Without them your microphone hears the interviewer through your speakers and
            both voices land in the “You” stream, which poisons every answer.
          </li>
          <li>
            Run the readiness check on the Setup tab before the call, not during it. A missing key is only
            obvious once you are already being asked a question.
          </li>
          <li>
            Fill in Personal context. It is the difference between a real answer about your work and a
            fluent invention.
          </li>
          <li>
            The window is excluded from screen capture, so it stays invisible if you share your screen. It
            is still visible to anyone looking at your actual monitor.
          </li>
        </ul>
      </section>
    </>
  )
}

function HelpRow({ command, label }: { command: CommandDef; label: string }): JSX.Element {
  return (
    <div className="help-row">
      <div className="help-row-head">
        <span className="help-row-label">{label}</span>
        {command.keys.length > 0 ? (
          <span className="keys">
            {command.keys.map((key, i) => (
              <kbd key={i}>{key}</kbd>
            ))}
          </span>
        ) : (
          <span className="keys keys-none">palette</span>
        )}
      </div>
      <div className="help-row-hint">
        {command.scope === 'global' && <span className="pill pill-ok">global</span>}
        {command.hint}
      </div>
    </div>
  )
}
