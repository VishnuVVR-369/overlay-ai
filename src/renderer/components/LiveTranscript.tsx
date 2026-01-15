/**
 * LiveTranscript Component - Cyber-Minimalist HUD Design
 *
 * Real-time transcript display with HUD-style speaker indicators
 * and sleek scrolling behavior.
 */

import React, { useEffect, useRef } from 'react';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';

// ============================================================================
// Types
// ============================================================================

export interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  interimText?: string;
  interimSpeaker?: Speaker;
  maxHeight?: string;
  autoScroll?: boolean;
  showTimestamps?: boolean;
}

// ============================================================================
// Speaker Configuration
// ============================================================================

const SPEAKER_CONFIG: Record<Speaker, { label: string; lineClass: string }> = {
  interviewer: {
    label: 'INTERVIEWER',
    lineClass: 'hud-transcript-line--interviewer',
  },
  me: {
    label: 'YOU',
    lineClass: 'hud-transcript-line--you',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function filterRecentSegments(
  segments: TranscriptSegment[],
  windowMs: number = 30000
): TranscriptSegment[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  return segments.filter((seg) => seg.timestamp >= cutoff);
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TranscriptLineProps {
  segment: TranscriptSegment;
  showTimestamp: boolean;
  isInterim?: boolean;
}

function TranscriptLine({
  segment,
  showTimestamp,
  isInterim = false,
}: TranscriptLineProps): React.ReactElement {
  const config = SPEAKER_CONFIG[segment.speaker];

  return (
    <div
      className={`hud-transcript-line ${config.lineClass} ${
        isInterim ? 'hud-transcript-line--interim' : ''
      }`}
    >
      <div className="hud-speaker-label">
        {config.label}
        {showTimestamp && (
          <span className="ml-2 opacity-50 font-normal">
            {formatTimestamp(segment.timestamp)}
          </span>
        )}
        {isInterim && (
          <span className="ml-2 opacity-50 italic font-normal">typing...</span>
        )}
      </div>
      <p className="hud-transcript-text">{segment.text}</p>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState(): React.ReactElement {
  return (
    <div className="hud-transcript-empty">
      <div className="hud-transcript-empty-icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </div>
      <p className="text-xs text-[var(--hud-text-tertiary)] font-mono">
        AWAITING TRANSCRIPT...
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LiveTranscript({
  segments,
  interimText,
  interimSpeaker,
  maxHeight = '200px',
  autoScroll = true,
  showTimestamps = false,
}: LiveTranscriptProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText, autoScroll]);

  // Filter to recent segments (last 30 seconds per PLAN.md)
  const recentSegments = filterRecentSegments(segments);

  // Create interim segment for display
  const interimSegment: TranscriptSegment | null =
    interimText && interimSpeaker
      ? {
          timestamp: Date.now(),
          speaker: interimSpeaker,
          text: interimText,
          wordCount: interimText.split(/\s+/).length,
        }
      : null;

  if (recentSegments.length === 0 && !interimSegment) {
    return <EmptyState />;
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto hud-scrollbar"
      style={{ maxHeight }}
    >
      {/* Final transcript segments */}
      {recentSegments.map((segment, index) => (
        <TranscriptLine
          key={`${segment.timestamp}-${index}`}
          segment={segment}
          showTimestamp={showTimestamps}
        />
      ))}

      {/* Interim (non-final) text */}
      {interimSegment && (
        <TranscriptLine
          segment={interimSegment}
          showTimestamp={false}
          isInterim={true}
        />
      )}
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function CompactTranscript({
  segments,
  interimText,
  interimSpeaker,
}: Pick<
  LiveTranscriptProps,
  'segments' | 'interimText' | 'interimSpeaker'
>): React.ReactElement {
  const lastSegment = segments[segments.length - 1];
  const displayText = interimText || lastSegment?.text;
  const displaySpeaker = interimSpeaker || lastSegment?.speaker;

  if (!displayText || !displaySpeaker) {
    return (
      <p className="text-xs text-[var(--hud-text-tertiary)] font-mono">
        AWAITING TRANSCRIPT...
      </p>
    );
  }

  const config = SPEAKER_CONFIG[displaySpeaker];
  const isInterim = !!interimText;

  const speakerColorClass =
    displaySpeaker === 'interviewer'
      ? 'text-[var(--hud-speaker-interviewer)]'
      : 'text-[var(--hud-speaker-you)]';

  return (
    <div className="flex items-start gap-3">
      <span
        className={`text-[10px] font-mono font-semibold shrink-0 ${speakerColorClass}`}
      >
        {'>'} {config.label}:
      </span>
      <p
        className={`text-sm text-[var(--hud-text-primary)] ${
          isInterim ? 'italic opacity-50' : ''
        }`}
      >
        {displayText}
      </p>
    </div>
  );
}

export default LiveTranscript;
