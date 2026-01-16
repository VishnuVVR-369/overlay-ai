/**
 * AnswerCard Component - Glassmorphic Design System
 *
 * Displays LLM-generated answers with elegant markdown rendering
 * and frosted glass visual elements.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { AnswerState } from '../../lib/ipc';

// ============================================================================
// Types
// ============================================================================

export interface AnswerCardProps {
  state: AnswerState;
  text: string;
  error?: string;
  modelId?: string;
  showModel?: boolean;
  maxHeight?: string;
}

// ============================================================================
// Icons
// ============================================================================

const CommandIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const AlertIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

// ============================================================================
// Sub-Components
// ============================================================================

function ModelBadge({ modelId }: { modelId: string }): React.ReactElement {
  const shortName =
    modelId.split('/').pop()?.split('-').slice(0, 2).join('-') || modelId;

  return <span className="glass-model-badge">{shortName}</span>;
}

function GeneratingIndicator(): React.ReactElement {
  return (
    <div className="glass-generating">
      <span className="glass-generating-dot" />
      <span>GENERATING</span>
    </div>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="glass-loading-dots mb-4">
        <span />
        <span />
        <span />
      </div>
      <p className="text-xs text-[var(--glass-text-muted)] font-mono">
        GENERATING RESPONSE...
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="glass-answer-error">
      <div className="glass-answer-error-icon">
        <AlertIcon />
      </div>
      <div>
        <h4>Generation Failed</h4>
        <p>{message}</p>
      </div>
    </div>
  );
}

function IdleState(): React.ReactElement {
  return (
    <div className="glass-answer-idle">
      <div className="glass-answer-idle-icon">
        <SparkleIcon />
      </div>
      <h3>Ready to assist</h3>
      <p>
        Press <kbd className="glass-kbd">Cmd+Shift+X</kbd> to generate an answer
      </p>
      <p className="mt-3 text-[10px] text-[var(--glass-text-subtle)]">
        Based on the last 20 minutes of conversation
      </p>
    </div>
  );
}

// ============================================================================
// Markdown Components
// ============================================================================

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
  a: ({
    href,
    children,
  }: {
    href?: string;
    children?: React.ReactNode;
  }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

// ============================================================================
// Main Component
// ============================================================================

export function AnswerCard({
  state,
  text,
  error,
  modelId,
  showModel = true,
  maxHeight = '200px',
}: AnswerCardProps): React.ReactElement {
  const showContent = state === 'generating' || state === 'complete';

  return (
    <div className="glass-answer glass-animate-in">
      {/* Header */}
      <div className="glass-answer-header">
        <div className="glass-answer-title">
          <span className="glass-answer-title-icon">
            <CommandIcon />
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

      {/* Content */}
      <div
        className="glass-answer-content glass-scrollbar"
        style={{ maxHeight }}
      >
        {state === 'idle' && <IdleState />}
        {state === 'error' && error && <ErrorState message={error} />}
        {state === 'generating' && !text && <LoadingState />}

        {showContent && text && (
          <div className="glass-prose">
            <ReactMarkdown components={markdownComponents}>
              {text}
            </ReactMarkdown>
            {state === 'generating' && <span className="glass-cursor" />}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function CompactAnswer({
  state,
  text,
}: Pick<AnswerCardProps, 'state' | 'text'>): React.ReactElement {
  if (state === 'idle' || !text) {
    return (
      <p className="text-xs text-[var(--glass-text-muted)] font-mono">
        NO RESPONSE YET
      </p>
    );
  }

  return (
    <div className="glass-prose">
      <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
      {state === 'generating' && <span className="glass-cursor" />}
    </div>
  );
}

export default AnswerCard;
