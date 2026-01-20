import React, { useState, useEffect, useRef } from 'react';
import { ClockIcon, TextIcon, TokenIcon } from './Icons';

interface SessionStatsFooterProps {
  sessionStartedAt: number | null;
  wordsTranscribed: number;
  inputTokens: number;
  outputTokens: number;
  isConnected: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function SessionStatsFooter({
  sessionStartedAt,
  wordsTranscribed,
  inputTokens,
  outputTokens,
  isConnected,
}: SessionStatsFooterProps): React.ReactElement {
  const [duration, setDuration] = useState(0);
  const lastDurationRef = useRef(0);

  useEffect(() => {
    if (sessionStartedAt === null) {
      // Session was reset (e.g., clearOverlay) - reset duration
      setDuration(0);
      lastDurationRef.current = 0;
      return;
    }

    if (!isConnected) {
      // Disconnected but session exists - keep showing last duration
      setDuration(lastDurationRef.current);
      return;
    }

    // Connected - update duration every second
    const updateDuration = () => {
      const newDuration = Date.now() - sessionStartedAt;
      setDuration(newDuration);
      lastDurationRef.current = newDuration;
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [isConnected, sessionStartedAt]);

  const totalTokens = inputTokens + outputTokens;
  const hasStats = wordsTranscribed > 0 || totalTokens > 0 || duration > 0;

  if (!hasStats && !isConnected) {
    return <></>;
  }

  return (
    <footer className="glass-stats-footer">
      <div className="glass-stat">
        <ClockIcon size={12} className="glass-stat-icon" />
        <span className="glass-stat-value">{formatDuration(duration)}</span>
      </div>

      <div className="glass-stat">
        <TextIcon size={12} className="glass-stat-icon" />
        <span className="glass-stat-value">
          {formatNumber(wordsTranscribed)} words
        </span>
      </div>

      <div className="glass-stat">
        <TokenIcon size={12} className="glass-stat-icon" />
        <span className="glass-stat-value">
          {formatNumber(totalTokens)} tokens
        </span>
      </div>
    </footer>
  );
}
