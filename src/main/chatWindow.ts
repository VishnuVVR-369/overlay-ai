/**
 * Chat Window Manager
 *
 * Manages the stealth chat window for conversational AI interactions.
 */

import { BrowserWindow, app } from 'electron';
import path from 'path';
import { type IPCEvents } from '../lib/ipc';
import { StealthWindowManager, getNativeWindowHandle } from './macos';

const CHAT_WINDOW_DIMENSIONS = {
  width: 450,
  height: 650,
};

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

class ChatWindowManager {
  private window: BrowserWindow | null = null;
  private stealthManager: StealthWindowManager | null = null;

  create(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) {
      this.focus();
      return this.window;
    }

    const chatWindow = new BrowserWindow({
      width: CHAT_WINDOW_DIMENSIONS.width,
      height: CHAT_WINDOW_DIMENSIONS.height,
      transparent: true,
      frame: false,
      movable: true,
      alwaysOnTop: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      show: false,
    });

    chatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    this.stealthManager = new StealthWindowManager(chatWindow, {
      useContentProtection: true,
      useNativeSharingType: false,
    });
    this.stealthManager.enableStealth();

    const nativeHandle = getNativeWindowHandle(chatWindow);
    if (nativeHandle.isValid) {
      console.log(
        `[ChatWindow] Native handle: platform=${nativeHandle.platform}, size=${nativeHandle.buffer.length} bytes`
      );
    } else {
      console.warn('[ChatWindow] Failed to retrieve native window handle');
    }

    if (isDev) {
      chatWindow.loadURL('http://localhost:5173/chat.html');
      chatWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      chatWindow.loadFile(path.join(__dirname, '../../renderer/chat.html'));
    }

    chatWindow.once('ready-to-show', () => {
      chatWindow.show();
      chatWindow.center();
    });

    chatWindow.on('closed', () => {
      this.window = null;
      this.stealthManager = null;
    });

    this.window = chatWindow;
    console.log('[ChatWindow] Chat window created');

    return chatWindow;
  }

  toggle(): { isOpen: boolean } {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isVisible()) {
        this.close();
        return { isOpen: false };
      } else {
        this.open();
        return { isOpen: true };
      }
    }

    this.create();
    return { isOpen: true };
  }

  open(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.create();
      return;
    }

    this.window.show();
    this.focus();
  }

  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  focus(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
    }
  }

  sendToRenderer<K extends keyof IPCEvents>(
    channel: string,
    data: IPCEvents[K]
  ): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  get isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }
}

let chatWindowManager: ChatWindowManager | null = null;

export function getChatWindowManager(): ChatWindowManager {
  if (!chatWindowManager) {
    chatWindowManager = new ChatWindowManager();
  }
  return chatWindowManager;
}

export function destroyChatWindowManager(): void {
  if (chatWindowManager) {
    chatWindowManager.destroy();
    chatWindowManager = null;
  }
}
