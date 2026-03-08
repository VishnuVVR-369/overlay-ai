import React from 'react';
import { Streamdown } from 'streamdown';
import { CommandIcon, SparkleIcon, AlertIcon } from './Icons';
import type { AnswerState } from '../../lib/ipc';
import {
  ANSWER_MODE_DEFINITIONS,
  ANSWER_MODE_MAP,
  DEFAULT_ANSWER_MODE,
  type AnswerFormatMode,
  type AnswerModeDefinition,
} from '../../lib/answerModes';

export interface AnswerCardProps {
  state: AnswerState;
  text: string;
  mode?: AnswerFormatMode;
  availableModes?: readonly AnswerModeDefinition[];
  error?: string;
  modelId?: string;
  showModel?: boolean;
  maxHeight?: string;
  onTriggerMode?: (mode: AnswerFormatMode) => void;
}

function ModelBadge({ modelId }: { modelId: string }): React.ReactElement {
  const shortName =
    modelId.split('/').pop()?.split('-').slice(0, 2).join('-') || modelId;

  return (
    <span className="font-mono text-[10px] px-2.5 py-1 bg-glass-bg-primary border border-glass-border-subtle rounded-full text-glass-text-muted">
      {shortName}
    </span>
  );
}

function ModeBadge({
  mode,
}: {
  mode: AnswerFormatMode;
}): React.ReactElement {
  return (
    <span className="font-mono text-[10px] px-2.5 py-1 bg-glass-accent-subtle border border-glass-accent/20 rounded-full text-glass-accent-light">
      {ANSWER_MODE_MAP[mode].label}
    </span>
  );
}

function GeneratingIndicator(): React.ReactElement {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-glass-accent-subtle rounded-full font-mono text-[10px] text-glass-accent-light">
      <span className="w-1.5 h-1.5 bg-current rounded-full animate-glass-pulse" />
      <span>GENERATING</span>
    </div>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="flex items-center gap-1.5 mb-4">
        <span className="w-[7px] h-[7px] bg-glass-accent rounded-full animate-glass-bounce" />
        <span className="w-[7px] h-[7px] bg-glass-accent rounded-full animate-glass-bounce [animation-delay:0.15s]" />
        <span className="w-[7px] h-[7px] bg-glass-accent rounded-full animate-glass-bounce [animation-delay:0.3s]" />
      </div>
      <p className="text-xs text-glass-text-muted font-mono">
        GENERATING RESPONSE...
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex items-start gap-3.5 p-4 bg-glass-error/[0.08] border border-glass-error/20 rounded-glass-md">
      <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-glass-error/15 flex items-center justify-center text-glass-error">
        <AlertIcon size={16} />
      </div>
      <div>
        <h4 className="text-[13px] font-semibold text-glass-error mb-1">
          Generation Failed
        </h4>
        <p className="text-xs text-glass-error/80">{message}</p>
      </div>
    </div>
  );
}

function IdleState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 mb-4 border border-dashed border-glass-border-default rounded-full flex items-center justify-center bg-glass-bg-secondary">
        <SparkleIcon
          size={28}
          strokeWidth={1.5}
          className="text-glass-text-muted"
        />
      </div>
      <h3 className="text-[15px] font-medium text-glass-text-secondary mb-2">
        Ready to assist
      </h3>
      <p className="text-[13px] text-glass-text-muted">
        Press{' '}
        <kbd className="inline-flex items-center gap-1 px-2.5 py-1 bg-glass-bg-elevated border border-glass-border-subtle rounded-md font-mono text-[11px] text-glass-text-secondary">
          Cmd+Shift+X
        </kbd>{' '}
        for a full answer
      </p>
      <p className="mt-3 text-[11px] text-glass-text-subtle">
        Faster actions are available in the mode bar below.
      </p>
    </div>
  );
}

function ModeActions({
  activeMode,
  availableModes,
  onTriggerMode,
}: {
  activeMode: AnswerFormatMode;
  availableModes: readonly AnswerModeDefinition[];
  onTriggerMode?: (mode: AnswerFormatMode) => void;
}): React.ReactElement {
  return (
    <div className="px-3.5 py-2 border-b border-glass-border-subtle bg-glass-bg-secondary/70">
      <div className="flex flex-wrap gap-2">
        {availableModes.map((mode) => {
          const isActive = mode.id === activeMode;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onTriggerMode?.(mode.id)}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border font-mono text-[10px] transition-all duration-glass-fast ${
                isActive
                  ? 'bg-glass-accent-subtle border-glass-accent/30 text-glass-accent-light'
                  : 'bg-glass-bg-primary border-glass-border-subtle text-glass-text-muted hover:border-glass-accent/20 hover:text-glass-text-primary'
              }`}
              title={`${mode.label} (${mode.hotkeyDisplay})`}
              aria-label={`Generate ${mode.label}`}
            >
              <span>{mode.shortLabel}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-black/10 text-[9px] tracking-wide">
                {mode.hotkeyLetter}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const markdownComponents = {
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return <code {...props}>{children}</code>;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <pre>{children}</pre>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol>{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  p: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong>{children}</strong>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote>{children}</blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export function AnswerCard({
  state,
  text,
  mode = DEFAULT_ANSWER_MODE,
  availableModes = ANSWER_MODE_DEFINITIONS,
  error,
  modelId,
  showModel = true,
  maxHeight = '200px',
  onTriggerMode,
}: AnswerCardProps): React.ReactElement {
  const showContent = state === 'generating' || state === 'complete';

  return (
    <div className="glass-answer relative bg-glass-bg-primary border border-glass-border-subtle rounded-glass-lg backdrop-blur-glass-md shadow-glass-md overflow-hidden animate-glass-slide-up">
      <div className="shrink-0 px-3.5 py-2.5 border-b border-glass-border-subtle bg-glass-bg-secondary flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-wide uppercase text-glass-accent-light">
          <span className="w-4 h-4 border-[1.5px] border-current rounded flex items-center justify-center text-[10px]">
            <CommandIcon size={14} />
          </span>
          <span>RESPONSE</span>
          <ModeBadge mode={mode} />
        </div>

        <div className="flex items-center gap-3">
          {state === 'generating' && <GeneratingIndicator />}
          {showModel && modelId && state !== 'idle' && (
            <ModelBadge modelId={modelId} />
          )}
        </div>
      </div>

      <ModeActions
        activeMode={mode}
        availableModes={availableModes}
        onTriggerMode={onTriggerMode}
      />

      <div
        className="p-3.5 overflow-y-auto glass-scrollbar"
        style={{ maxHeight }}
      >
        {state === 'idle' && <IdleState />}
        {state === 'error' && error && <ErrorState message={error} />}
        {state === 'generating' && !text && <LoadingState />}

        {showContent && text && (
          <div className="glass-prose text-sm leading-relaxed text-glass-text-primary">
            <Streamdown
              mode="streaming"
              parseIncompleteMarkdown
              components={markdownComponents}
            >
              {text}
            </Streamdown>
            {state === 'generating' && <span className="glass-cursor" />}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompactAnswer({
  state,
  text,
}: Pick<AnswerCardProps, 'state' | 'text'>): React.ReactElement {
  if (state === 'idle' || !text) {
    return (
      <p className="text-xs text-glass-text-muted font-mono">NO RESPONSE YET</p>
    );
  }

  return (
    <div className="glass-prose text-sm leading-relaxed text-glass-text-primary">
      <Streamdown
        mode="streaming"
        parseIncompleteMarkdown
        components={markdownComponents}
      >
        {text}
      </Streamdown>
      {state === 'generating' && <span className="glass-cursor" />}
    </div>
  );
}

export default AnswerCard;
