import React from 'react';
import { Modal } from './Modal';
import { KeyboardIcon, InfoIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItemProps {
  title: string;
  shortcut: string;
  description: string;
}

function ShortcutItem({
  title,
  shortcut,
  description,
}: ShortcutItemProps): React.ReactElement {
  return (
    <div className="glass-help-item">
      <div className="glass-help-item-header">
        <span className="glass-help-item-title">{title}</span>
        <kbd className="glass-kbd">{shortcut}</kbd>
      </div>
      <p className="glass-help-item-desc">{description}</p>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps): React.ReactElement {
  return (
    <section className="glass-help-section">
      <h3 className="glass-help-section-title">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

const KEYBOARD_SHORTCUTS: ShortcutItemProps[] = [
  {
    title: 'Toggle Live Mode',
    shortcut: '\u2318\u21e7L',
    description:
      'Start or stop audio transcription. Connect/disconnect to Deepgram.',
  },
  {
    title: 'Trigger Answer',
    shortcut: '\u2318\u21e7X',
    description:
      'Generate an AI-powered answer based on last 20 minutes of conversation.',
  },
  {
    title: 'Clear Overlay',
    shortcut: '\u2318\u21e7Z',
    description:
      'Clear transcript and answer history. Context buffer is preserved.',
  },
  {
    title: 'Minimize Mode',
    shortcut: 'Cmd+Shift+M',
    description:
      'Reduce overlay size to focus on interviewer. Click overlay or use shortcut to expand.',
  },
];

const GETTING_STARTED_STEPS = [
  {
    title: 'Configure API Keys:',
    content: (
      <>
        Click settings icon to add your Deepgram and Groq API keys. You can get
        these from{' '}
        <a
          href="https://console.deepgram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-link"
        >
          Deepgram
        </a>{' '}
        and{' '}
        <a
          href="https://console.groq.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-link"
        >
          Groq
        </a>
        .
      </>
    ),
  },
  {
    title: 'Start Live Mode:',
    content: (
      <>
        Press <kbd className="glass-kbd glass-kbd--sm">{'\u2318\u21e7L'}</kbd>{' '}
        to begin transcription. The status indicator shows connection state.
      </>
    ),
  },
  {
    title: 'Get Answers:',
    content: (
      <>
        When you need help, press{' '}
        <kbd className="glass-kbd glass-kbd--sm">{'\u2318\u21e7X'}</kbd> to
        generate an AI response based on conversation context.
      </>
    ),
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Real-time Transcription:',
    description:
      'Audio is captured and sent to Deepgram for live transcription. Both system audio and microphone input are processed.',
  },
  {
    title: 'Context Buffer:',
    description:
      'The last 20 minutes of conversation are maintained in memory for context-aware answers.',
  },
  {
    title: 'AI Answers:',
    description:
      "Answers are generated using Groq's fast LLM models, optimized for coding questions and system design problems.",
  },
  {
    title: 'Stealth Mode:',
    description:
      'The overlay window is hidden from screen capture software, keeping your workflow private.',
  },
];

const TIPS = [
  'The transcript shows last 30 seconds of conversation for quick reference.',
  'Green status indicator means Live Mode is active and listening.',
  'Answers include code examples, explanations, and time complexity analysis for coding questions.',
  'You can drag overlay window to reposition it on your screen.',
];

export function HelpModal({
  isOpen,
  onClose,
}: HelpModalProps): React.ReactElement | null {
  const footer = (
    <button onClick={onClose} className="glass-btn glass-btn--primary">
      Got it
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Help & Instructions"
      footer={footer}
    >
      <Section title="Keyboard Shortcuts" icon={<KeyboardIcon size={14} />}>
        <div className="glass-help-grid">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <ShortcutItem key={shortcut.title} {...shortcut} />
          ))}
        </div>
      </Section>

      <Section title="Getting Started" icon={<InfoIcon size={14} />}>
        <div className="glass-help-card">
          <ol className="glass-help-list glass-help-list--ordered">
            {GETTING_STARTED_STEPS.map((step, index) => (
              <li key={index} className="glass-help-list-item">
                <strong className="glass-help-list-title">{step.title}</strong>{' '}
                {step.content}
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section title="How It Works" icon={<InfoIcon size={14} />}>
        <div className="glass-help-card">
          <ul className="glass-help-list">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.title} className="glass-help-list-item">
                <strong className="glass-help-list-title">{item.title}</strong>{' '}
                {item.description}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Tips" icon={<InfoIcon size={14} />}>
        <div className="glass-help-card">
          <ul className="glass-help-list">
            {TIPS.map((tip, index) => (
              <li key={index} className="glass-help-list-item">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </Modal>
  );
}

export default HelpModal;
