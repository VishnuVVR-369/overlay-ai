/**
 * AnswerCard Component
 *
 * Per PLAN.md Phase 7.1:
 * AnswerCard: The Markdown-rendered response from the LLM
 *
 * Displays streaming LLM responses with markdown formatting.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { AnswerState } from '../../lib/ipc';

// ============================================================================
// Types
// ============================================================================

export interface AnswerCardProps {
  /** Current answer generation state */
  state: AnswerState;
  /** The answer text (may be partial during streaming) */
  text: string;
  /** Error message if state is 'error' */
  error?: string;
  /** Model ID used for generation */
  modelId?: string;
  /** Whether to show the model badge */
  showModel?: boolean;
  /** Maximum height (scrollable) */
  maxHeight?: string;
}

// ============================================================================
// State Configuration
// ============================================================================

interface StateConfig {
  icon: string;
  label: string;
  showContent: boolean;
}

const STATE_CONFIG: Record<AnswerState, StateConfig> = {
  idle: {
    icon: '',
    label: 'Press Cmd+Shift+X to get answer',
    showContent: false,
  },
  generating: {
    icon: '',
    label: 'Generating...',
    showContent: true,
  },
  complete: {
    icon: '',
    label: '',
    showContent: true,
  },
  error: {
    icon: '',
    label: 'Error',
    showContent: false,
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

function LoadingIndicator(): React.ReactElement {
  return (
    <div className="flex items-center gap-2 text-gray-400">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">Generating response...</span>
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
      <span className="text-red-400 text-lg">!</span>
      <div>
        <p className="text-sm font-medium text-red-400">Error generating answer</p>
        <p className="text-xs text-red-300/80 mt-1">{message}</p>
      </div>
    </div>
  );
}

function IdleState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="text-4xl mb-3 opacity-30">?</div>
      <p className="text-sm text-gray-500">
        Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">Cmd+Shift+X</kbd> to generate an answer
      </p>
      <p className="text-xs text-gray-600 mt-2">
        Based on the last 20 minutes of conversation
      </p>
    </div>
  );
}

function ModelBadge({ modelId }: { modelId: string }): React.ReactElement {
  // Extract short model name
  const shortName = modelId.split('/').pop()?.split('-').slice(0, 2).join('-') || modelId;

  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-gray-700/50 rounded text-xs text-gray-400">
      {shortName}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * AnswerCard displays the LLM-generated answer
 *
 * @example
 * ```tsx
 * <AnswerCard
 *   state="generating"
 *   text="The solution involves..."
 *   modelId="openai/gpt-oss-120b"
 * />
 * ```
 */
export function AnswerCard({
  state,
  text,
  error,
  modelId,
  showModel = true,
  maxHeight = '400px',
}: AnswerCardProps): React.ReactElement {
  const config = STATE_CONFIG[state];

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Answer</span>
          {state === 'generating' && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        {showModel && modelId && state !== 'idle' && (
          <ModelBadge modelId={modelId} />
        )}
      </div>

      {/* Content */}
      <div
        className="p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ maxHeight }}
      >
        {/* Idle state */}
        {state === 'idle' && <IdleState />}

        {/* Error state */}
        {state === 'error' && error && <ErrorDisplay message={error} />}

        {/* Generating state with no text yet */}
        {state === 'generating' && !text && <LoadingIndicator />}

        {/* Content (generating or complete) */}
        {config.showContent && text && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Custom styling for code blocks
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="px-1.5 py-0.5 bg-gray-800 rounded text-green-400 text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                // Style code blocks
                pre: ({ children }) => (
                  <pre className="bg-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
                    {children}
                  </pre>
                ),
                // Style headings
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold text-white mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold text-white mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>
                ),
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 text-gray-200">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 text-gray-200">{children}</ol>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="text-gray-200 leading-relaxed mb-3">{children}</p>
                ),
                // Style strong/bold
                strong: ({ children }) => (
                  <strong className="font-semibold text-white">{children}</strong>
                ),
              }}
            >
              {text}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {state === 'generating' && (
              <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

/**
 * Compact answer display (no card wrapper)
 */
export function CompactAnswer({
  state,
  text,
}: Pick<AnswerCardProps, 'state' | 'text'>): React.ReactElement {
  if (state === 'idle' || !text) {
    return <p className="text-sm text-gray-500">No answer yet</p>;
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{text}</ReactMarkdown>
      {state === 'generating' && (
        <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1" />
      )}
    </div>
  );
}

export default AnswerCard;
