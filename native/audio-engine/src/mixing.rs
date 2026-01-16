//! Stereo mixing utilities
//!
//! This module provides functions for mixing system audio and microphone audio
//! into interleaved stereo frames.

/// Mix system audio and microphone audio into interleaved stereo frames
///
/// Per PLAN.md:
/// - Channel 0: System Audio (Interviewer)
/// - Channel 1: Microphone (You)
///
/// This allows Deepgram to use "Multichannel" diarization for better accuracy.
///
/// # Arguments
/// * `system` - System audio samples (mono)
/// * `mic` - Microphone audio samples (mono)
///
/// # Returns
/// Interleaved stereo samples: [sys0, mic0, sys1, mic1, ...]
pub fn mix_to_stereo(system: &[i16], mic: &[i16]) -> Vec<i16> {
    let max_len = system.len().max(mic.len());
    let mut output = Vec::with_capacity(max_len * 2);

    for i in 0..max_len {
        // Channel 0: System audio (or silence if not available)
        let sys_sample = system.get(i).copied().unwrap_or(0);
        // Channel 1: Microphone audio (or silence if not available)
        let mic_sample = mic.get(i).copied().unwrap_or(0);

        output.push(sys_sample);
        output.push(mic_sample);
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mix_to_stereo_equal_length() {
        let system = vec![1000i16, 2000, 3000];
        let mic = vec![4000i16, 5000, 6000];
        let output = mix_to_stereo(&system, &mic);
        assert_eq!(output, vec![1000, 4000, 2000, 5000, 3000, 6000]);
    }

    #[test]
    fn test_mix_to_stereo_system_longer() {
        let system = vec![1000i16, 2000, 3000];
        let mic = vec![4000i16];
        let output = mix_to_stereo(&system, &mic);
        assert_eq!(output, vec![1000, 4000, 2000, 0, 3000, 0]);
    }

    #[test]
    fn test_mix_to_stereo_mic_longer() {
        let system = vec![1000i16];
        let mic = vec![4000i16, 5000, 6000];
        let output = mix_to_stereo(&system, &mic);
        assert_eq!(output, vec![1000, 4000, 0, 5000, 0, 6000]);
    }

    #[test]
    fn test_mix_to_stereo_empty() {
        let output = mix_to_stereo(&[], &[]);
        assert!(output.is_empty());
    }
}
