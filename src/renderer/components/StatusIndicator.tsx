/**
 * StatusIndicator Component
 *
 * Per PLAN.md Phase 7.1:
 * StatusIndicator: Green dot (Listening), Red dot (Error)
 *
 * Shows the current connection status of the live audio/transcription pipeline.
 */

import React from 'react';
import type { LiveModeState } from '../../lib/ipc';

// ============================================================================
// Types
// ============================================================================

export interface StatusIndicatorProps {
  /** Current live mode state */
  state: LiveModeState;
  /** Optional error message to display */
  error?: string;
  /** Whether to show the status label */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  color: string;
  pulseColor: string;
  label: string;
  animate: boolean;
}

const STATUS_CONFIG: Record<LiveModeState, StatusConfig> = {
  disconnected: {
    color: 'bg-gray-500',
    pulseColor: 'bg-gray-400',
    label: 'Disconnected',
    animate: false,
  },
  connecting: {
    color: 'bg-yellow-500',
    pulseColor: 'bg-yellow-400',
    label: 'Connecting...',
    animate: true,
  },
  connected: {
    color: 'bg-green-500',
    pulseColor: 'bg-green-400',
    label: 'Listening',
    animate: true,
  },
  error: {
    color: 'bg-red-500',
    pulseColor: 'bg-red-400',
    label: 'Error',
    animate: false,
  },
};

const SIZE_CLASSES = {
  sm: {
    dot: 'h-2 w-2',
    pulse: 'h-2 w-2',
    text: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    dot: 'h-3 w-3',
    pulse: 'h-3 w-3',
    text: 'text-sm',
    gap: 'gap-2',
  },
  lg: {
    dot: 'h-4 w-4',
    pulse: 'h-4 w-4',
    text: 'text-base',
    gap: 'gap-2.5',
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * StatusIndicator shows the current live mode status
 *
 * @example
 * ```tsx
 * <StatusIndicator state="connected" />
 * <StatusIndicator state="error" error="Connection failed" showLabel />
 * ```
 */
export function StatusIndicator({
  state,
  error,
  showLabel = true,
  size = 'md',
}: StatusIndicatorProps): React.ReactElement {
  const config = STATUS_CONFIG[state];
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <div className={`flex items-center ${sizeClasses.gap}`}>
      {/* Status dot with optional pulse animation */}
      <div className="relative flex items-center justify-center">
        {config.animate && (
          <span
            className={`absolute ${sizeClasses.pulse} ${config.pulseColor} rounded-full animate-ping opacity-75`}
          />
        )}
        <span
          className={`relative ${sizeClasses.dot} ${config.color} rounded-full`}
        />
      </div>

      {/* Status label */}
      {showLabel && (
        <span className={`${sizeClasses.text} text-gray-300 font-medium`}>
          {state === 'error' && error ? error : config.label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Variants
// ============================================================================

/**
 * Compact status indicator (dot only)
 */
export function StatusDot({
  state,
  size = 'sm',
}: Pick<StatusIndicatorProps, 'state' | 'size'>): React.ReactElement {
  return <StatusIndicator state={state} showLabel={false} size={size} />;
}

/**
 * Status badge with background
 */
export function StatusBadge({
  state,
  error,
}: Pick<StatusIndicatorProps, 'state' | 'error'>): React.ReactElement {
  const config = STATUS_CONFIG[state];

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 rounded-full backdrop-blur-sm">
      <StatusDot state={state} />
      <span className="text-sm text-gray-200 font-medium">
        {state === 'error' && error ? error : config.label}
      </span>
    </div>
  );
}

export default StatusIndicator;
