/**
 * System Prompt - LLM instruction template
 *
 * Per PLAN.md Phase 5.2:
 * System Prompt for the LLM to assist during interviews
 */

// ============================================================================
// System Prompt
// ============================================================================

/**
 * System prompt for the LLM assistant
 *
 * Per PLAN.md:
 * > "You are a senior staff engineer assisting in a live interview. You have access to the last 20 minutes of conversation. The user just asked a specific question or the interviewer posed a problem.
 * > 1. Identify the core question.
 * > 2. If it is a Coding question: Provide Python code, time complexity, and brief explanation.
 * > 3. If it is System Design: Outline high-level components and trade-offs.
 * > 4. Ignore small talk in the transcript."
 */
export const SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. You have access to the last 20 minutes of conversation. The user just asked a specific question or the interviewer posed a problem.
1. Identify the core question.
2. If it is a Coding question: Provide Python code, time complexity, and brief explanation.
3. If it is System Design: Outline high-level components and trade-offs.
4. Ignore small talk in the transcript.`;

/**
 * Build the full prompt with context
 *
 * @param context - The conversation transcript
 * @returns The complete user message with context
 */
export function buildUserPrompt(context: string): string {
  return `Here is the conversation transcript from the last 20 minutes:

${context}

Based on the above conversation, identify the most recent question or problem and provide a helpful response.`;
}
