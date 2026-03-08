import React, { useId, useMemo } from 'react';
import {
  INTERVIEW_MODE_OPTIONS,
  getInterviewModeOption,
  type InterviewMode,
} from '../../lib/interviewModes';

interface InterviewModeSelectorProps {
  value: InterviewMode;
  onChange: (mode: InterviewMode) => void;
  disabled?: boolean;
  compact?: boolean;
  showDescription?: boolean;
  label?: string;
}

export function InterviewModeSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
  showDescription = false,
  label = 'Interview Mode',
}: InterviewModeSelectorProps): React.ReactElement {
  const fallbackId = useId();
  const selectedOption = useMemo(
    () => getInterviewModeOption(value),
    [value]
  );

  return (
    <div
      className={
        compact
          ? 'px-3.5 py-3 border-b border-glass-border-subtle bg-glass-bg-secondary/60'
          : 'mb-5'
      }
    >
      <label
        htmlFor={fallbackId}
        className="block text-xs font-semibold tracking-wide text-glass-text-secondary mb-2.5"
      >
        {label}
      </label>
      <select
        id={fallbackId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as InterviewMode)}
        className="w-full py-3 px-4 bg-glass-bg-primary border border-glass-border-subtle rounded-glass-md font-sans text-[13px] text-glass-text-primary transition-all duration-glass-fast focus:outline-none focus:border-glass-accent focus:shadow-[0_0_0_3px_rgba(155,182,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {INTERVIEW_MODE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {(showDescription || compact) && (
        <p className="mt-2.5 text-xs text-glass-text-muted leading-relaxed">
          {selectedOption.description}
        </p>
      )}
    </div>
  );
}

export default InterviewModeSelector;
