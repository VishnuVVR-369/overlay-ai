/**
 * macOS Window Sharing Type - Native NSWindowSharingNone implementation
 *
 * Per PLAN.md Phase 6:
 * On macOS, `NSWindow` has a property called `sharingType`. Setting this to
 * `NSWindowSharingNone` makes the window invisible to screen capture software
 * (Zoom, Teams, OBS) but visible to the user.
 *
 * This module provides:
 * 1. MVP: Use Electron's setContentProtection(true) - already implemented
 * 2. Native: FFI-based NSWindowSharingNone for more reliable stealth
 *
 * Implementation Status:
 * - MVP (setContentProtection): ✅ Implemented in index.ts
 * - Native (NSWindowSharingNone): 🔲 Placeholder - requires ffi-napi or native module
 */

import type { BrowserWindow } from 'electron';

// ============================================================================
// NSWindow Sharing Type Constants
// ============================================================================

/**
 * NSWindowSharingType values from macOS AppKit
 *
 * @see https://developer.apple.com/documentation/appkit/nswindowsharingtype
 */
export const NSWindowSharingType = {
  /** Window contents can be read and shared */
  NSWindowSharingReadOnly: 1,
  /** Window contents cannot be captured or shared */
  NSWindowSharingNone: 0,
  /** Window contents can be read but not written */
  NSWindowSharingReadWrite: 2,
} as const;

export type NSWindowSharingTypeValue =
  (typeof NSWindowSharingType)[keyof typeof NSWindowSharingType];

// ============================================================================
// Stealth Window Configuration
// ============================================================================

/**
 * Configuration for stealth window behavior
 */
export interface StealthWindowConfig {
  /** Use Electron's setContentProtection (MVP approach) */
  useContentProtection: boolean;
  /** Use native NSWindowSharingNone (requires FFI) */
  useNativeSharingType: boolean;
  /** The sharing type to set when using native approach */
  sharingType: NSWindowSharingTypeValue;
}

/**
 * Default stealth configuration
 * MVP: Use setContentProtection only
 */
export const DEFAULT_STEALTH_CONFIG: StealthWindowConfig = {
  useContentProtection: true,
  useNativeSharingType: false, // FFI not implemented yet
  sharingType: NSWindowSharingType.NSWindowSharingNone,
};

// ============================================================================
// Native Window Handle
// ============================================================================

/**
 * Result of retrieving the native window handle
 */
export interface NativeWindowHandle {
  /** The raw buffer containing the native handle */
  buffer: Buffer;
  /** Platform identifier */
  platform: 'darwin' | 'win32' | 'linux';
  /** Whether the handle is valid */
  isValid: boolean;
}

/**
 * Get the native window handle from an Electron BrowserWindow
 *
 * On macOS, this returns a pointer to the NSWindow object.
 * On Windows, this returns an HWND.
 *
 * @param window - The Electron BrowserWindow
 * @returns The native window handle info
 */
export function getNativeWindowHandle(window: BrowserWindow): NativeWindowHandle {
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

// ============================================================================
// FFI Native Library Interface (Placeholder)
// ============================================================================

/**
 * Native library interface for setting window sharing type
 *
 * PLACEHOLDER: This interface defines the contract for the native FFI module.
 * Actual implementation requires:
 * 1. Install ffi-napi: npm install ffi-napi ref-napi
 * 2. Create a small .dylib that accepts NSWindow* and calls setSharingType:
 *
 * Objective-C implementation (for reference):
 * ```objc
 * // stealth.m
 * #import <Cocoa/Cocoa.h>
 *
 * void setWindowSharingType(void* windowPtr, int sharingType) {
 *     NSWindow* window = (__bridge NSWindow*)windowPtr;
 *     [window setSharingType:(NSWindowSharingType)sharingType];
 * }
 * ```
 *
 * FFI binding (pseudocode):
 * ```typescript
 * import ffi from 'ffi-napi';
 *
 * const nativeLib = ffi.Library('libstealth.dylib', {
 *     'setWindowSharingType': ['void', ['pointer', 'int']]
 * });
 * ```
 */
export interface NativeStealthLibrary {
  /**
   * Set the window sharing type via native API
   *
   * @param windowHandle - Native window handle (NSWindow* on macOS)
   * @param sharingType - The NSWindowSharingType value
   */
  setWindowSharingType(windowHandle: Buffer, sharingType: number): void;
}

/**
 * Placeholder native library implementation
 *
 * This is a no-op stub that logs calls for debugging.
 * Replace with actual ffi-napi implementation when ready.
 */
const placeholderNativeLib: NativeStealthLibrary = {
  setWindowSharingType(windowHandle: Buffer, sharingType: number): void {
    console.log(
      `[StealthWindow] PLACEHOLDER: setWindowSharingType called with handle size=${windowHandle.length}, sharingType=${sharingType}`
    );
    console.log(
      '[StealthWindow] NOTE: Native NSWindowSharingNone not implemented. Using Electron setContentProtection as fallback.'
    );
  },
};

// ============================================================================
// Stealth Window Manager
// ============================================================================

/**
 * Manages stealth/ghost mode for the overlay window
 *
 * Per PLAN.md:
 * - MVP: Use win.setContentProtection(true)
 * - Native: Use NSWindowSharingNone via FFI (placeholder)
 *
 * Usage:
 * ```typescript
 * const stealth = new StealthWindowManager(mainWindow);
 * stealth.enableStealth();
 * ```
 */
export class StealthWindowManager {
  private window: BrowserWindow;
  private config: StealthWindowConfig;
  private nativeLib: NativeStealthLibrary;
  private nativeHandle: NativeWindowHandle | null = null;

  constructor(
    window: BrowserWindow,
    config: Partial<StealthWindowConfig> = {},
    nativeLib?: NativeStealthLibrary
  ) {
    this.window = window;
    this.config = { ...DEFAULT_STEALTH_CONFIG, ...config };
    this.nativeLib = nativeLib ?? placeholderNativeLib;
  }

  /**
   * Enable stealth mode on the window
   *
   * Applies both MVP (setContentProtection) and native (NSWindowSharingNone)
   * approaches based on configuration.
   */
  enableStealth(): void {
    console.log('[StealthWindow] Enabling stealth mode...');

    // MVP approach: Electron's setContentProtection
    if (this.config.useContentProtection) {
      this.window.setContentProtection(true);
      console.log('[StealthWindow] Content protection enabled (MVP)');
    }

    // Native approach: NSWindowSharingNone via FFI
    if (this.config.useNativeSharingType && process.platform === 'darwin') {
      this.applyNativeSharingType();
    }
  }

  /**
   * Disable stealth mode on the window
   */
  disableStealth(): void {
    console.log('[StealthWindow] Disabling stealth mode...');

    if (this.config.useContentProtection) {
      this.window.setContentProtection(false);
      console.log('[StealthWindow] Content protection disabled');
    }

    // Note: NSWindowSharingNone cannot be easily "undone" without
    // setting it back to NSWindowSharingReadOnly
    if (this.config.useNativeSharingType && process.platform === 'darwin') {
      this.nativeHandle = getNativeWindowHandle(this.window);
      if (this.nativeHandle.isValid) {
        this.nativeLib.setWindowSharingType(
          this.nativeHandle.buffer,
          NSWindowSharingType.NSWindowSharingReadOnly
        );
      }
    }
  }

  /**
   * Apply native NSWindowSharingNone via FFI
   */
  private applyNativeSharingType(): void {
    this.nativeHandle = getNativeWindowHandle(this.window);

    if (!this.nativeHandle.isValid) {
      console.warn('[StealthWindow] Invalid native window handle, skipping native stealth');
      return;
    }

    if (this.nativeHandle.platform !== 'darwin') {
      console.warn('[StealthWindow] Native stealth only supported on macOS');
      return;
    }

    // Call the native library (placeholder for now)
    this.nativeLib.setWindowSharingType(
      this.nativeHandle.buffer,
      this.config.sharingType
    );
    console.log('[StealthWindow] Native sharing type applied (placeholder)');
  }

  /**
   * Get the current stealth configuration
   */
  getConfig(): Readonly<StealthWindowConfig> {
    return { ...this.config };
  }

  /**
   * Get the native window handle (if retrieved)
   */
  getNativeHandle(): Readonly<NativeWindowHandle> | null {
    return this.nativeHandle ? { ...this.nativeHandle } : null;
  }

  /**
   * Check if running on macOS
   */
  static isMacOS(): boolean {
    return process.platform === 'darwin';
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Enable stealth mode on a window with default settings
 *
 * This is a convenience function that:
 * 1. Calls setContentProtection(true) - MVP
 * 2. Attempts native NSWindowSharingNone - placeholder
 *
 * @param window - The Electron BrowserWindow to make stealthy
 * @returns The StealthWindowManager instance for further control
 */
export function enableStealthMode(window: BrowserWindow): StealthWindowManager {
  const manager = new StealthWindowManager(window);
  manager.enableStealth();
  return manager;
}

/**
 * Quick check if the current platform supports stealth mode
 */
export function isStealthSupported(): boolean {
  // Content protection is supported on all platforms
  // Native NSWindowSharingNone is macOS only
  return true;
}

/**
 * Quick check if native NSWindowSharingNone is available
 */
export function isNativeStealthAvailable(): boolean {
  // Placeholder: Will return true when ffi-napi is implemented
  return false;
}
