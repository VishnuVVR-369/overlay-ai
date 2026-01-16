/**
 * LiveTranscript Component - Glassmorphic Design System
 *
 * A clean, compact transcript display with frosted glass aesthetics.
 * Speaker changes are indicated inline with elegant visual hierarchy.
 */

import React, { useEffect, useRef, useMemo } from 'react';
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

interface GroupedSegment {
  speaker: Speaker;
  texts: Array<{ text: string; timestamp: number; isInterim?: boolean }>;
  startTimestamp: number;
}

// ============================================================================
// Speaker Configuration
// ============================================================================

const SPEAKER_CONFIG: Record<Speaker, { label: string; colorClass: string }> = {
  interviewer: {
    label: 'INT',
    colorClass: 'glass-transcript-tag--interviewer',
  },
  me: {
    label: 'YOU',
    colorClass: 'glass-transcript-tag--you',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function filterRecentSegments(
  segments: TranscriptSegment[],
  windowMs: number = 60000
): TranscriptSegment[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  return segments.filter((seg) => seg.timestamp >= cutoff);
}

/**
 * Groups consecutive segments from the same speaker together
 */
function groupSegmentsBySpeaker(
  segments: TranscriptSegment[],
  interimText?: string,
  interimSpeaker?: Speaker
): GroupedSegment[] {
  const groups: GroupedSegment[] = [];

  for (const segment of segments) {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.texts.push({
        text: segment.text,
        timestamp: segment.timestamp,
      });
    } else {
      groups.push({
        speaker: segment.speaker,
        texts: [{ text: segment.text, timestamp: segment.timestamp }],
        startTimestamp: segment.timestamp,
      });
    }
  }

  if (interimText && interimSpeaker) {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.speaker === interimSpeaker) {
      lastGroup.texts.push({
        text: interimText,
        timestamp: Date.now(),
        isInterim: true,
      });
    } else {
      groups.push({
        speaker: interimSpeaker,
        texts: [{ text: interimText, timestamp: Date.now(), isInterim: true }],
        startTimestamp: Date.now(),
      });
    }
  }

  return groups;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TranscriptGroupProps {
  group: GroupedSegment;
}

function TranscriptGroup({
  group,
}: TranscriptGroupProps): React.ReactElement {
  return (
    <div className="glass-transcript-group">
      <div className="glass-transcript-content">
        {group.texts.map((item, idx) => (
          <span
            key={`${item.timestamp}-${idx}`}
            className={item.isInterim ? 'glass-transcript-text--interim' : ''}
          >
            {item.text}
            {idx < group.texts.length - 1 && ' '}
          </span>
        ))}
        {group.texts.some((t) => t.isInterim) && (
          <span className="glass-cursor" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState(): React.ReactElement {
  return (
    <div className="glass-transcript-empty">
      <div className="glass-transcript-empty-icon">
        <svg
          width="16"
          height="16"
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
      <span className="glass-transcript-empty-text">AWAITING INPUT</span>
      <span className="glass-transcript-empty-hint">Audio transcript will appear here</span>
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
  maxHeight = '240px',
  autoScroll = true,
}: LiveTranscriptProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText, autoScroll]);

  const recentSegments = useMemo(
    () => filterRecentSegments(segments),
    [segments]
  );

  const groupedSegments = useMemo(
    () => groupSegmentsBySpeaker(recentSegments, interimText, interimSpeaker),
    [recentSegments, interimText, interimSpeaker]
  );

  if (groupedSegments.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="glass-transcript">
      <div className="glass-transcript-header">
        <span className="glass-transcript-title">
          <span className="glass-transcript-dot" />
          LIVE TRANSCRIPT
        </span>
        <span className="glass-transcript-count">
          {recentSegments.length} segments
        </span>
      </div>
      <div
        ref={scrollRef}
        className="glass-transcript-scroll glass-scrollbar"
        style={{ maxHeight }}
      >
        <div className="glass-transcript-log">
          {groupedSegments.map((group) => (
            <TranscriptGroup
              key={`${group.speaker}-${group.startTimestamp}`}
              group={group}
            />
          ))}
        </div>
      </div>
      <div className="glass-transcript-fade" />
    </div>
  );
}

// ============================================================================
// Compact Variant (Single Line Display)
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
      <div className="flex items-center justify-center py-4 px-3 bg-[var(--glass-bg-primary)] border border-[var(--glass-border-subtle)] rounded-lg">
        <span className="flex items-center gap-2 text-[var(--glass-text-muted)] text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
          Waiting for audio...
        </span>
      </div>
    );
  }

  const config = SPEAKER_CONFIG[displaySpeaker];
  const isInterim = !!interimText;

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-[var(--glass-bg-primary)] border border-[var(--glass-border-subtle)] rounded-lg overflow-hidden">
      <span className={`font-mono text-[10px] font-bold ${config.colorClass.replace('glass-transcript-tag--', 'text-[var(--glass-speaker-')})}`}>
        {config.label}:
      </span>
      <span
        className={`text-[var(--glass-text-primary)] text-xs whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
          isInterim ? 'opacity-50 italic' : ''
        }`}
      >
        {displayText.length > 80 ? `${displayText.slice(-80)}...` : displayText}
      </span>
      {isInterim && <span className="glass-cursor glass-cursor--sm" />}
    </div>
  );
}

export default LiveTranscript;
