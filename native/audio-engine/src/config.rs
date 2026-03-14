//! Configuration constants for the audio engine
//!
//! This module contains all configuration constants used throughout the audio engine,
//! including sample rates, buffer sizes, and logging intervals.

/// Target sample rate for realtime STT (16kHz as per PLAN.md)
pub const TARGET_SAMPLE_RATE: u32 = 16000;

/// Output channels: Stereo (Channel 0 = System, Channel 1 = Mic)
pub const OUTPUT_CHANNELS: u16 = 2;

/// Ring buffer size in samples (enough for ~1 second of stereo audio at 16kHz)
/// Formula: sample_rate * channels * seconds = 16000 * 2 * 1 = 32000 samples
pub const RING_BUFFER_SIZE: usize = TARGET_SAMPLE_RATE as usize * OUTPUT_CHANNELS as usize * 2;

/// Ring buffer size for system audio (mono, before mixing)
/// Formula: sample_rate * seconds = 16000 * 2 = 32000 samples
pub const SYSTEM_AUDIO_BUFFER_SIZE: usize = TARGET_SAMPLE_RATE as usize * 2;

/// ScreenCaptureKit sample rate (commonly uses 48kHz)
pub const SCREEN_CAPTURE_SAMPLE_RATE: u32 = 48000;

/// Debug logging interval for system audio callbacks
pub const LOG_INTERVAL_DEBUG: usize = 100;

/// Debug logging interval for mixer callbacks
pub const LOG_INTERVAL_MIXER: usize = 500;

/// Output buffer size for reading from ring buffer (in samples)
pub const OUTPUT_BUFFER_SIZE: usize = 1024;

/// Sleep duration when no data is available (milliseconds)
pub const SLEEP_MS_NO_DATA: u64 = 10;

/// Number of stereo channels
pub const STEREO_CHANNELS: usize = 2;

/// Number of initial debug logs to show
pub const DEBUG_LOG_INITIAL_COUNT: usize = 5;

/// Extended debug log count for detailed debugging
pub const DEBUG_LOG_EXTENDED_COUNT: usize = 10;

/// DC blocker pole (closer to 1.0 = more low-frequency preservation)
pub const DC_BLOCKER_R: f32 = 0.995;

/// Low-pass filter Q (Butterworth-ish)
pub const LOWPASS_Q: f32 = 0.707;

/// Low-pass cutoff for anti-aliasing when downsampling (Hz)
/// Keep below Nyquist of target rate (16kHz -> 8kHz). 7.2kHz is conservative.
pub const LOWPASS_CUTOFF_HZ: f32 = 7200.0;
