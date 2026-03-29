export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  includeTranscript: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isGenerating: boolean;
  lastError: string | null;
}

export interface SendMessageOptions {
  includeTranscript: boolean;
  context?: string;
}

export function formatChatWithTranscript(
  userMessage: string,
  transcriptContext: string
): string {
  if (!transcriptContext) {
    return userMessage;
  }

  return `Conversation Context:\n${transcriptContext}\n\nUser Question: ${userMessage}`;
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createChatMessage(
  role: ChatRole,
  content: string,
  includeTranscript: boolean
): ChatMessage {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: Date.now(),
    includeTranscript,
  };
}
