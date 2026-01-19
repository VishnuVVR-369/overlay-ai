import { contextBridge, ipcRenderer } from 'electron';
import { exposeElectronTRPC } from 'electron-trpc/main';
import { IPC_CHANNELS } from '../lib/ipc';

const VALID_CHANNELS = Object.values(IPC_CHANNELS);

process.once('loaded', async () => {
  exposeElectronTRPC();
});

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: <T>(channel: string, data?: unknown): Promise<T> => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },

  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },

  send: (channel: string, data?: unknown): void => {
    if (VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
      ipcRenderer.send(channel, data);
    }
  },
});
