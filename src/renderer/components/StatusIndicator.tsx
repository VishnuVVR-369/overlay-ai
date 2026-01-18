/**
 * StatusIndicator Component - Glassmorphic Design System
 *
 * A clean status indicator with frosted glass aesthetics
 * for the overlay interface.
 */

import React from 'react';
import type { LiveModeState } from '../../lib/ipc';

// ============================================================================
// Types
// ============================================================================

export interface StatusIndicatorProps {
  state: LiveModeState;
  error?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  label: string;
  stateClass: string;
}

const STATUS_CONFIG: Record<LiveModeState, StatusConfig> = {
  disconnected: {
    label: 'OFFLINE',
    stateClass: 'glass-status--disconnected',
  },
  connecting: {
    label: 'CONNECTING',
    stateClass: 'glass-status--connecting',
  },
  connected: {
    label: 'LISTENING',
    stateClass: 'glass-status--connected',
  },
  error: {
    label: 'ERROR',
    stateClass: 'glass-status--error',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function StatusIndicator({
  state,
  error,
  showLabel = true,
}: StatusIndicatorProps): React.ReactElement {
  const config = STATUS_CONFIG[state];
  const displayLabel = state === 'error' && error ? 'ERROR' : config.label;

  return (
    <div className={`glass-status ${config.stateClass}`}>
      <span className="glass-status-dot" aria-hidden="true" />
      {showLabel && <span className="glass-status-label">{displayLabel}</span>}
    </div>
  );
}

// ============================================================================
// Variants
// ============================================================================

/**
 * Compact status dot only
 */
export function StatusDot({
  state,
}: Pick<StatusIndicatorProps, 'state'>): React.ReactElement {
  return <StatusIndicator state={state} showLabel={false} />;
}

/**
 * Status badge - the main variant used in the header
 */
export function StatusBadge({
  state,
  error,
}: Pick<StatusIndicatorProps, 'state' | 'error'>): React.ReactElement {
  return <StatusIndicator state={state} error={error} showLabel={true} />;
}

// ============================================================================
// Inline Status (for compact displays)
// ============================================================================

export function InlineStatus({
  state,
}: Pick<StatusIndicatorProps, 'state'>): React.ReactElement {
  const config = STATUS_CONFIG[state];

  const colorClass = {
    disconnected: 'text-[var(--glass-neutral)]',
    connecting: 'text-[var(--glass-warning)]',
    connected: 'text-[var(--glass-success)]',
    error: 'text-[var(--glass-error)]',
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
