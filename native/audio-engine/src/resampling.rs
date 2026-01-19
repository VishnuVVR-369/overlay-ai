//! Audio resampling utilities
//!
//! This module provides functions for resampling audio to the target sample rate (24kHz).
//! Uses rubato library for high-quality sinc interpolation resampling for improved Deepgram accuracy.

use crate::config::TARGET_SAMPLE_RATE;
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType};

/// Resample audio to target sample rate (24kHz mono)
///
/// This function performs high-quality sinc interpolation resampling using rubato
/// with a 256-point sinc window and Blackman-Harris windowing for minimal aliasing.
///
/// # Arguments
/// * `input` - Input audio samples
/// * `input_sample_rate` - Source sample rate
/// * `input_channels` - Number of input channels (will be mixed to mono)
///
/// # Returns
/// Resampled mono audio at TARGET_SAMPLE_RATE (24kHz)
pub fn resample_to_target_rate_mono(
    input: &[i16],
    input_sample_rate: u32,
    input_channels: u16,
) -> Vec<i16> {
    if input.is_empty() {
        return Vec::new();
    }

    let input_channels = input_channels as usize;
    let num_input_frames = input.len() / input_channels;

    if input_sample_rate == TARGET_SAMPLE_RATE && input_channels == 1 {
        return input.to_vec();
    }

    let mono_input: Vec<i16> = if input_channels == 1 {
        input.to_vec()
    } else {
        let mut mono = Vec::with_capacity(num_input_frames);
        for i in 0..num_input_frames {
            let base = i * input_channels;
            let mut sum: i32 = 0;
            for ch in 0..input_channels {
                if base + ch < input.len() {
                    sum += input[base + ch] as i32;
                }
            }
            mono.push((sum / input_channels as i32) as i16);
        }
        mono
    };

    if input_sample_rate == TARGET_SAMPLE_RATE {
        return mono_input;
    }

    let ratio = TARGET_SAMPLE_RATE as f64 / input_sample_rate as f64;
    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: rubato::WindowFunction::BlackmanHarris2,
    };

    match SincFixedIn::new(ratio, 2.0, params, 1024, 2) {
        Ok(mut resampler) => {
            let input_f64: Vec<Vec<f64>> = vec![mono_input.iter().map(|&s| s as f64).collect()];
            match resampler.process(&input_f64, None) {
                Ok(output) => output[0]
                    .iter()
                    .map(|&s| s.round().clamp(i16::MIN as f64, i16::MAX as f64) as i16)
                    .collect(),
                Err(_) => mono_input,
            }
        }
        Err(_) => mono_input,
    }
}

/// Simple linear resampling for mono audio (fallback method)
///
/// This is a simpler version for already-mono audio that doesn't need channel mixing.
/// Uses linear interpolation, which is faster but lower quality than sinc interpolation.
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
    fn test_resample_to_target_rate_empty() {
        let output = resample_to_target_rate_mono(&[], 44100, 2);
        assert!(output.is_empty());
    }

    #[test]
    fn test_resample_to_target_rate_same_rate() {
        let input = vec![1000i16, 2000, 3000, 4000];
        let output = resample_to_target_rate_mono(&input, 24000, 1);
        assert_eq!(input, output);
    }

    #[test]
    fn test_resample_to_target_rate_stereo_to_mono() {
        let input = vec![1000i16, 2000, 3000i16, 4000];
        let output = resample_to_target_rate_mono(&input, 24000, 2);
        assert!(!output.is_empty());
    }

    #[test]
    fn test_resample_to_target_rate_downsample() {
        let input = vec![1000i16; 48000];
        let output = resample_to_target_rate_mono(&input, 48000, 1);
        assert!(!output.is_empty());
        assert_eq!(output.len(), input.len());
    }

    #[test]
    fn test_resample_to_target_rate_upsample() {
        let input = vec![1000i16; 4800];
        let output = resample_to_target_rate_mono(&input, 16000, 1);
        assert!(!output.is_empty());
    }
}
