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
    <header
      className="glass-header draggable"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="glass-header-left">
        <div className="glass-logo-mark">
          <LogoIcon size={14} strokeWidth={2.5} />
        </div>
        <span className="glass-logo-text">Overlay AI</span>
        <StatusBadge state={liveModeState} error={liveModeError} />
      </div>

      <div
        className="glass-header-right non-draggable"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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
      className="glass-header-btn"
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}

export default Header;
