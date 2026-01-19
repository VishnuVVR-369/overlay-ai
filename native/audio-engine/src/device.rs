//! Audio device enumeration and selection
//!
//! This module provides functions for listing and selecting audio input devices.

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait};

/// List all available audio input devices
pub fn list_audio_devices() -> Result<()> {
    let host = cpal::default_host();

    println!("Available audio input devices:");
    println!("==============================");

    // List input devices
    let devices = host
        .input_devices()
        .context("Failed to enumerate input devices")?;

    for (idx, device) in devices.enumerate() {
        let name = device.name().unwrap_or_else(|_| "Unknown".to_string());
        let is_default = host
            .default_input_device()
            .map(|d| d.name().ok() == device.name().ok())
            .unwrap_or(false);

        let default_marker = if is_default { " (default)" } else { "" };
        println!("  [{}] {}{}", idx, name, default_marker);

        // Show supported configs
        if let Ok(configs) = device.supported_input_configs() {
            for config in configs {
                println!(
                    "      - {} channels, {}-{} Hz, {:?}",
                    config.channels(),
                    config.min_sample_rate().0,
                    config.max_sample_rate().0,
                    config.sample_format()
                );
            }
        }
    }

    Ok(())
}

/// Find the input device by name (or default if "default")
pub fn get_input_device(device_name: &str) -> Result<cpal::Device> {
    let host = cpal::default_host();

    if device_name == "default" {
        host.default_input_device()
            .context("No default input device available")
    } else {
        host.input_devices()
            .context("Failed to enumerate input devices")?
            .find(|d| d.name().map(|n| n == device_name).unwrap_or(false))
            .with_context(|| format!("Input device '{}' not found", device_name))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_input_device_default() {
        // This test may fail if no default device is available, which is fine
        // We're just checking that the function doesn't panic
        let result = get_input_device("default");
        // Either succeeds or returns an error, but shouldn't panic
        let _ = result;
    }

    #[test]
    fn test_get_input_device_nonexistent() {
        // Should return an error for a device that doesn't exist
        let result = get_input_device("nonexistent-device-12345");
        assert!(result.is_err());
    }
}
