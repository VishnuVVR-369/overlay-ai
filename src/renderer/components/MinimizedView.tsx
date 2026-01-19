import React from 'react';
import { ExpandIcon } from './Icons';
import type { LiveModeState } from '../types';

interface MinimizedViewProps {
  liveModeState: LiveModeState;
  isGenerating: boolean;
  onToggle: () => void;
}

const STATUS_STYLES: Record<LiveModeState, { color: string; label: string }> = {
  connected: { color: 'var(--glass-success)', label: 'LIVE' },
  connecting: { color: 'var(--glass-warning)', label: 'CONNECTING' },
  error: { color: 'var(--glass-error)', label: 'ERROR' },
  disconnected: { color: 'var(--glass-neutral)', label: 'IDLE' },
};

export function MinimizedView({
  liveModeState,
  isGenerating,
  onToggle,
}: MinimizedViewProps): React.ReactElement {
  const { color, label } = STATUS_STYLES[liveModeState];

  return (
    <div className="minimized-container">
      <div className="minimized-content">
        <div className="minimized-status" style={{ color }}>
          <span className="minimized-status-dot" />
          <span className="minimized-status-label">{label}</span>
        </div>
        {isGenerating && (
          <div className="minimized-generating">
            <span className="minimized-generating-dot" />
            <span>GENERATING</span>
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        className="minimized-toggle"
        title="Press Cmd+Shift+M to expand"
        aria-label="Expand overlay"
      >
        <ExpandIcon size={16} />
      </button>
    </div>
  );
}

export default MinimizedView;
