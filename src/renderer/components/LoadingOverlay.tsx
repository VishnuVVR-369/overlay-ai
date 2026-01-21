import React from 'react';

export function LoadingOverlay(): React.ReactElement {
  return (
    <div className="glass-container relative flex flex-col h-screen max-h-screen overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="w-10 h-10 border-2 border-glass-border-default border-t-glass-accent rounded-full animate-glass-spin mb-5 shadow-glass-xs" />
        <p className="text-sm text-glass-text-secondary font-medium">
          Initializing...
        </p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
