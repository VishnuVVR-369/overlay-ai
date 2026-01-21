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
    <header className="shrink-0 px-4 py-3 flex items-center justify-between gap-3 glass-panel border-b border-glass-border-subtle draggable">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-[28px] h-[28px] bg-gradient-to-br from-glass-accent to-glass-accent-dark rounded-lg flex items-center justify-center shadow-glass-glow">
          <LogoIcon size={14} strokeWidth={2.5} className="text-white" />
        </div>
        <span className="text-[14px] font-semibold text-glass-text-primary tracking-tight">
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
      className="w-[36px] h-[36px] p-0 bg-glass-bg-primary border border-glass-border-subtle rounded-glass-sm text-glass-text-muted cursor-pointer flex items-center justify-center transition-all duration-glass-fast hover:bg-glass-bg-hover hover:text-glass-text-primary hover:border-glass-border-default active:scale-95"
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

export default Header;
