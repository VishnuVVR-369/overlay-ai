import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { searchCommands, type CommandDef, type CommandId } from '../commands'
import { useCommandContext } from '../hooks/useCommandContext'

interface Props {
  open: boolean
  onClose: () => void
  onRun: (id: CommandId) => void
}

/**
 * One searchable entry point to every action. This is what makes the HUD able to
 * stay bare: nothing has to be discoverable by hunting for a 13px icon.
 */
export function CommandPalette({ open, onClose, onRun }: Props): JSX.Element | null {
  const ctx = useCommandContext()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchCommands(query, ctx), [query, ctx])

  // Reset to a clean palette each time it opens rather than resuming a stale query.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]')
    // scrollIntoView is missing in jsdom and on some older engines.
    if (active instanceof HTMLElement && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor, results])

  if (!open) return null

  const run = (command: CommandDef | undefined): void => {
    if (!command) return
    onRun(command.id)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      setCursor((c) => (results.length === 0 ? 0 : (c + 1) % results.length))
      return
    }
    if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      setCursor((c) => (results.length === 0 ? 0 : (c - 1 + results.length) % results.length))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      run(results[cursor])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <>
      <div className="palette-scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="palette-search">
          <Search size={14} strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search actions…"
            aria-label="Search actions"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="palette-results" ref={listRef} role="listbox" aria-label="Actions">
          {results.length === 0 ? (
            <div className="palette-empty">No action matches “{query}”.</div>
          ) : (
            results.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === cursor}
                data-active={index === cursor}
                className={`palette-item ${command.danger ? 'danger' : ''}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => run(command)}
              >
                <span className="palette-item-main">
                  <span className="palette-item-label">{command.label(ctx)}</span>
                  <span className="palette-item-hint">{command.hint}</span>
                </span>
                <span className="palette-item-side">
                  {command.keys.length > 0 ? (
                    <span className="keys">
                      {command.keys.map((key, i) => (
                        <kbd key={i}>{key}</kbd>
                      ))}
                    </span>
                  ) : (
                    <span className="palette-item-group">{command.group}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
