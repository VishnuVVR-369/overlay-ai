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
    <div className="p-3.5 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[13px] font-medium text-glass-text-primary">
          {title}
        </span>
        <kbd className="inline-flex items-center gap-1 px-2.5 py-1 bg-glass-bg-elevated border border-glass-border-subtle rounded-md font-mono text-[11px] text-glass-text-secondary">
          {shortcut}
        </kbd>
      </div>
      <p className="text-xs text-glass-text-muted m-0 leading-relaxed">
        {description}
      </p>
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
    <section className="mb-7 last:mb-0">
      <h3 className="text-[13px] font-semibold text-glass-text-secondary mb-4 flex items-center gap-2 uppercase tracking-wide">
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
          className="text-glass-accent-light no-underline transition-colors duration-glass-fast hover:text-glass-accent hover:underline"
        >
          Deepgram
        </a>{' '}
        and{' '}
        <a
          href="https://console.groq.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-glass-accent-light no-underline transition-colors duration-glass-fast hover:text-glass-accent hover:underline"
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
        Press{' '}
        <kbd className="inline-flex px-1.5 py-0.5 bg-glass-bg-elevated border border-glass-border-subtle rounded font-mono text-[11px] text-glass-text-secondary">
          {'\u2318\u21e7L'}
        </kbd>{' '}
        to begin transcription. The status indicator shows connection state.
      </>
    ),
  },
  {
    title: 'Get Answers:',
    content: (
      <>
        When you need help, press{' '}
        <kbd className="inline-flex px-1.5 py-0.5 bg-glass-bg-elevated border border-glass-border-subtle rounded font-mono text-[11px] text-glass-text-secondary">
          {'\u2318\u21e7X'}
        </kbd>{' '}
        to generate an AI response based on conversation context.
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
    <button
      onClick={onClose}
      className="px-4 py-2.5 rounded-glass-sm font-sans text-[13px] font-semibold cursor-pointer transition-all duration-glass-fast inline-flex items-center justify-center gap-2 bg-gradient-to-br from-glass-accent to-glass-accent-dark border-none text-white shadow-[0_2px_8px_rgba(99,102,241,0.4)] hover:from-glass-accent-light hover:to-glass-accent hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:-translate-y-px active:translate-y-0"
    >
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
        <div className="flex flex-col gap-3">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <ShortcutItem key={shortcut.title} {...shortcut} />
          ))}
        </div>
      </Section>

      <Section title="Getting Started" icon={<InfoIcon size={14} />}>
        <div className="p-4 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md">
          <ol className="m-0 pl-5 flex flex-col gap-3">
            {GETTING_STARTED_STEPS.map((step, index) => (
              <li
                key={index}
                className="text-[13px] text-glass-text-secondary leading-relaxed"
              >
                <strong className="text-glass-text-primary">
                  {step.title}
                </strong>{' '}
                {step.content}
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section title="How It Works" icon={<InfoIcon size={14} />}>
        <div className="p-4 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md">
          <ul className="m-0 pl-5 flex flex-col gap-2.5">
            {HOW_IT_WORKS.map((item) => (
              <li
                key={item.title}
                className="text-[13px] text-glass-text-secondary leading-relaxed"
              >
                <strong className="text-glass-text-primary">
                  {item.title}
                </strong>{' '}
                {item.description}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Tips" icon={<InfoIcon size={14} />}>
        <div className="p-4 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md">
          <ul className="m-0 pl-5 flex flex-col gap-2.5">
            {TIPS.map((tip, index) => (
              <li
                key={index}
                className="text-[13px] text-glass-text-secondary leading-relaxed"
              >
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
