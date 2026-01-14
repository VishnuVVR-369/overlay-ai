/**
 * Electron Main Process Entry Point
 *
 * Per PLAN.md:
 * - Creates a transparent, frameless overlay window
 * - Enables content protection for stealth mode
 * - Initializes IPC handlers for communication with renderer
 */

// Load environment variables from .env file before anything else
import { config } from 'dotenv';
import path from 'path';
import { app, BrowserWindow, globalShortcut } from 'electron';

// Only load .env file in development mode
// In production (packaged app), environment variables should be set by the user
// or managed through the app's settings
if (!app.isPackaged) {
  // In development, __dirname is dist/main/main/, so go up 3 levels to reach project root
  const envPath = path.join(__dirname, '../../../.env');
  const result = config({ path: envPath });
  console.log('[ENV] Loading .env from:', envPath);
  console.log('[ENV] Result:', result.error ? `Error: ${result.error.message}` : 'Loaded successfully');
}
console.log('[ENV] DEEPGRAM_API_KEY set:', !!process.env.DEEPGRAM_API_KEY);
console.log('[ENV] GROQ_API_KEY set:', !!process.env.GROQ_API_KEY);

import { initializeIPC, cleanupIPC, toggleLiveMode, triggerAnswer, clearOverlay } from './ipc';
import { StealthWindowManager, getNativeWindowHandle } from './macos';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Note: electron-squirrel-startup may not be installed - handle gracefully
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, ignore
}

let mainWindow: BrowserWindow | null = null;
let stealthManager: StealthWindowManager | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  // Create the browser window with transparent, frameless settings for overlay
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    movable: true, // Allow window to be dragged
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000', // Required for transparent windows to show CSS backgrounds
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for electron-trpc
    },
  });

  // Make window visible on all workspaces/Spaces including fullscreen apps (macOS)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Stealth Mode: Hide window from screen capture software
  // Per PLAN.md Phase 6:
  // - MVP: Use Electron's setContentProtection(true)
  // - Native: Use NSWindowSharingNone via FFI (placeholder for future)
  stealthManager = new StealthWindowManager(mainWindow, {
    useContentProtection: true,
    useNativeSharingType: false, // Enable when FFI is implemented
  });
  stealthManager.enableStealth();

  // Log native window handle for debugging (Phase 7 requirement)
  const nativeHandle = getNativeWindowHandle(mainWindow);
  if (nativeHandle.isValid) {
    console.log(
      `[Window] Native handle retrieved: platform=${nativeHandle.platform}, size=${nativeHandle.buffer.length} bytes`
    );
  } else {
    console.warn('[Window] Failed to retrieve native window handle');
  }

  // Initialize IPC handlers
  initializeIPC(mainWindow);

  // Load the Vite dev server in development, or the built renderer in production
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, __dirname is dist/main/main/, so we go up 2 levels to dist/
    // then into renderer/ to find index.html
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    cleanupIPC();
    stealthManager = null;
    mainWindow = null;
  });
}

/**
 * Register global shortcuts
 * Per PLAN.md Phase 7:
 * - Cmd+Shift+X: Trigger Answer
 * - Cmd+Shift+Z: Clear Overlay
 * - Cmd+Shift+L: Toggle Live Mode
 */
function registerShortcuts() {
  // Cmd+Shift+L: Toggle Live Mode (connect/disconnect audio + Deepgram)
  globalShortcut.register('CommandOrControl+Shift+L', async () => {
    console.log('[Shortcut] Toggle Live Mode');
    try {
      const status = await toggleLiveMode();
      console.log('[Shortcut] Live mode status:', status.state);
    } catch (error) {
      console.error('[Shortcut] Failed to toggle live mode:', error);
    }
  });

  // Cmd+Shift+X: Trigger Answer (send context to LLM)
  globalShortcut.register('CommandOrControl+Shift+X', async () => {
    console.log('[Shortcut] Trigger Answer');
    try {
      const answer = await triggerAnswer();
      console.log('[Shortcut] Answer state:', answer.state);
    } catch (error) {
      console.error('[Shortcut] Failed to trigger answer:', error);
    }
  });

  // Cmd+Shift+Z: Clear Overlay (clear transcript and answer)
  globalShortcut.register('CommandOrControl+Shift+Z', () => {
    console.log('[Shortcut] Clear Overlay');
    clearOverlay();
  });

  console.log('[Shortcuts] Registered: Cmd+Shift+L (Live), Cmd+Shift+X (Answer), Cmd+Shift+Z (Clear)');
}

/**
 * Unregister all global shortcuts
 */
function unregisterShortcuts() {
  globalShortcut.unregisterAll();
  console.log('[Shortcuts] Unregistered all');
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Stealth Mode: Hide from Dock and Cmd+Tab on macOS
  // This makes the app an "accessory" application that doesn't appear in:
  // - The Dock
  // - Cmd+Tab application switcher
  // - Force Quit dialog
  // Note: LSUIElement in Info.plist (via electron-builder) handles this for production builds
  // This call ensures it works during development as well
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
    console.log('[Stealth] Hidden from Dock and Cmd+Tab switcher');
  }

  createWindow();
  registerShortcuts();
});

// Quit when all windows are closed (including on macOS)
app.on('window-all-closed', () => {
  app.quit();
});

// Clean up before quitting
app.on('will-quit', () => {
  unregisterShortcuts();
  cleanupIPC();
});
