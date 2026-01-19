import type { BrowserWindow } from 'electron';

export const NSWindowSharingType = {
  NSWindowSharingReadOnly: 1,
  NSWindowSharingNone: 0,
  NSWindowSharingReadWrite: 2,
} as const;

export type NSWindowSharingTypeValue =
  (typeof NSWindowSharingType)[keyof typeof NSWindowSharingType];

export interface StealthWindowConfig {
  useContentProtection: boolean;
  useNativeSharingType: boolean;
  sharingType: NSWindowSharingTypeValue;
}

export const DEFAULT_STEALTH_CONFIG: StealthWindowConfig = {
  useContentProtection: true,
  useNativeSharingType: false,
  sharingType: NSWindowSharingType.NSWindowSharingNone,
};

export interface NativeWindowHandle {
  buffer: Buffer;
  platform: 'darwin' | 'win32' | 'linux';
  isValid: boolean;
}

export function getNativeWindowHandle(
  window: BrowserWindow
): NativeWindowHandle {
  try {
    const buffer = window.getNativeWindowHandle();
    return {
      buffer,
      platform: process.platform as 'darwin' | 'win32' | 'linux',
      isValid: buffer.length > 0,
    };
  } catch (error) {
    console.error('[StealthWindow] Failed to get native window handle:', error);
    return {
      buffer: Buffer.alloc(0),
      platform: process.platform as 'darwin' | 'win32' | 'linux',
      isValid: false,
    };
  }
}

export class StealthWindowManager {
  private window: BrowserWindow;
  private config: StealthWindowConfig;
  private nativeHandle: NativeWindowHandle | null = null;

  constructor(
    window: BrowserWindow,
    config: Partial<StealthWindowConfig> = {}
  ) {
    this.window = window;
    this.config = { ...DEFAULT_STEALTH_CONFIG, ...config };
  }

  enableStealth(): void {
    console.log('[StealthWindow] Enabling stealth mode...');

    if (this.config.useContentProtection) {
      this.window.setContentProtection(true);
      console.log('[StealthWindow] Content protection enabled');
    }

    if (this.config.useNativeSharingType && process.platform === 'darwin') {
      this.nativeHandle = getNativeWindowHandle(this.window);
      console.log('[StealthWindow] Native sharing type not implemented yet');
    }
  }

  disableStealth(): void {
    console.log('[StealthWindow] Disabling stealth mode...');

    if (this.config.useContentProtection) {
      this.window.setContentProtection(false);
      console.log('[StealthWindow] Content protection disabled');
    }
  }

  getConfig(): Readonly<StealthWindowConfig> {
    return { ...this.config };
  }

  getNativeHandle(): Readonly<NativeWindowHandle> | null {
    return this.nativeHandle ? { ...this.nativeHandle } : null;
  }

  static isMacOS(): boolean {
    return process.platform === 'darwin';
  }
}

export function enableStealthMode(window: BrowserWindow): StealthWindowManager {
  const manager = new StealthWindowManager(window);
  manager.enableStealth();
  return manager;
}

export function isStealthSupported(): boolean {
  return true;
}

export function isNativeStealthAvailable(): boolean {
  return false;
}
