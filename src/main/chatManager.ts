/**
 * Chat Manager
 *
 * Manages chat sessions, message history, and LLM interactions for the chat window.
 */

import { EventEmitter } from 'events';
import { getDefaultGroqProvider, LLMError } from './llm';
import { getDefaultContextBuffer } from './contextBuffer';
import { isGroqConfiguredFromSettings } from './settingsStore';
import {
  ChatMessage,
  ChatState,
  createChatMessage,
  type SendMessageOptions,
} from '../lib/chat';
import { IPC_CHANNELS, type IPCEvents } from '../lib/ipc';

const CHAT_SYSTEM_PROMPT = `You are a senior staff engineer assisting in a live interview. The user can ask questions and you provide helpful, concise answers. You have access to the last 20 minutes of conversation when the user includes it.

Guidelines:
- Be direct and concise
- For coding questions: Provide code with brief explanation
- For system design: Outline key components and trade-offs
- For conceptual questions: Clear explanations with examples
- If transcript is provided, use it to understand context
- Ignore small talk in the transcript

Keep responses conversational but professional.`;

class ChatManager extends EventEmitter {
  private messages: ChatMessage[] = [];
  private isGenerating: boolean = false;
  private lastError: string | null = null;
  private currentGenerationMessageId: string | null = null;

  getHistory(): ChatState {
    return {
      messages: this.messages.filter((m) => m.role !== 'system'),
      isGenerating: this.isGenerating,
      lastError: this.lastError,
    };
  }

  clearHistory(): { success: boolean } {
    this.messages = [];
    this.lastError = null;
    this.broadcastState();
    console.log('[ChatManager] Chat history cleared');
    return { success: true };
  }

  async sendMessage(
    userMessage: string,
    options: SendMessageOptions,
    sendToRenderer: (channel: string, data: IPCEvents[keyof IPCEvents]) => void
  ): Promise<{ success: boolean }> {
    if (this.isGenerating) {
      return { success: false };
    }

    if (!isGroqConfiguredFromSettings()) {
      this.lastError = 'GROQ_API_KEY not configured';
      this.broadcastState(sendToRenderer);
      return { success: false };
    }

    const userMsg = createChatMessage(
      'user',
      userMessage,
      options.includeTranscript
    );
    this.messages.push(userMsg);
    this.lastError = null;

    const assistantMsg = createChatMessage(
      'assistant',
      '',
      options.includeTranscript
    );
    this.messages.push(assistantMsg);
    this.currentGenerationMessageId = assistantMsg.id;

    this.isGenerating = true;
    this.broadcastState(sendToRenderer);

    try {
      const provider = getDefaultGroqProvider();
      const modelId = provider.getDefaultModelId();

      let transcriptContext = '';
      if (options.includeTranscript) {
        const buffer = getDefaultContextBuffer();
        transcriptContext = buffer.getFullContext();
      }

      const messages = this.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      if (transcriptContext) {
        const contextMessage = {
          role: 'system' as const,
          content: `Current transcript context:\n${transcriptContext}`,
        };
        messages.unshift(contextMessage);
      }

      const chunks: string[] = [];
      for await (const chunk of provider.streamChatResponse(
        messages,
        CHAT_SYSTEM_PROMPT,
        modelId
      )) {
        chunks.push(chunk);
        assistantMsg.content = chunks.join('');

        sendToRenderer(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, {
          messageId: assistantMsg.id,
          chunk,
          isComplete: false,
        });
      }

      sendToRenderer(IPC_CHANNELS.CHAT_RESPONSE_CHUNK, {
        messageId: assistantMsg.id,
        chunk: '',
        isComplete: true,
      });

      console.log(`[ChatManager] Response complete: ${chunks.length} chunks`);
    } catch (error) {
      console.error('[ChatManager] Error generating response:', error);

      let errorMessage = 'Unknown error';
      if (error instanceof LLMError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.lastError = errorMessage;

      if (this.currentGenerationMessageId) {
        const msgIndex = this.messages.findIndex(
          (m) => m.id === this.currentGenerationMessageId
        );
        if (msgIndex >= 0) {
          this.messages.splice(msgIndex, 1);
        }
      }

      console.error('[ChatManager] LLM error:', error);
    } finally {
      this.isGenerating = false;
      this.currentGenerationMessageId = null;
      this.broadcastState(sendToRenderer);
    }

    return { success: true };
  }

  private broadcastState(
    sendToRenderer?: (channel: string, data: IPCEvents[keyof IPCEvents]) => void
  ): void {
    const state = this.getHistory();
    this.emit('stateChanged', state);

    if (sendToRenderer) {
      sendToRenderer(IPC_CHANNELS.CHAT_STATE_CHANGED, state);
    }
  }
}

let chatManager: ChatManager | null = null;

export function getChatManager(): ChatManager {
  if (!chatManager) {
    chatManager = new ChatManager();
  }
  return chatManager;
}

export function destroyChatManager(): void {
  if (chatManager) {
    chatManager.removeAllListeners();
    chatManager = null;
  }
}
