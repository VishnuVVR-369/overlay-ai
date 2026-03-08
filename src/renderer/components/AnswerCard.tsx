import React from 'react';
import { Streamdown } from 'streamdown';
import { CommandIcon, SparkleIcon, AlertIcon } from './Icons';
import type { AnswerState } from '../../lib/ipc';
import {
  getInterviewModeLabel,
  type InterviewMode,
} from '../../lib/interviewModes';

export interface AnswerCardProps {
  state: AnswerState;
  text: string;
  error?: string;
  modelId?: string;
  interviewMode?: InterviewMode;
  showModel?: boolean;
  maxHeight?: string;
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

function IdleState({
  interviewMode = 'general',
}: {
  interviewMode?: InterviewMode;
}): React.ReactElement {
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
      <p className="text-[11px] uppercase tracking-wide text-glass-accent-light mb-2">
        {getInterviewModeLabel(interviewMode)} mode
      </p>
      <p className="text-[13px] text-glass-text-muted">
        Press{' '}
        <kbd className="inline-flex items-center gap-1 px-2.5 py-1 bg-glass-bg-elevated border border-glass-border-subtle rounded-md font-mono text-[11px] text-glass-text-secondary">
          Cmd+Shift+X
        </kbd>{' '}
        to generate an answer
      </p>
      <p className="mt-3 text-[10px] text-glass-text-subtle">
        Based on last 20 minutes of conversation
      </p>
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
  error,
  modelId,
  interviewMode,
  showModel = true,
  maxHeight = '200px',
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
        </div>

        <div className="flex items-center gap-3">
          {state === 'generating' && <GeneratingIndicator />}
          {showModel && modelId && state !== 'idle' && (
            <ModelBadge modelId={modelId} />
          )}
        </div>
      </div>

      <div
        className="p-3.5 overflow-y-auto glass-scrollbar"
        style={{ maxHeight }}
      >
        {state === 'idle' && <IdleState interviewMode={interviewMode} />}
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
