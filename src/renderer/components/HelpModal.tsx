/**
 * HelpModal Component - Glassmorphic Design System
 *
 * Modal dialog with helpful instructions and keyboard shortcuts
 * following the elegant frosted glass styling.
 */

import React, { useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Icons
// ============================================================================

const CloseIcon = () => (
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
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const KeyboardIcon = () => (
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
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M18 12h.01M10 16h4" />
  </svg>
);

const InfoIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export function HelpModal({
  isOpen,
  onClose,
}: HelpModalProps): React.ReactElement | null {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="glass-modal-backdrop" onClick={onClose}>
      <div
        className="glass-modal glass-animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="glass-modal-header" style={{ flexShrink: 0 }}>
          <h2 className="glass-modal-title">Help & Instructions</h2>
          <button
            onClick={onClose}
            className="glass-modal-close"
            aria-label="Close help"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div
          className="glass-modal-body glass-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <div>
            {/* Keyboard Shortcuts */}
            <section style={{ marginBottom: '28px' }}>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--glass-text-secondary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <KeyboardIcon />
                Keyboard Shortcuts
              </h3>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    padding: '14px',
                    background: 'var(--glass-bg-secondary)',
                    border: '1px solid var(--glass-border-subtle)',
                    borderRadius: 'var(--glass-radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--glass-text-primary)',
                      }}
                    >
                      Toggle Live Mode
                    </span>
                    <kbd
                      style={{
                        padding: '4px 10px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: 'var(--glass-radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--glass-text-secondary)',
                      }}
                    >
                      ⌘⇧L
                    </kbd>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--glass-text-muted)',
                      margin: 0,
                    }}
                  >
                    Start or stop audio transcription. Connect/disconnect to
                    Deepgram.
                  </p>
                </div>

                <div
                  style={{
                    padding: '14px',
                    background: 'var(--glass-bg-secondary)',
                    border: '1px solid var(--glass-border-subtle)',
                    borderRadius: 'var(--glass-radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--glass-text-primary)',
                      }}
                    >
                      Trigger Answer
                    </span>
                    <kbd
                      style={{
                        padding: '4px 10px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: 'var(--glass-radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--glass-text-secondary)',
                      }}
                    >
                      ⌘⇧X
                    </kbd>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--glass-text-muted)',
                      margin: 0,
                    }}
                  >
                    Generate an AI-powered answer based on the last 20 minutes
                    of conversation.
                  </p>
                </div>

                <div
                  style={{
                    padding: '14px',
                    background: 'var(--glass-bg-secondary)',
                    border: '1px solid var(--glass-border-subtle)',
                    borderRadius: 'var(--glass-radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--glass-text-primary)',
                      }}
                    >
                      Clear Overlay
                    </span>
                    <kbd
                      style={{
                        padding: '4px 10px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: 'var(--glass-radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--glass-text-secondary)',
                      }}
                    >
                      ⌘⇧Z
                    </kbd>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--glass-text-muted)',
                      margin: 0,
                    }}
                  >
                    Clear transcript and answer history. Context buffer is
                    preserved.
                  </p>
                </div>

                <div
                  style={{
                    padding: '14px',
                    background: 'var(--glass-bg-secondary)',
                    border: '1px solid var(--glass-border-subtle)',
                    borderRadius: 'var(--glass-radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--glass-text-primary)',
                      }}
                    >
                      Minimize Mode
                    </span>
                    <kbd
                      style={{
                        padding: '4px 10px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: 'var(--glass-radius-sm)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        color: 'var(--glass-text-secondary)',
                      }}
                    >
                      Cmd+Shift+M
                    </kbd>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--glass-text-muted)',
                      margin: 0,
                    }}
                  >
                    Reduce overlay size to focus on interviewer. Click overlay
                    or use shortcut to expand.
                  </p>
                </div>
              </div>
            </section>

            {/* Getting Started */}
            <section style={{ marginBottom: '28px' }}>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--glass-text-secondary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <InfoIcon />
                Getting Started
              </h3>
              <div
                style={{
                  padding: '18px',
                  background: 'var(--glass-bg-secondary)',
                  border: '1px solid var(--glass-border-subtle)',
                  borderRadius: 'var(--glass-radius-md)',
                }}
              >
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Configure API Keys:
                    </strong>{' '}
                    Click the settings icon to add your Deepgram and Groq API
                    keys. You can get these from{' '}
                    <a
                      href="https://console.deepgram.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--glass-accent-light)',
                        textDecoration: 'none',
                      }}
                    >
                      Deepgram
                    </a>{' '}
                    and{' '}
                    <a
                      href="https://console.groq.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--glass-accent-light)',
                        textDecoration: 'none',
                      }}
                    >
                      Groq
                    </a>
                    .
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Start Live Mode:
                    </strong>{' '}
                    Press{' '}
                    <kbd
                      style={{
                        padding: '2px 6px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: '4px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                      }}
                    >
                      ⌘⇧L
                    </kbd>{' '}
                    to begin transcription. The status indicator shows
                    connection state.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Get Answers:
                    </strong>{' '}
                    When you need help, press{' '}
                    <kbd
                      style={{
                        padding: '2px 6px',
                        background: 'var(--glass-bg-elevated)',
                        border: '1px solid var(--glass-border-default)',
                        borderRadius: '4px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                      }}
                    >
                      ⌘⇧X
                    </kbd>{' '}
                    to generate an AI response based on the conversation
                    context.
                  </li>
                </ol>
              </div>
            </section>

            {/* How It Works */}
            <section style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--glass-text-secondary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <InfoIcon />
                How It Works
              </h3>
              <div
                style={{
                  padding: '18px',
                  background: 'var(--glass-bg-secondary)',
                  border: '1px solid var(--glass-border-subtle)',
                  borderRadius: 'var(--glass-radius-md)',
                }}
              >
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Real-time Transcription:
                    </strong>{' '}
                    Audio is captured and sent to Deepgram for live
                    transcription. Both system audio and microphone input are
                    processed.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Context Buffer:
                    </strong>{' '}
                    The last 20 minutes of conversation are maintained in memory
                    for context-aware answers.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      AI Answers:
                    </strong>{' '}
                    Answers are generated using Groq&apos;s fast LLM models,
                    optimized for coding questions and system design problems.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    <strong style={{ color: 'var(--glass-text-primary)' }}>
                      Stealth Mode:
                    </strong>{' '}
                    The overlay window is hidden from screen capture software,
                    keeping your workflow private.
                  </li>
                </ul>
              </div>
            </section>

            {/* Tips */}
            <section>
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--glass-text-secondary)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <InfoIcon />
                Tips
              </h3>
              <div
                style={{
                  padding: '18px',
                  background: 'var(--glass-bg-secondary)',
                  border: '1px solid var(--glass-border-subtle)',
                  borderRadius: 'var(--glass-radius-md)',
                }}
              >
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    The transcript shows the last 30 seconds of conversation for
                    quick reference.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    Green status indicator means Live Mode is active and
                    listening.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    Answers include code examples, explanations, and time
                    complexity analysis for coding questions.
                  </li>
                  <li
                    style={{
                      fontSize: '13px',
                      color: 'var(--glass-text-secondary)',
                      lineHeight: '1.6',
                    }}
                  >
                    You can drag the overlay window to reposition it on your
                    screen.
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="glass-modal-footer" style={{ flexShrink: 0 }}>
          <button onClick={onClose} className="glass-btn glass-btn--primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;
