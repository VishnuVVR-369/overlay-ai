import React from 'react';

interface ConfigWarningProps {
  isElevenLabsConfigured: boolean;
  isGroqConfigured: boolean;
}

export function ConfigWarning({
  isElevenLabsConfigured,
  isGroqConfigured,
}: ConfigWarningProps): React.ReactElement | null {
  if (isElevenLabsConfigured && isGroqConfigured) {
    return null;
  }

  const missingKeys: string[] = [];
  if (!isElevenLabsConfigured) {
    missingKeys.push('Set ELEVENLABS_API_KEY for transcription');
  }
  if (!isGroqConfigured) {
    missingKeys.push('Set GROQ_API_KEY for LLM answers');
  }

  return (
    <div className="glass-warning shrink-0 mx-3 px-3.5 py-2.5 bg-glass-warning/[0.08] border border-glass-warning/20 rounded-glass-md flex items-start gap-3">
      <div className="shrink-0 w-5 h-5 rounded-full bg-glass-warning/15 flex items-center justify-center text-glass-warning text-xs font-bold">
        !
      </div>
      <div>
        <h4 className="text-xs font-semibold text-glass-warning mb-1.5">
          Configuration Required
        </h4>
        <ul className="m-0 p-0 list-none">
          {missingKeys.map((message) => (
            <li
              key={message}
              className="text-xs text-glass-warning/80 pl-3.5 relative mb-0.5"
            >
              {message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ConfigWarning;
