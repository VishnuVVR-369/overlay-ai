/**
 * LiveTranscript Component
 *
 * Per PLAN.md Phase 7.1:
 * LiveTranscript: Scrolling text of the last 30s (for confidence check)
 *
 * Displays real-time transcript segments with speaker labels.
 */

import React, { useEffect, useRef } from 'react';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';

// ============================================================================
// Types
// ============================================================================

export interface LiveTranscriptProps {
  /** Transcript segments to display */
  segments: TranscriptSegment[];
  /** Interim (non-final) transcript text */
  interimText?: string;
  /** Speaker of the interim text */
  interimSpeaker?: Speaker;
  /** Maximum height of the transcript area */
  maxHeight?: string;
  /** Whether to auto-scroll to bottom */
  autoScroll?: boolean;
  /** Show timestamps */
  showTimestamps?: boolean;
}

// ============================================================================
// Speaker Styling
// ============================================================================

const SPEAKER_STYLES: Record<Speaker, { label: string; color: string; bgColor: string }> = {
  interviewer: {
    label: 'Interviewer',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  me: {
    label: 'You',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Filter segments to last N seconds
 * TODO: Per PLAN.md, this should show ~30 seconds. Implement time-window filter.
 */
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
}

function TranscriptLine({ segment, showTimestamp }: TranscriptLineProps): React.ReactElement {
  const style = SPEAKER_STYLES[segment.speaker];

  return (
    <div className={`px-3 py-2 rounded-lg ${style.bgColor} mb-2`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold ${style.color}`}>
          {style.label}
        </span>
        {showTimestamp && (
          <span className="text-xs text-gray-500">
            {formatTimestamp(segment.timestamp)}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">
        {segment.text}
      </p>
    </div>
  );
}

interface InterimTextProps {
  text: string;
  speaker: Speaker;
}

function InterimText({ text, speaker }: InterimTextProps): React.ReactElement {
  const style = SPEAKER_STYLES[speaker];

  return (
    <div className={`px-3 py-2 rounded-lg ${style.bgColor} mb-2 opacity-60`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold ${style.color}`}>
          {style.label}
        </span>
        <span className="text-xs text-gray-500 italic">typing...</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed italic">
        {text}
      </p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * LiveTranscript displays scrolling transcript text
 *
 * @example
 * ```tsx
 * <LiveTranscript
 *   segments={transcriptSegments}
 *   interimText="The candidate is..."
 *   interimSpeaker="interviewer"
 * />
 * ```
 */
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

  if (recentSegments.length === 0 && !interimText) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-sm text-gray-500">
          Waiting for transcript...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
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
      {interimText && interimSpeaker && (
        <InterimText text={interimText} speaker={interimSpeaker} />
      )}
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

/**
 * Compact transcript showing only the most recent text
 */
export function CompactTranscript({
  segments,
  interimText,
  interimSpeaker,
}: Pick<LiveTranscriptProps, 'segments' | 'interimText' | 'interimSpeaker'>): React.ReactElement {
  // Show only the last segment or interim text
  const lastSegment = segments[segments.length - 1];
  const displayText = interimText || lastSegment?.text;
  const displaySpeaker = interimSpeaker || lastSegment?.speaker;

  if (!displayText || !displaySpeaker) {
    return (
      <p className="text-sm text-gray-500 italic">
        Waiting for transcript...
      </p>
    );
  }

  const style = SPEAKER_STYLES[displaySpeaker];
  const isInterim = !!interimText;

  return (
    <div className="flex items-start gap-2">
      <span className={`text-xs font-semibold ${style.color} shrink-0`}>
        {style.label}:
      </span>
      <p className={`text-sm text-gray-200 ${isInterim ? 'italic opacity-60' : ''}`}>
        {displayText}
      </p>
    </div>
  );
}

export default LiveTranscript;
