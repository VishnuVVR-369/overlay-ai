import React from 'react';

interface ConfigWarningProps {
  isDeepgramConfigured: boolean;
  isGroqConfigured: boolean;
}

export function ConfigWarning({
  isDeepgramConfigured,
  isGroqConfigured,
}: ConfigWarningProps): React.ReactElement | null {
  if (isDeepgramConfigured && isGroqConfigured) {
    return null;
  }

  const missingKeys: string[] = [];
  if (!isDeepgramConfigured) {
    missingKeys.push('Set DEEPGRAM_API_KEY for transcription');
  }
  if (!isGroqConfigured) {
    missingKeys.push('Set GROQ_API_KEY for LLM answers');
  }

  return (
    <div className="glass-warning">
      <div className="glass-warning-icon">!</div>
      <div>
        <h4>Configuration Required</h4>
        <ul>
          {missingKeys.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ConfigWarning;
