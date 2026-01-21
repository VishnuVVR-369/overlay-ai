import React from 'react';
import { ExpandIcon } from './Icons';
import type { LiveModeState } from '../types';

interface MinimizedViewProps {
  liveModeState: LiveModeState;
  isGenerating: boolean;
  onToggle: () => void;
}

const STATUS_STYLES: Record<
  LiveModeState,
  { colorClass: string; label: string }
> = {
  connected: { colorClass: 'text-glass-success', label: 'LIVE' },
  connecting: { colorClass: 'text-glass-warning', label: 'CONNECTING' },
  error: { colorClass: 'text-glass-error', label: 'ERROR' },
  disconnected: { colorClass: 'text-glass-neutral', label: 'IDLE' },
};

export function MinimizedView({
  liveModeState,
  isGenerating,
  onToggle,
}: MinimizedViewProps): React.ReactElement {
  const { colorClass, label } = STATUS_STYLES[liveModeState];

  return (
    <div className="w-full h-full flex items-center justify-center draggable relative">
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-2 bg-glass-bg-secondary border border-glass-border-subtle rounded-full font-mono text-[11px] font-semibold tracking-wide ${colorClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span className="uppercase">{label}</span>
        </div>
        {isGenerating && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-glass-accent-subtle rounded-glass-sm font-mono text-[10px] font-medium tracking-wide">
            <span className="w-1 h-1 rounded-full bg-glass-accent-light animate-glass-pulse" />
            <span>GENERATING</span>
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        className="absolute top-2 right-2 w-7 h-7 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md cursor-pointer flex items-center justify-center p-0 transition-all duration-glass-fast non-draggable z-10 hover:bg-glass-bg-hover hover:border-glass-accent hover:scale-105 active:bg-glass-bg-active active:scale-95"
        title="Press Cmd+Shift+M to expand"
        aria-label="Expand overlay"
      >
        <ExpandIcon size={16} />
      </button>
    </div>
  );
}

export default MinimizedView;
