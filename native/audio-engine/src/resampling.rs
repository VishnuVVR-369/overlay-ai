//! Audio resampling utilities
//!
//! This module provides functions for resampling audio, and a streaming
//! high-quality resampler for downsampling.
use anyhow::Result;
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

const RESAMPLER_CHUNK_SIZE: usize = 1024;

/// Simple linear resampling for mono f32 audio
///
/// # Arguments
/// * `input` - Input mono samples (f32, -1.0..1.0)
/// * `source_rate` - Source sample rate
/// * `target_rate` - Target sample rate
///
/// # Returns
/// Resampled audio at target rate
pub fn resample_linear_f32(input: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    if input.is_empty() || source_rate == target_rate {
        return input.to_vec();
    }

    let ratio = target_rate as f32 / source_rate as f32;
    let output_len = (input.len() as f32 * ratio).ceil() as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_pos = i as f32 / ratio;
        let src_idx = src_pos.floor() as usize;
        let frac = src_pos - src_idx as f32;

        let s0 = *input.get(src_idx).unwrap_or(&0.0);
        let s1 = *input.get(src_idx + 1).unwrap_or(&s0);
        let interpolated = s0 + (s1 - s0) * frac;
        output.push(interpolated);
    }

    output
}

/// Streaming sinc resampler with internal buffering for variable input sizes.
pub struct StreamingResampler {
    resampler: SincFixedIn<f32>,
    input_chunk: usize,
    buffer: Vec<f32>,
}

impl StreamingResampler {
    pub fn new(source_rate: u32, target_rate: u32) -> Result<Self> {
        let ratio = target_rate as f64 / source_rate as f64;
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 160,
            window: WindowFunction::BlackmanHarris2,
        };

        let resampler = SincFixedIn::<f32>::new(ratio, 2.0, params, RESAMPLER_CHUNK_SIZE, 1)?;

        Ok(Self {
            resampler,
            input_chunk: RESAMPLER_CHUNK_SIZE,
            buffer: Vec::with_capacity(RESAMPLER_CHUNK_SIZE * 2),
        })
    }

    /// Push input samples and return any resampled output available.
    pub fn process(&mut self, input: &[f32]) -> Result<Vec<f32>> {
        if input.is_empty() {
            return Ok(Vec::new());
        }

        self.buffer.extend_from_slice(input);
        let mut output = Vec::new();

        while self.buffer.len() >= self.input_chunk {
            let chunk: Vec<f32> = self.buffer.drain(..self.input_chunk).collect();
            let in_buf = vec![chunk];
            let out = self.resampler.process(&in_buf, None)?;
            if let Some(ch0) = out.into_iter().next() {
                output.extend_from_slice(&ch0);
            }
        }

        Ok(output)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_linear_f32_no_change() {
        let input = vec![0.1f32, 0.2, 0.3, 0.4];
        let output = resample_linear_f32(&input, 16000, 16000);
        assert_eq!(input, output);
    }

    #[test]
    fn test_resample_linear_f32_double_rate() {
        let input = vec![0.1f32, 0.2];
        let output = resample_linear_f32(&input, 8000, 16000);
        assert_eq!(output.len(), 4);
    }

    #[test]
    fn test_resample_linear_f32_half_rate() {
        let input = vec![0.1f32, 0.2, 0.3, 0.4];
        let output = resample_linear_f32(&input, 16000, 8000);
        assert_eq!(output.len(), 2);
    }
}
