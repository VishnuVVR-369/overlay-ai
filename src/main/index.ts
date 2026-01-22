import { config } from 'dotenv';
import path from 'path';
import { app, BrowserWindow, globalShortcut } from 'electron';

if (!app.isPackaged) {
  config({ path: path.join(__dirname, '../../../.env') });
}
console.log('[ENV] DEEPGRAM_API_KEY set:', !!process.env.DEEPGRAM_API_KEY);
console.log('[ENV] GROQ_API_KEY set:', !!process.env.GROQ_API_KEY);
console.log('[ENV] ALLOW_SCREEN_SHARING:', process.env.ALLOW_SCREEN_SHARING);

import {
  initializeIPC,
  cleanupIPC,
  toggleLiveMode,
  triggerAnswer,
  clearOverlay,
  toggleMinimizeMode,
  applyMinimizeMode,
} from './ipc';
import { StealthWindowManager, getNativeWindowHandle } from './macos';

try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed
}

let mainWindow: BrowserWindow | null = null;
let stealthManager: StealthWindowManager | null = null;

const WINDOW_CONFIG = {
  width: 400,
  height: 450,
  transparent: true,
  frame: false,
  movable: true,
  alwaysOnTop: true,
  hasShadow: false,
  backgroundColor: '#00000000',
} as const;

const SHORTCUTS = [
  { key: 'CommandOrControl+Shift+L', action: toggleLiveMode, name: 'Live' },
  { key: 'CommandOrControl+Shift+X', action: triggerAnswer, name: 'Answer' },
  { key: 'CommandOrControl+Shift+Z', action: clearOverlay, name: 'Clear' },
  {
    key: 'CommandOrControl+Shift+M',
    action: toggleMinimizeMode,
    name: 'Minimize',
  },
] as const;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...WINDOW_CONFIG,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const allowScreenSharing =
    !app.isPackaged && process.env.ALLOW_SCREEN_SHARING === 'true';
  const useContentProtection = !allowScreenSharing;

  stealthManager = new StealthWindowManager(mainWindow, {
    useContentProtection,
    useNativeSharingType: false,
  });
  stealthManager.enableStealth();

  if (app.isPackaged) {
    console.log(
      '[Security] Production build: Content protection always enabled'
    );
  } else if (allowScreenSharing) {
    console.log(
      '[Security] Development: Screen sharing enabled (visible to screenshots/screen share)'
    );
  } else {
    console.log(
      '[Security] Development: Content protection enabled (invisible to screenshots/screen share)'
    );
  }

  const nativeHandle = getNativeWindowHandle(mainWindow);
  if (nativeHandle.isValid) {
    console.log(
      `[Window] Native handle: platform=${nativeHandle.platform}, size=${nativeHandle.buffer.length}b`
    );
  }

  initializeIPC(mainWindow);
  applyMinimizeMode(false);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    cleanupIPC();
    stealthManager = null;
    mainWindow = null;
  });
}

function registerShortcuts(): void {
  for (const shortcut of SHORTCUTS) {
    globalShortcut.register(shortcut.key, async () => {
      try {
        await shortcut.action();
      } catch (error) {
        console.error(`[Shortcut] ${shortcut.name} failed:`, error);
      }
    });
  }
  const names = SHORTCUTS.map((s) => s.name).join(', ');
  console.log(`[Shortcuts] Registered: ${names}`);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
  createWindow();
  registerShortcuts();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  cleanupIPC();
});
