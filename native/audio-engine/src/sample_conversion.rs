//! Sample format conversion utilities
//!
//! This module provides functions and traits for converting between different
//! audio sample formats (i16, f32, u16).

/// Trait for converting samples to i16
pub trait SampleConverter<T> {
    /// Convert a sample to i16
    fn to_i16(sample: &T) -> i16;
}

impl SampleConverter<i16> for i16 {
    fn to_i16(sample: &i16) -> i16 {
        *sample
    }
}

impl SampleConverter<f32> for f32 {
    fn to_i16(sample: &f32) -> i16 {
        f32_to_i16(sample)
    }
}

impl SampleConverter<u16> for u16 {
    fn to_i16(sample: &u16) -> i16 {
        u16_to_i16(sample)
    }
}

/// Convert f32 sample to i16
///
/// Clamps the value to the valid i16 range after scaling.
pub fn f32_to_i16(sample: &f32) -> i16 {
    let scaled = sample * i16::MAX as f32;
    scaled.clamp(i16::MIN as f32, i16::MAX as f32) as i16
}

/// Convert u16 sample to i16
///
/// Converts from unsigned 16-bit (0-65535) to signed 16-bit (-32768 to 32767).
pub fn u16_to_i16(sample: &u16) -> i16 {
    (*sample as i32 - 32768) as i16
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_f32_to_i16() {
        assert_eq!(f32_to_i16(&0.0), 0);
        assert_eq!(f32_to_i16(&1.0), i16::MAX);
        assert_eq!(f32_to_i16(&-1.0), -32767);
    }

    #[test]
    fn test_f32_to_i16_clamping() {
        assert_eq!(f32_to_i16(&2.0), i16::MAX);
        assert_eq!(f32_to_i16(&-2.0), i16::MIN);
    }

    #[test]
    fn test_u16_to_i16() {
        assert_eq!(u16_to_i16(&32768), 0);
        assert_eq!(u16_to_i16(&0), i16::MIN);
        assert_eq!(u16_to_i16(&65535), i16::MAX);
    }

    #[test]
    fn test_sample_converter_i16() {
        assert_eq!(<i16 as SampleConverter<i16>>::to_i16(&1000), 1000);
    }

    #[test]
    fn test_sample_converter_f32() {
        assert_eq!(<f32 as SampleConverter<f32>>::to_i16(&1.0), i16::MAX);
    }

    #[test]
    fn test_sample_converter_u16() {
        assert_eq!(<u16 as SampleConverter<u16>>::to_i16(&32768), 0);
    }
}
