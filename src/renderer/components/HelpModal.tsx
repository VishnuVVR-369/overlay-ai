import React from 'react';
import { Modal } from './Modal';
import { KeyboardIcon, InfoIcon } from './Icons';
import { ANSWER_MODE_DEFINITIONS } from '../../lib/answerModes';

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

const ANSWER_SHORTCUTS: ShortcutItemProps[] = ANSWER_MODE_DEFINITIONS.map(
  (mode) => ({
    title: mode.label,
    shortcut: mode.hotkeyDisplay,
    description: mode.description,
  })
);

const KEYBOARD_SHORTCUTS: ShortcutItemProps[] = [
  {
    title: 'Toggle Live Mode',
    shortcut: 'Cmd+Shift+L',
    description:
      'Start or stop audio transcription. Connect/disconnect to Deepgram.',
  },
  {
    title: 'Clear Overlay',
    shortcut: 'Cmd+Shift+Z',
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
    title: '1. Set up your API keys:',
    content: (
      <>
        Click the <strong>Settings</strong> icon (⚙️) in the top-right corner.
        Add your API keys - they&apos;re stored safely on your device.
        You&apos;ll need:
        <br />
        <a
          href="https://console.deepgram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-glass-accent-light no-underline transition-colors duration-glass-fast hover:text-glass-accent hover:underline"
        >
          Deepgram
        </a>{' '}
        for transcription and{' '}
        <a
          href="https://console.groq.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-glass-accent-light no-underline transition-colors duration-glass-fast hover:text-glass-accent hover:underline"
        >
          Groq
        </a>{' '}
        for AI answers.
      </>
    ),
  },
  {
    title: '2. Start listening:',
    content: (
      <>
        Press{' '}
        <kbd className="inline-flex px-1.5 py-0.5 bg-glass-bg-elevated border border-glass-border-subtle rounded font-mono text-[11px] text-glass-text-secondary">
          Cmd+Shift+L
        </kbd>{' '}
        to begin. The green light means it&apos;s recording. Your conversation
        will appear in the transcript panel in real-time.
      </>
    ),
  },
  {
    title: '3. Get help when you need it:',
    content: (
      <>
        Stuck on a question? Press{' '}
        <kbd className="inline-flex px-1.5 py-0.5 bg-glass-bg-elevated border border-glass-border-subtle rounded font-mono text-[11px] text-glass-text-secondary">
          Cmd+Shift+X
        </kbd>{' '}
        for a full answer, or use the mode buttons in the answer panel for a
        hint, clarification, next step, follow-up, or STAR response.
      </>
    ),
  },
  {
    title: '4. Hide when needed:',
    content: (
      <>
        Press{' '}
        <kbd className="inline-flex px-1.5 py-0.5 bg-glass-bg-elevated border border-glass-border-subtle rounded font-mono text-[11px] text-glass-text-secondary">
          Cmd+Shift+M
        </kbd>{' '}
        to minimize the overlay. Click it or press the shortcut again to expand.
        The overlay is invisible to screen sharing tools.
      </>
    ),
  },
];

const HOW_IT_WORKS = [
  {
    title: '🎙️ Real-time transcription',
    description:
      'Everything said is transcribed instantly and shown in the top panel. You can see who spoke (INT for interviewer, YOU for you).',
  },
  {
    title: '💾 Remembers the conversation',
    description:
      'Overlay AI keeps track of the last 20 minutes of your interview. This helps it understand the full context when you ask for help.',
  },
  {
    title: '🤖 AI-powered answers',
    description:
      'When triggered, it analyzes your conversation and can respond as a full answer, short hint, clarifying questions, next best step, follow-up response, or STAR version.',
  },
  {
    title: '👻 Invisible to screen sharing',
    description:
      'The overlay is hidden from Zoom, Teams, and other screen sharing tools. Only you can see it.',
  },
];

const TIPS = [
  '💡 Start Live Mode before your interview begins so the AI has context from the start.',
  '💡 Check the green status indicator - it means everything is working properly.',
  '💡 Use short hint or next best step when you only need a quick nudge mid-answer.',
  '💡 STAR mode is meant for behavioral questions, not technical problem-solving.',
  '💡 You can drag the overlay anywhere on your screen to position it comfortably.',
  '💡 Press Cmd+Shift+Z to clear the display (context is preserved).',
];

const TROUBLESHOOTING = [
  {
    title: 'Nothing being transcribed?',
    description:
      'Make sure Live Mode is on (green indicator). Check your microphone is not muted and API keys are correct in Settings.',
  },
  {
    title: 'Answers not generating?',
    description:
      'Verify your Groq API key in Settings. Also make sure you have at least a few seconds of transcript first and that you are using STAR mode only for behavioral prompts.',
  },
  {
    title: 'Status shows error?',
    description:
      'Open Settings and verify both API keys are valid. You can also try restarting the app.',
  },
];

export function HelpModal({
  isOpen,
  onClose,
}: HelpModalProps): React.ReactElement | null {
  const footer = (
    <button
      onClick={onClose}
      className="px-4 py-2.5 rounded-glass-sm font-sans text-[13px] font-semibold cursor-pointer transition-all duration-glass-fast inline-flex items-center justify-center gap-2 bg-gradient-to-br from-glass-accent to-glass-accent-dark border-none text-white shadow-[0_2px_10px_rgba(155,182,255,0.35)] hover:from-glass-accent-light hover:to-glass-accent hover:shadow-[0_6px_18px_rgba(155,182,255,0.4)] hover:-translate-y-px active:translate-y-0"
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
          {[...KEYBOARD_SHORTCUTS, ...ANSWER_SHORTCUTS].map((shortcut) => (
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

      <Section title="Troubleshooting" icon={<InfoIcon size={14} />}>
        <div className="p-4 bg-glass-bg-secondary border border-glass-border-subtle rounded-glass-md">
          <ul className="m-0 pl-5 flex flex-col gap-3">
            {TROUBLESHOOTING.map((item) => (
              <li
                key={item.title}
                className="text-[13px] text-glass-text-secondary leading-relaxed"
              >
                <strong className="text-glass-text-primary block mb-1">
                  {item.title}
                </strong>
                <span className="text-xs">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </Modal>
  );
}

export default HelpModal;
