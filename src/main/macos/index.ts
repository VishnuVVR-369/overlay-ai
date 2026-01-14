/**
 * macOS Native Module - Exports for macOS-specific functionality
 */

export {
  // Constants
  NSWindowSharingType,
  type NSWindowSharingTypeValue,
  // Configuration
  type StealthWindowConfig,
  DEFAULT_STEALTH_CONFIG,
  // Native handle
  type NativeWindowHandle,
  getNativeWindowHandle,
  // Native library interface
  type NativeStealthLibrary,
  // Manager class
  StealthWindowManager,
  // Convenience functions
  enableStealthMode,
  isStealthSupported,
  isNativeStealthAvailable,
} from './sharingType';
