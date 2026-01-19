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
    <div className="glass-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="glass-modal glass-animate-in"
        onClick={handleContentClick}
        style={{
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="glass-modal-header" style={{ flexShrink: 0 }}>
          <h2 className="glass-modal-title">{title}</h2>
          <button
            onClick={onClose}
            className="glass-modal-close"
            aria-label={`Close ${title}`}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div
          className={`glass-modal-body ${scrollable ? 'glass-scrollbar' : ''}`}
          style={{
            flex: 1,
            overflowY: scrollable ? 'auto' : 'visible',
            minHeight: 0,
          }}
        >
          {children}
        </div>

        {footer && (
          <div className="glass-modal-footer" style={{ flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
