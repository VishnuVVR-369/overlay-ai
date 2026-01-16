//! Audio resampling utilities
//!
//! This module provides functions for resampling audio to the target sample rate (16kHz).
//! Uses linear interpolation for resampling.

use crate::config::TARGET_SAMPLE_RATE;

/// Resample audio to target sample rate (16kHz mono)
///
/// This function performs simple linear interpolation resampling.
/// For production use, consider using a proper resampling library like `rubato`.
///
/// # Arguments
/// * `input` - Input audio samples
/// * `input_sample_rate` - Source sample rate
/// * `input_channels` - Number of input channels (will be mixed to mono)
///
/// # Returns
/// Resampled mono audio at TARGET_SAMPLE_RATE
pub fn resample_to_16khz_mono(
    input: &[i16],
    input_sample_rate: u32,
    input_channels: u16,
) -> Vec<i16> {
    if input.is_empty() {
        return Vec::new();
    }

    let input_channels = input_channels as usize;
    let num_input_frames = input.len() / input_channels;

    // If already at target rate and mono, just return mixed mono
    if input_sample_rate == TARGET_SAMPLE_RATE && input_channels == 1 {
        return input.to_vec();
    }

    // Calculate output size
    let ratio = TARGET_SAMPLE_RATE as f64 / input_sample_rate as f64;
    let num_output_frames = (num_input_frames as f64 * ratio).ceil() as usize;
    let mut output = Vec::with_capacity(num_output_frames);

    for i in 0..num_output_frames {
        // Calculate source position
        let src_pos = i as f64 / ratio;
        let src_idx = src_pos.floor() as usize;
        let frac = src_pos - src_idx as f64;

        // Get source frame (mix to mono if multi-channel)
        let get_mono_sample = |frame_idx: usize| -> f64 {
            if frame_idx >= num_input_frames {
                return 0.0;
            }
            let base = frame_idx * input_channels;
            let mut sum = 0i32;
            for ch in 0..input_channels {
                if base + ch < input.len() {
                    sum += input[base + ch] as i32;
                }
            }
            (sum / input_channels as i32) as f64
        };

        // Linear interpolation
        let s0 = get_mono_sample(src_idx);
        let s1 = get_mono_sample(src_idx + 1);
        let interpolated = s0 + (s1 - s0) * frac;

        // Clamp to i16 range
        let sample = interpolated.round().clamp(i16::MIN as f64, i16::MAX as f64) as i16;
        output.push(sample);
    }

    output
}

/// Simple linear resampling for mono audio
///
/// This is a simpler version for already-mono audio that doesn't need channel mixing.
///
/// # Arguments
/// * `input` - Input mono audio samples
/// * `source_rate` - Source sample rate
/// * `target_rate` - Target sample rate
///
/// # Returns
/// Resampled audio at target rate
pub fn resample_linear(input: &[i16], source_rate: u32, target_rate: u32) -> Vec<i16> {
    if input.is_empty() || source_rate == target_rate {
        return input.to_vec();
    }

    let ratio = target_rate as f64 / source_rate as f64;
    let output_len = (input.len() as f64 * ratio).ceil() as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_pos = i as f64 / ratio;
        let src_idx = src_pos.floor() as usize;
        let frac = src_pos - src_idx as f64;

        let s0 = input.get(src_idx).copied().unwrap_or(0) as f64;
        let s1 = input.get(src_idx + 1).copied().unwrap_or(s0 as i16) as f64;
        let interpolated = s0 + (s1 - s0) * frac;
        output.push(interpolated.round().clamp(i16::MIN as f64, i16::MAX as f64) as i16);
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_linear_no_change() {
        let input = vec![1000i16, 2000, 3000, 4000];
        let output = resample_linear(&input, 16000, 16000);
        assert_eq!(input, output);
    }

    #[test]
    fn test_resample_linear_double_rate() {
        let input = vec![1000i16, 2000];
        let output = resample_linear(&input, 8000, 16000);
        assert_eq!(output.len(), 4);
    }

    #[test]
    fn test_resample_linear_half_rate() {
        let input = vec![1000i16, 2000, 3000, 4000];
        let output = resample_linear(&input, 16000, 8000);
        assert_eq!(output.len(), 2);
    }

    #[test]
    fn test_resample_to_16khz_mono_empty() {
        let output = resample_to_16khz_mono(&[], 44100, 2);
        assert!(output.is_empty());
    }

    #[test]
    fn test_resample_to_16khz_mono_already_16khz() {
        let input = vec![1000i16, 2000, 3000, 4000];
        let output = resample_to_16khz_mono(&input, 16000, 1);
        assert_eq!(input, output);
    }
}
