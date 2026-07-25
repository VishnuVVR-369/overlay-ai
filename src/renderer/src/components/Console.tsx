import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { CONSOLE_TABS, type ConsoleTab } from '../state/ui-store'
import { SetupTab } from './console/SetupTab'
import { ContextTab } from './console/ContextTab'
import { PromptsTab } from './console/PromptsTab'
import { PracticeTab } from './console/PracticeTab'
import { HistoryTab } from './console/HistoryTab'
import { HelpTab } from './console/HelpTab'
import type { MockInterviewConfig } from '@shared/types'

interface Props {
  tab: ConsoleTab | null
  starting: boolean
  onSelect: (tab: ConsoleTab) => void
  onClose: () => void
  onStartMock: (config: MockInterviewConfig) => void
  onStopMock: () => void
}

/**
 * The pre/post-interview surface. Everything that is not "read the answer"
 * lives here behind one tab strip, so the live HUD stays empty of chrome.
 */
export function Console({
  tab,
  starting,
  onSelect,
  onClose,
  onStartMock,
  onStopMock,
}: Props): JSX.Element | null {
  const bodyRef = useRef<HTMLDivElement>(null)

  // Each tab is its own scroll context; switching should land at the top.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [tab])

  if (!tab) return null

  return (
    <>
      <div className="console-scrim" onClick={onClose} />
      <section className="console" role="dialog" aria-label="Overlay console">
        <header className="console-header">
          <div className="console-drag" />
          <nav className="console-tabs" aria-label="Console sections">
            {CONSOLE_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`console-tab ${entry.id === tab ? 'active' : ''}`}
                aria-current={entry.id === tab ? 'page' : undefined}
                onClick={() => onSelect(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <button className="icon-btn console-close" onClick={onClose} aria-label="Close console">
            <X size={15} strokeWidth={1.75} />
          </button>
        </header>
        <div className="console-body" ref={bodyRef}>
          {tab === 'setup' && <SetupTab />}
          {tab === 'context' && <ContextTab />}
          {tab === 'prompts' && <PromptsTab />}
          {tab === 'practice' && (
            <PracticeTab starting={starting} onStart={onStartMock} onStop={onStopMock} />
          )}
          {tab === 'history' && <HistoryTab />}
          {tab === 'help' && <HelpTab />}
        </div>
      </section>
    </>
  )
}
