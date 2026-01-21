import React, { useEffect, useCallback } from 'react';
import { CloseIcon } from './Icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
  scrollable?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxHeight = '90vh',
  scrollable = true,
}: ModalProps): React.ReactElement | null {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/5 backdrop-blur-glass-md flex items-center justify-center z-[100] animate-glass-fade-in max-h-screen overflow-hidden"
      onClick={handleBackdropClick}
    >
      <div
        className="glass-modal relative w-full max-w-[480px] m-5 bg-glass-bg-elevated border border-glass-border-default rounded-glass-lg backdrop-blur-glass-lg shadow-glass-lg overflow-hidden flex flex-col animate-glass-slide-up"
        onClick={handleContentClick}
        style={{ maxHeight }}
      >
        <div className="px-5 py-4 border-b border-glass-border-subtle flex items-center justify-between shrink-0 glass-panel">
          <h2 className="text-[18px] font-semibold text-glass-text-primary flex items-center gap-3">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-glass-sm bg-transparent border-none text-glass-text-muted cursor-pointer flex items-center justify-center transition-all duration-glass-fast hover:bg-glass-bg-hover hover:text-glass-text-primary hover:border hover:border-glass-border-subtle"
            aria-label={`Close ${title}`}
          >
            <CloseIcon size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div
          className={`px-5 py-5 flex-1 min-h-0 ${scrollable ? 'overflow-y-auto glass-scrollbar' : 'overflow-visible'}`}
        >
          {children}
        </div>

        {footer && (
          <div className="px-5 py-4 border-t border-glass-border-subtle flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
