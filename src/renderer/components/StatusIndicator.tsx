import React from 'react';
import type { LiveModeState } from '../../lib/ipc';

export interface StatusIndicatorProps {
  state: LiveModeState;
  error?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface StatusConfig {
  label: string;
  stateClass: string;
  colorClass: string;
}

const STATUS_CONFIG: Record<LiveModeState, StatusConfig> = {
  disconnected: {
    label: 'OFFLINE',
    stateClass: 'glass-status--disconnected',
    colorClass:
      'text-glass-text-muted border-glass-border-subtle bg-glass-bg-secondary',
  },
  connecting: {
    label: 'CONNECTING',
    stateClass: 'glass-status--connecting',
    colorClass:
      'text-glass-warning border-glass-warning/25 bg-glass-warning/[0.06]',
  },
  connected: {
    label: 'LISTENING',
    stateClass: 'glass-status--connected',
    colorClass:
      'text-glass-success border-glass-success/25 bg-glass-success/[0.06]',
  },
  error: {
    label: 'ERROR',
    stateClass: 'glass-status--error',
    colorClass: 'text-glass-error border-glass-error/25 bg-glass-error/[0.06]',
  },
};

export function StatusIndicator({
  state,
  error,
  showLabel = true,
}: StatusIndicatorProps): React.ReactElement {
  const config = STATUS_CONFIG[state];
  const displayLabel = state === 'error' && error ? 'ERROR' : config.label;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full font-mono text-[10px] font-medium tracking-wide transition-all duration-glass-fast ${config.stateClass} ${config.colorClass}`}
    >
      <span
        className="glass-status-dot relative w-1.5 h-1.5"
        aria-hidden="true"
      />
      {showLabel && <span>{displayLabel}</span>}
    </div>
  );
}

export function StatusDot({
  state,
}: Pick<StatusIndicatorProps, 'state'>): React.ReactElement {
  return <StatusIndicator state={state} showLabel={false} />;
}

export function StatusBadge({
  state,
  error,
}: Pick<StatusIndicatorProps, 'state' | 'error'>): React.ReactElement {
  return <StatusIndicator state={state} error={error} showLabel={true} />;
}

export function InlineStatus({
  state,
}: Pick<StatusIndicatorProps, 'state'>): React.ReactElement {
  const config = STATUS_CONFIG[state];

  const colorClass = {
    disconnected: 'text-glass-text-muted',
    connecting: 'text-glass-warning',
    connected: 'text-glass-success',
    error: 'text-glass-error',
  }[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${colorClass}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {(state === 'connected' || state === 'connecting') && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
        )}
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
      </span>
      {config.label}
    </span>
  );
}

export default StatusIndicator;
