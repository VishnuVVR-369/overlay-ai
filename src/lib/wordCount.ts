/**
 * Word Count Utility
 *
 * Per PLAN.md Phase 4:
 * Simple split-based approach for computing word count.
 * Used for token estimation in the context buffer.
 *
 * Token Estimation (per PLAN.md):
 * - 20 minutes ≈ 3,000 words ≈ 4,000 tokens
 * - Rough ratio: 1 word ≈ 1.33 tokens
 */

// ============================================================================
// Word Count
// ============================================================================

/**
 * Count words in a string using simple whitespace splitting
 *
 * This is a minimal implementation as specified in the plan.
 * For more accurate counts, consider handling:
 * - Contractions (e.g., "don't" = 1 or 2 words?)
 * - Hyphenated words
 * - Numbers and special characters
 *
 * @param text - The text to count words in
 * @returns Number of words
 */
export function countWords(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  // Split on whitespace and filter out empty strings
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count from word count
 *
 * Per PLAN.md:
 * - 20 minutes ≈ 3,000 words ≈ 4,000 tokens
 * - Ratio: ~1.33 tokens per word
 *
 * This is a rough estimate. Actual token counts vary by:
 * - Language and vocabulary
 * - Tokenizer used (GPT, Claude, etc.)
 * - Presence of code, numbers, special characters
 *
 * @param wordCount - Number of words
 * @returns Estimated token count
 */
export function estimateTokens(wordCount: number): number {
  // Using 1.33 ratio from PLAN.md calculation (4000/3000)
  const TOKENS_PER_WORD = 1.33;
  return Math.ceil(wordCount * TOKENS_PER_WORD);
}

/**
 * Estimate tokens directly from text
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokensFromText(text: string): number {
  return estimateTokens(countWords(text));
}

// ============================================================================
// Duration Estimation
// ============================================================================

/**
 * Average speaking rate in words per minute
 * Typical conversational speech is 120-150 WPM
 */
const AVERAGE_WPM = 135;

/**
 * Estimate speaking duration from word count
 *
 * @param wordCount - Number of words
 * @returns Estimated duration in milliseconds
 */
export function estimateDurationMs(wordCount: number): number {
  const minutes = wordCount / AVERAGE_WPM;
  return Math.ceil(minutes * 60 * 1000);
}

/**
 * Estimate word count from duration
 *
 * @param durationMs - Duration in milliseconds
 * @returns Estimated word count
 */
export function estimateWordsFromDuration(durationMs: number): number {
  const minutes = durationMs / (60 * 1000);
  return Math.ceil(minutes * AVERAGE_WPM);
}
