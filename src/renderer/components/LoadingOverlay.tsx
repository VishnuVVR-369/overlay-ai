import React from 'react';

export function LoadingOverlay(): React.ReactElement {
  return (
    <div className="glass-container relative flex flex-col h-screen max-h-screen overflow-hidden bg-glass-bg-deep backdrop-blur-glass-xl">
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="w-9 h-9 border-2 border-glass-border-default border-t-glass-accent rounded-full animate-glass-spin mb-4" />
        <p className="text-sm text-glass-text-muted font-mono">
          INITIALIZING...
        </p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
