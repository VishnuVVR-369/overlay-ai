/**
 * LiveTranscript Component - Space-Efficient Terminal Log Design
 *
 * A compact, flowing transcript display that maximizes content density
 * while maintaining the cyber-minimalist HUD aesthetic. Speaker changes
 * are indicated inline, and consecutive messages flow together naturally.
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
    colorClass: 'transcript-speaker--interviewer',
  },
  me: {
    label: 'YOU',
    colorClass: 'transcript-speaker--you',
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
  });
}

function filterRecentSegments(
  segments: TranscriptSegment[],
  windowMs: number = 60000 // Increased to 60s for more context
): TranscriptSegment[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  return segments.filter((seg) => seg.timestamp >= cutoff);
}

/**
 * Groups consecutive segments from the same speaker together
 * for a more compact display
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
      // Same speaker - add to existing group
      lastGroup.texts.push({
        text: segment.text,
        timestamp: segment.timestamp,
      });
    } else {
      // Different speaker - create new group
      groups.push({
        speaker: segment.speaker,
        texts: [{ text: segment.text, timestamp: segment.timestamp }],
        startTimestamp: segment.timestamp,
      });
    }
  }

  // Add interim text
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

interface SpeakerTagProps {
  speaker: Speaker;
  timestamp?: number;
  showTimestamp?: boolean;
}

function SpeakerTag({
  speaker,
  timestamp,
  showTimestamp,
}: SpeakerTagProps): React.ReactElement {
  const config = SPEAKER_CONFIG[speaker];

  return (
    <span className={`transcript-tag ${config.colorClass}`}>
      <span className="transcript-tag__chevron">›</span>
      <span className="transcript-tag__label">{config.label}</span>
      {showTimestamp && timestamp && (
        <span className="transcript-tag__time">{formatTimestamp(timestamp)}</span>
      )}
    </span>
  );
}

interface TranscriptGroupProps {
  group: GroupedSegment;
  showTimestamp: boolean;
  isFirst: boolean;
}

function TranscriptGroup({
  group,
  showTimestamp,
  isFirst,
}: TranscriptGroupProps): React.ReactElement {
  const config = SPEAKER_CONFIG[group.speaker];

  return (
    <div className={`transcript-group ${isFirst ? 'transcript-group--first' : ''}`}>
      <SpeakerTag
        speaker={group.speaker}
        timestamp={group.startTimestamp}
        showTimestamp={showTimestamp}
      />
      <div className={`transcript-content ${config.colorClass}`}>
        {group.texts.map((item, idx) => (
          <span
            key={`${item.timestamp}-${idx}`}
            className={`transcript-text ${item.isInterim ? 'transcript-text--interim' : ''}`}
          >
            {item.text}
            {idx < group.texts.length - 1 && ' '}
          </span>
        ))}
        {group.texts.some((t) => t.isInterim) && (
          <span className="transcript-cursor" />
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
    <div className="transcript-empty">
      <div className="transcript-empty__icon">
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
      <span className="transcript-empty__text">AWAITING INPUT</span>
      <span className="transcript-empty__hint">Audio transcript will appear here</span>
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
  showTimestamps = false,
}: LiveTranscriptProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, interimText, autoScroll]);

  // Filter to recent segments (60 seconds for more context)
  const recentSegments = useMemo(
    () => filterRecentSegments(segments),
    [segments]
  );

  // Group segments by speaker for compact display
  const groupedSegments = useMemo(
    () => groupSegmentsBySpeaker(recentSegments, interimText, interimSpeaker),
    [recentSegments, interimText, interimSpeaker]
  );

  if (groupedSegments.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="transcript-container">
      <div className="transcript-header">
        <span className="transcript-header__title">
          <span className="transcript-header__dot" />
          LIVE TRANSCRIPT
        </span>
        <span className="transcript-header__count">
          {recentSegments.length} segments
        </span>
      </div>
      <div
        ref={scrollRef}
        className="transcript-scroll hud-scrollbar"
        style={{ maxHeight }}
      >
        <div className="transcript-log">
          {groupedSegments.map((group, index) => (
            <TranscriptGroup
              key={`${group.speaker}-${group.startTimestamp}`}
              group={group}
              showTimestamp={showTimestamps}
              isFirst={index === 0}
            />
          ))}
        </div>
      </div>
      <div className="transcript-fade" />
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
      <div className="transcript-compact transcript-compact--empty">
        <span className="transcript-compact__waiting">
          <span className="transcript-compact__dot" />
          Waiting for audio...
        </span>
      </div>
    );
  }

  const config = SPEAKER_CONFIG[displaySpeaker];
  const isInterim = !!interimText;

  return (
    <div className="transcript-compact">
      <span className={`transcript-compact__speaker ${config.colorClass}`}>
        {config.label}:
      </span>
      <span
        className={`transcript-compact__text ${
          isInterim ? 'transcript-compact__text--interim' : ''
        }`}
      >
        {displayText.length > 80 ? `${displayText.slice(-80)}...` : displayText}
      </span>
      {isInterim && <span className="transcript-cursor transcript-cursor--sm" />}
    </div>
  );
}

export default LiveTranscript;
