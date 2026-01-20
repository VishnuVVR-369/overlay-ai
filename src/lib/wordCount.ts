export function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

const TOKENS_PER_WORD = 1.33;

export function estimateTokens(wordCount: number): number {
  return Math.ceil(wordCount * TOKENS_PER_WORD);
}

export function estimateTokensFromText(text: string): number {
  return estimateTokens(countWords(text));
}

const AVERAGE_WPM = 135;

export function estimateDurationMs(wordCount: number): number {
  const minutes = wordCount / AVERAGE_WPM;
  return Math.ceil(minutes * 60 * 1000);
}

export function estimateWordsFromDuration(durationMs: number): number {
  const minutes = durationMs / (60 * 1000);
  return Math.ceil(minutes * AVERAGE_WPM);
}
