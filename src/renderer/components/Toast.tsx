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
    <div className="glass-toast">
      <div className="glass-toast-icon">!</div>
      <p className="glass-toast-text">{message}</p>
    </div>
  );
}

export default Toast;
