//! Audio preprocessing utilities (DC blocking, low-pass filtering)
//!
//! These filters help reduce low-frequency rumble/DC offset and aliasing
//! when downsampling, which can improve speech transcription accuracy.

use crate::config::{DC_BLOCKER_R, LOWPASS_Q};

/// Simple DC blocker (1st order high-pass filter)
/// y[n] = x[n] - x[n-1] + R * y[n-1]
pub struct DcBlocker {
    r: f32,
    x1: f32,
    y1: f32,
}

impl DcBlocker {
    pub fn new(r: f32) -> Self {
        Self {
            r,
            x1: 0.0,
            y1: 0.0,
        }
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        let y = x - self.x1 + self.r * self.y1;
        self.x1 = x;
        self.y1 = y;
        y
    }
}

/// Biquad filter (Direct Form I)
pub struct Biquad {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    z1: f32,
    z2: f32,
}

impl Biquad {
    /// Create a low-pass biquad filter
    pub fn lowpass(sample_rate_hz: f32, cutoff_hz: f32) -> Self {
        let omega = 2.0 * std::f32::consts::PI * (cutoff_hz / sample_rate_hz);
        let sin_omega = omega.sin();
        let cos_omega = omega.cos();
        let alpha = sin_omega / (2.0 * LOWPASS_Q);

        let b0 = (1.0 - cos_omega) / 2.0;
        let b1 = 1.0 - cos_omega;
        let b2 = (1.0 - cos_omega) / 2.0;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_omega;
        let a2 = 1.0 - alpha;

        Self {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0,
            z1: 0.0,
            z2: 0.0,
        }
    }

    #[inline]
    pub fn process(&mut self, x: f32) -> f32 {
        // Direct Form I with state
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
}

/// Combined preprocessing for speech capture
pub struct AudioPreprocessor {
    dc_blocker: DcBlocker,
    lowpass: Option<Biquad>,
}

impl AudioPreprocessor {
    pub fn new(input_rate: u32, target_rate: u32, lowpass_cutoff_hz: f32) -> Self {
        let lowpass = if input_rate > target_rate {
            Some(Biquad::lowpass(input_rate as f32, lowpass_cutoff_hz))
        } else {
            None
        };

        Self {
            dc_blocker: DcBlocker::new(DC_BLOCKER_R),
            lowpass,
        }
    }

    #[inline]
    pub fn process_in_place(&mut self, samples: &mut [f32]) {
        if let Some(lowpass) = self.lowpass.as_mut() {
            for s in samples.iter_mut() {
                let x = self.dc_blocker.process(*s);
                *s = lowpass.process(x);
            }
        } else {
            for s in samples.iter_mut() {
                *s = self.dc_blocker.process(*s);
            }
        }
    }
}
