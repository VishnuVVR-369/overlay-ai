import React from 'react';
import { StatusBadge } from './StatusIndicator';
import {
  LogoIcon,
  SettingsIcon,
  HelpIcon,
  CloseIcon,
  MinimizeIcon,
} from './Icons';
import type { LiveModeState } from '../types';

interface HeaderProps {
  liveModeState: LiveModeState;
  liveModeError?: string;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function Header({
  liveModeState,
  liveModeError,
  onOpenHelp,
  onOpenSettings,
  onMinimize,
  onClose,
}: HeaderProps): React.ReactElement {
  return (
    <header className="shrink-0 px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-glass-border-subtle bg-glass-bg-secondary backdrop-blur-glass-lg draggable">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-[26px] h-[26px] bg-gradient-to-br from-glass-accent to-glass-accent-dark rounded-md flex items-center justify-center shadow-[0_2px_6px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]">
          <LogoIcon size={14} strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold text-glass-text-primary tracking-tight">
          Overlay AI
        </span>
        <StatusBadge state={liveModeState} error={liveModeError} />
      </div>

      <div className="flex items-center gap-1 shrink-0 non-draggable">
        <HeaderButton
          onClick={onOpenHelp}
          title="Help and Instructions"
          ariaLabel="Open help"
          icon={<HelpIcon size={15} />}
        />
        <HeaderButton
          onClick={onOpenSettings}
          title="Settings"
          ariaLabel="Open settings"
          icon={<SettingsIcon size={15} />}
        />
        <HeaderButton
          onClick={onMinimize}
          title="Minimize (Cmd+Shift+M)"
          ariaLabel="Minimize overlay"
          icon={<MinimizeIcon size={16} />}
        />
        <HeaderButton
          onClick={onClose}
          title="Close"
          ariaLabel="Close window"
          icon={<CloseIcon size={15} />}
        />
      </div>
    </header>
  );
}

interface HeaderButtonProps {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  icon: React.ReactNode;
}

function HeaderButton({
  onClick,
  title,
  ariaLabel,
  icon,
}: HeaderButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 p-0 bg-transparent border-none rounded-glass-sm text-glass-text-muted cursor-pointer flex items-center justify-center transition-all duration-glass-fast hover:bg-glass-bg-hover hover:text-glass-text-primary active:bg-glass-bg-active"
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

export default Header;
