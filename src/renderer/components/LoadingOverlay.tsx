import React from 'react';

export function LoadingOverlay(): React.ReactElement {
  return (
    <div className="glass-container flex items-center justify-center">
      <div className="glass-loading">
        <div className="glass-loading-spinner" />
        <p className="glass-loading-text font-mono">INITIALIZING...</p>
      </div>
    </div>
  );
}

export default LoadingOverlay;
