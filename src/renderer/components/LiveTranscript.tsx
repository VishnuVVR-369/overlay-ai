import React, { useEffect, useRef, useMemo } from 'react';
import { MicrophoneIcon } from './Icons';
import type { TranscriptSegment, Speaker } from '../../lib/transcript';

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

const RECENT_WINDOW_MS = 60000; // 60 seconds

function filterRecentSegments(
  segments: TranscriptSegment[],
  windowMs: number = RECENT_WINDOW_MS
): TranscriptSegment[] {
  const cutoff = Date.now() - windowMs;
  return segments.filter((seg) => seg.timestamp >= cutoff);
}

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
    const now = Date.now();

    if (lastGroup && lastGroup.speaker === interimSpeaker) {
      lastGroup.texts.push({
        text: interimText,
        timestamp: now,
        isInterim: true,
      });
    } else {
      groups.push({
        speaker: interimSpeaker,
        texts: [{ text: interimText, timestamp: now, isInterim: true }],
        startTimestamp: now,
      });
    }
  }

  return groups;
}

interface TranscriptGroupProps {
  group: GroupedSegment;
}

function TranscriptGroup({ group }: TranscriptGroupProps): React.ReactElement {
  const hasInterim = group.texts.some((t) => t.isInterim);

  return (
    <div className="flex items-start gap-2.5 leading-relaxed animate-glass-fade-in">
      <div className="flex-1 text-[13px] text-glass-text-primary break-words">
        {group.texts.map((item, idx) => (
          <span
            key={`${item.timestamp}-${idx}`}
            className={item.isInterim ? 'opacity-50 italic' : ''}
          >
            {item.text}
            {idx < group.texts.length - 1 && ' '}
          </span>
        ))}
        {hasInterim && <span className="glass-cursor" />}
      </div>
    </div>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-5 bg-glass-bg-primary border border-glass-border-subtle rounded-glass-md">
      <div className="w-10 h-10 mb-3.5 border border-dashed border-glass-border-default rounded-full flex items-center justify-center text-glass-text-muted">
        <MicrophoneIcon size={16} strokeWidth={1.5} />
      </div>
      <span className="font-mono text-[11px] font-semibold tracking-widest text-glass-text-muted mb-1.5">
        AWAITING INPUT
      </span>
      <span className="text-xs text-glass-text-subtle">
        Audio transcript will appear here
      </span>
    </div>
  );
}

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
    <div className="relative bg-glass-bg-primary border border-glass-border-subtle rounded-glass-md overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-glass-bg-secondary border-b border-glass-border-subtle">
        <span className="flex items-center gap-2.5 font-mono text-[10px] font-semibold tracking-widest uppercase text-glass-text-muted">
          <span className="w-1.5 h-1.5 bg-glass-success rounded-full animate-glass-pulse" />
          LIVE TRANSCRIPT
        </span>
        <span className="font-mono text-[10px] text-glass-text-subtle">
          {recentSegments.length} segments
        </span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-y-auto px-3 py-2.5 glass-scrollbar"
        style={{ maxHeight }}
      >
        <div className="flex flex-col gap-2">
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
      <div className="flex items-center justify-center py-4 px-3 bg-glass-bg-primary border border-glass-border-subtle rounded-lg">
        <span className="flex items-center gap-2 text-glass-text-muted text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
          Waiting for audio...
        </span>
      </div>
    );
  }

  const config = SPEAKER_CONFIG[displaySpeaker];
  const isInterim = !!interimText;
  const truncatedText =
    displayText.length > 80 ? `${displayText.slice(-80)}...` : displayText;

  const speakerColorClass =
    displaySpeaker === 'interviewer'
      ? 'text-glass-speaker-interviewer'
      : 'text-glass-speaker-you';

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-glass-bg-primary border border-glass-border-subtle rounded-lg overflow-hidden">
      <span className={`font-mono text-[10px] font-bold ${speakerColorClass}`}>
        {config.label}:
      </span>
      <span
        className={`text-glass-text-primary text-xs whitespace-nowrap overflow-hidden text-ellipsis flex-1 ${
          isInterim ? 'opacity-50 italic' : ''
        }`}
      >
        {truncatedText}
      </span>
      {isInterim && <span className="glass-cursor glass-cursor--sm" />}
    </div>
  );
}

export default LiveTranscript;
