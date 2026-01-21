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
    <div className="glass-warning shrink-0 mx-3 px-3.5 py-2.5 bg-glass-warning/[0.05] border border-glass-warning/20 rounded-glass-md flex items-start gap-3">
      <div className="shrink-0 w-5 h-5 rounded-full bg-glass-warning/12 flex items-center justify-center text-glass-warning text-[11px] font-bold">
        !
      </div>
      <div>
        <h4 className="text-[13px] font-semibold text-glass-warning mb-2">
          Configuration Required
        </h4>
        <ul className="m-0 p-0 list-none">
          {missingKeys.map((message) => (
            <li
              key={message}
              className="text-[13px] text-glass-warning/90 pl-3.5 relative mb-0.5 leading-relaxed"
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
