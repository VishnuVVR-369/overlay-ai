import React, { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { useChatState } from '../hooks/useChatState';
import {
  CloseIcon,
  TrashIcon,
  ChatIcon,
  SendIcon,
  PinIcon,
} from '../components/Icons';
import type { ChatMessage } from '../../lib/chat';

const markdownComponents = {
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="font-mono text-[13px] bg-black/30 px-1.5 py-0.5 rounded"
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
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-3 bg-black/30 p-3 rounded-md overflow-x-auto">
      {children}
    </pre>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-3 mb-2 font-semibold text-base">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-3 mb-2 font-semibold text-[15px]">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-3 mb-2 font-semibold text-sm">{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="my-1">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 pl-3 border-l-[3px] border-glass-accent text-glass-text-secondary italic">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-glass-accent-light underline hover:text-glass-accent"
    >
      {children}
    </a>
  ),
};

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps): React.ReactElement {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const isUser = message.role === 'user';

  return (
    <div
      className={`flex flex-col gap-1 max-w-[85%] animate-glass-slide-up ${
        isUser ? 'self-end' : 'self-start'
      }`}
    >
      <div
        className={`px-3.5 py-2.5 rounded-glass-lg text-sm leading-relaxed break-words ${
          isUser
            ? 'bg-glass-accent text-white rounded-br-sm'
            : 'bg-glass-bg-secondary text-glass-text-primary rounded-bl-sm glass-prose'
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <Streamdown
            mode="streaming"
            parseIncompleteMarkdown
            components={markdownComponents}
          >
            {message.content}
          </Streamdown>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-glass-text-muted">
        {formatTime(message.timestamp)}
        {message.includeTranscript && (
          <span title="Transcript included" className="text-glass-accent-light">
            <PinIcon size={10} />
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-glass-text-muted text-[13px] text-center p-8">
      <ChatIcon
        size={48}
        className="mb-3 opacity-50 text-glass-accent-light"
        strokeWidth={1.5}
      />
      <p>Ask me anything about the interview</p>
      <p className="text-glass-text-subtle text-xs mt-2">
        Use Cmd+Shift+C to open/close this window
      </p>
    </div>
  );
}

interface HeaderButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}

function HeaderButton({
  onClick,
  title,
  icon,
}: HeaderButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 p-0 bg-transparent border-none rounded-glass-sm text-glass-text-secondary cursor-pointer flex items-center justify-center transition-all duration-glass-fast hover:bg-glass-bg-hover hover:text-glass-text-primary active:bg-glass-bg-active"
      title={title}
    >
      {icon}
    </button>
  );
}

export function ChatWindow(): React.ReactElement {
  const { state, actions } = useChatState();
  const [input, setInput] = useState('');
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  const handleSend = async () => {
    if (!input.trim() || state.isGenerating) return;
    const message = input.trim();
    setInput('');
    await actions.sendMessage(message, includeTranscript);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-container relative flex flex-col h-screen bg-glass-bg-deep backdrop-blur-glass-xl">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-glass-bg-secondary border-b border-glass-border-subtle draggable">
        <div className="flex items-center gap-2 text-glass-text-primary font-semibold text-sm">
          <ChatIcon size={16} />
          <span>AI Chat</span>
        </div>
        <div className="flex gap-1 non-draggable">
          <HeaderButton
            onClick={actions.clearHistory}
            title="Clear chat"
            icon={<TrashIcon size={14} />}
          />
          <HeaderButton
            onClick={actions.closeWindow}
            title="Close chat"
            icon={<CloseIcon size={14} />}
          />
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 glass-scrollbar">
        {state.messages.length === 0 && !state.isGenerating ? (
          <EmptyState />
        ) : (
          <>
            {state.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {state.isGenerating &&
              state.messages[state.messages.length - 1]?.role !==
                'assistant' && (
                <div className="flex flex-col gap-1 max-w-[85%] self-start animate-glass-slide-up">
                  <div className="px-3.5 py-2.5 rounded-glass-lg text-sm bg-glass-bg-secondary text-glass-text-muted italic rounded-bl-sm">
                    Thinking...
                    <span className="inline-block w-2 h-2 ml-2 bg-glass-accent-light rounded-full animate-glass-pulse" />
                  </div>
                </div>
              )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Message */}
      {state.lastError && (
        <div className="mx-4 mb-2 px-3.5 py-2.5 bg-glass-error/15 text-glass-error text-sm rounded-glass-md text-center">
          {state.lastError}
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 p-4 bg-glass-bg-secondary border-t border-glass-border-subtle">
        {/* Toggle */}
        <div className="flex items-center gap-2 mb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-glass-text-secondary select-none">
              Include transcript
            </span>
            <button
              className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors duration-glass-fast ${
                includeTranscript ? 'bg-glass-accent' : 'bg-glass-bg-elevated'
              }`}
              onClick={() => setIncludeTranscript(!includeTranscript)}
              title="Include last 20 minutes of transcript in message"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-glass-fast ${
                  includeTranscript ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
          <span className="text-glass-text-muted text-[11px]">
            {includeTranscript ? 'On' : 'Off'}
          </span>
        </div>

        {/* Input Row */}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-glass-bg-elevated border border-glass-border-subtle rounded-glass-md px-3 py-2.5 text-glass-text-primary text-sm font-sans resize-none outline-none transition-colors duration-glass-fast min-h-[80px] max-h-[120px] placeholder:text-glass-text-muted focus:border-glass-accent"
            disabled={state.isGenerating}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state.isGenerating}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-glass-accent text-white border-none rounded-glass-md text-[13px] font-medium cursor-pointer transition-all duration-glass-fast whitespace-nowrap hover:bg-glass-accent-light hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-glass-accent disabled:hover:translate-y-0"
          >
            <SendIcon size={16} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
