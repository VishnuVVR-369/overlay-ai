import React from 'react';

interface ToastProps {
  message: string | null;
  visible: boolean;
}

export function Toast({
  message,
  visible,
}: ToastProps): React.ReactElement | null {
  if (!visible || !message) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 px-4 py-3.5 bg-glass-bg-elevated border border-glass-error/25 rounded-glass-md backdrop-blur-glass-lg shadow-glass-md flex items-center gap-3 max-w-[340px] animate-glass-slide-up">
      <div className="shrink-0 w-5 h-5 rounded-full bg-glass-error/12 flex items-center justify-center text-glass-error text-[11px] font-bold">
        !
      </div>
      <p className="text-sm text-glass-text-primary">{message}</p>
    </div>
  );
}

export default Toast;
