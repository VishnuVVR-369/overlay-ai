//! Custom error types for the audio engine
//!
//! This module provides domain-specific error types for better error handling
//! and more actionable error messages.

use thiserror::Error;

/// Audio engine specific errors
#[derive(Debug, Error)]
#[allow(dead_code)] // Error variants are part of the public API and used in tests
pub enum AudioEngineError {
    /// Device not found error
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    /// Unsupported sample format error
    #[error("Unsupported sample format: {0:?}")]
    UnsupportedFormat(cpal::SampleFormat),

    /// System audio capture error
    #[error("System audio capture failed: {0}")]
    SystemAudioCapture(String),

    /// Stream building error
    #[error("Failed to build audio stream: {0}")]
    StreamBuild(String),

    /// Stream playback error
    #[error("Failed to start audio stream: {0}")]
    StreamPlay(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_not_found_error() {
        let error = AudioEngineError::DeviceNotFound("test-device".to_string());
        assert!(error.to_string().contains("test-device"));
    }

    #[test]
    fn test_unsupported_format_error() {
        let error = AudioEngineError::UnsupportedFormat(cpal::SampleFormat::I8);
        assert!(error.to_string().contains("Unsupported sample format"));
    }

    #[test]
    fn test_system_audio_capture_error() {
        let error = AudioEngineError::SystemAudioCapture("test error".to_string());
        assert!(error.to_string().contains("test error"));
    }

    #[test]
    fn test_stream_build_error() {
        let error = AudioEngineError::StreamBuild("build failed".to_string());
        assert!(error.to_string().contains("build failed"));
    }

    #[test]
    fn test_stream_play_error() {
        let error = AudioEngineError::StreamPlay("play failed".to_string());
        assert!(error.to_string().contains("play failed"));
    }
}
