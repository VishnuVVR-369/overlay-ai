/**
 * Preload Script - Secure bridge between Main and Renderer
 *
 * Per PLAN.md Phase 5:
 * Expose IPC methods via contextBridge for secure communication.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { exposeElectronTRPC } from 'electron-trpc/main';
import { IPC_CHANNELS } from '../lib/ipc';

// Get all valid channel names from IPC_CHANNELS
const VALID_CHANNELS = Object.values(IPC_CHANNELS);

// ============================================================================
// Expose electron-trpc
// ============================================================================

// This is required for electron-trpc to work
process.once('loaded', async () => {
  exposeElectronTRPC();
});

// ============================================================================
// Expose IPC API
// ============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke a main process handler and get a response
   */
  invoke: <T>(channel: string, data?: unknown): Promise<T> => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

  /**
   * Listen for events from main process
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },

  /**
   * Send a one-way message to main process
   */
  send: (channel: string, data?: unknown): void => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      ipcRenderer.send(channel, data);
    }
  },
});
