//! macOS System Audio Capture via ScreenCaptureKit
//!
//! This module provides system audio capture functionality for macOS using ScreenCaptureKit.
//! Per PLAN.md:
//! - Uses ScreenCaptureKit for system audio capture (macOS 12.3+)
//! - Requires "Screen Recording" permission in System Preferences
//! - Outputs audio to Channel 0 (Interviewer/System audio)
//!
//! The audio is captured at the configured sample rate and pushed to a ring buffer
//! for mixing with microphone audio.

#[cfg(target_os = "macos")]
mod macos_impl;

#[cfg(not(target_os = "macos"))]
mod stub_impl;

#[cfg(target_os = "macos")]
pub use macos_impl::SystemAudioCapture;

#[cfg(not(target_os = "macos"))]
pub use stub_impl::SystemAudioCapture;

#[cfg(target_os = "macos")]
pub mod ffi;
#[cfg(target_os = "macos")]
mod handler;
