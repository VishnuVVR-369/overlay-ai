/**
 * StatusIndicator Component - Cyber-Minimalist HUD Design
 *
 * A sleek status indicator inspired by professional dev tools
 * with subtle HUD aesthetics for the overlay interface.
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
    stateClass: 'hud-status--idle',
  },
  connecting: {
    label: 'CONNECTING',
    stateClass: 'hud-status--connecting',
  },
  connected: {
    label: 'LISTENING',
    stateClass: 'hud-status--active',
  },
  error: {
    label: 'ERROR',
    stateClass: 'hud-status--error',
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
    <div className={`hud-status ${config.stateClass}`}>
      <span className="hud-status-dot" aria-hidden="true" />
      {showLabel && (
        <span className="hud-status-label">{displayLabel}</span>
      )}
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
    disconnected: 'text-[var(--hud-status-idle)]',
    connecting: 'text-[var(--hud-status-warning)]',
    connected: 'text-[var(--hud-status-active)]',
    error: 'text-[var(--hud-status-error)]',
  }[state];

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${colorClass}`}>
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
