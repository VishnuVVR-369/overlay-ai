//! System audio stream handler
//!
//! This module provides the handler for ScreenCaptureKit audio stream callbacks.

use crate::config::{
    DEBUG_LOG_EXTENDED_COUNT, DEBUG_LOG_INITIAL_COUNT, LOG_INTERVAL_DEBUG, STEREO_CHANNELS,
};
use crate::logging::DebugLogger;
use crate::resampling::resample_linear;
use crate::ring_buffer::RingBufferProducer;
use screencapturekit::prelude::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

/// Handler for ScreenCaptureKit stream output
pub struct SystemAudioHandler {
    /// Producer to push audio samples to
    producer: RingBufferProducer,
    /// Source sample rate from ScreenCaptureKit
    source_sample_rate: u32,
    /// Target sample rate (16kHz)
    target_sample_rate: u32,
    /// Number of audio buffers received (for logging)
    buffer_count: Arc<AtomicUsize>,
    /// Debug logger
    logger: Arc<DebugLogger>,
}

impl SystemAudioHandler {
    /// Create a new system audio handler
    pub fn new(
        producer: RingBufferProducer,
        source_sample_rate: u32,
        target_sample_rate: u32,
        logger: Arc<DebugLogger>,
    ) -> Self {
        Self {
            producer,
            source_sample_rate,
            target_sample_rate,
            buffer_count: Arc::new(AtomicUsize::new(0)),
            logger,
        }
    }

    /// Extract audio data from CMSampleBuffer using multiple methods
    fn extract_audio_data(&self, sample: &CMSampleBuffer, callback_count: usize) -> Vec<f32> {
        // Method 1: Try get_audio_buffer_list() (wrapper method)
        if let Some(audio_buffer_list) = sample.get_audio_buffer_list() {
            let mut all_samples = Vec::new();
            for buffer in audio_buffer_list.iter() {
                let data = buffer.data();
                if !data.is_empty() {
                    // Convert bytes to f32 samples
                    // SAFETY: We know the data is f32 from ScreenCaptureKit
                    let float_samples: &[f32] = unsafe {
                        std::slice::from_raw_parts(
                            data.as_ptr() as *const f32,
                            data.len() / std::mem::size_of::<f32>(),
                        )
                    };
                    all_samples.extend_from_slice(float_samples);
                }
            }
            if !all_samples.is_empty() {
                if self
                    .logger
                    .should_log("system_audio_method1", DEBUG_LOG_INITIAL_COUNT, 100)
                {
                    eprintln!(
                        "[DEBUG] Method 1 (audio_buffer_list): got {} samples",
                        all_samples.len()
                    );
                }
                return all_samples;
            }
        }

        // Method 2: Direct FFI call to CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer
        if let Some(samples) = self.extract_audio_via_ffi(sample.as_ptr(), callback_count) {
            return samples;
        }

        // Method 3: Log diagnostic info if no method worked
        let num_samples = sample.get_num_samples();
        let total_size = sample.get_total_sample_size();
        if callback_count < DEBUG_LOG_EXTENDED_COUNT && num_samples > 0 {
            eprintln!(
                "[DEBUG] Audio info: num_samples={}, total_size={} bytes (no extraction method worked)",
                num_samples, total_size
            );
        }

        Vec::new()
    }

    /// Extract audio data using direct FFI call
    fn extract_audio_via_ffi(
        &self,
        sample_buffer_ptr: *mut std::ffi::c_void,
        callback_count: usize,
    ) -> Option<Vec<f32>> {
        use crate::system_audio::ffi;
        use std::ptr;

        if sample_buffer_ptr.is_null() {
            return None;
        }

        unsafe {
            // First call to get required buffer size
            let mut buffer_list_size_needed: usize = 0;
            let status = ffi::CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sample_buffer_ptr,
                &mut buffer_list_size_needed,
                ptr::null_mut(),
                0,
                ptr::null(),
                ptr::null(),
                0,
                ptr::null_mut(),
            );

            if status != 0 || buffer_list_size_needed == 0 {
                if callback_count < DEBUG_LOG_EXTENDED_COUNT {
                    eprintln!(
                        "[DEBUG] FFI: size query failed, status={}, size={}",
                        status, buffer_list_size_needed
                    );
                }
                return None;
            }

            // Allocate buffer for AudioBufferList
            let layout = std::alloc::Layout::from_size_align(buffer_list_size_needed, 8).ok()?;
            let buffer_list_ptr = std::alloc::alloc(layout) as *mut ffi::AudioBufferList;
            if buffer_list_ptr.is_null() {
                return None;
            }

            // Second call to get actual audio data
            let mut block_buffer: *mut std::ffi::c_void = ptr::null_mut();
            let status = ffi::CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sample_buffer_ptr,
                ptr::null_mut(),
                buffer_list_ptr,
                buffer_list_size_needed,
                ptr::null(),
                ptr::null(),
                0, // no flags (we do NOT request kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment = 1; 8-byte alignment from the allocator is sufficient for our use here)
                &mut block_buffer,
            );

            if status != 0 {
                std::alloc::dealloc(buffer_list_ptr as *mut u8, layout);
                if callback_count < DEBUG_LOG_EXTENDED_COUNT {
                    eprintln!("[DEBUG] FFI: get audio failed, status={}", status);
                }
                return None;
            }

            // Extract audio samples from AudioBufferList
            let buffer_list = &*buffer_list_ptr;
            let mut all_samples = Vec::new();

            if callback_count < DEBUG_LOG_INITIAL_COUNT {
                eprintln!(
                    "[DEBUG] FFI: got {} audio buffers",
                    buffer_list.number_buffers
                );
            }

            for i in 0..buffer_list.number_buffers as usize {
                // Access buffers array (variable length)
                // SAFETY: We know the buffer_list has at least number_buffers entries
                let buffer_ptr = buffer_list.buffers.as_ptr().add(i);
                let buffer = &*buffer_ptr;

                if !buffer.data.is_null() && buffer.data_byte_size > 0 {
                    // ScreenCaptureKit outputs Float32 audio
                    // SAFETY: We know the data is f32 from ScreenCaptureKit
                    let num_floats = buffer.data_byte_size as usize / std::mem::size_of::<f32>();
                    let float_samples =
                        std::slice::from_raw_parts(buffer.data as *const f32, num_floats);
                    all_samples.extend_from_slice(float_samples);

                    if callback_count < DEBUG_LOG_INITIAL_COUNT {
                        eprintln!(
                            "[DEBUG] FFI buffer {}: {} channels, {} bytes = {} f32 samples",
                            i, buffer.number_channels, buffer.data_byte_size, num_floats
                        );
                    }
                }
            }

            // Clean up
            if !block_buffer.is_null() {
                ffi::CFRelease(block_buffer);
            }
            std::alloc::dealloc(buffer_list_ptr as *mut u8, layout);

            if all_samples.is_empty() {
                None
            } else {
                if callback_count < DEBUG_LOG_INITIAL_COUNT {
                    eprintln!(
                        "[DEBUG] FFI: extracted {} total f32 samples",
                        all_samples.len()
                    );
                }
                Some(all_samples)
            }
        }
    }

    /// Process audio samples: convert, mix to mono, resample, and push to buffer
    fn process_audio_samples(&self, audio_data: Vec<f32>, callback_count: usize) {
        // Convert f32 to i16 (ScreenCaptureKit outputs Float32)
        let i16_samples: Vec<i16> = audio_data
            .iter()
            .map(|&s| {
                let scaled = s * i16::MAX as f32;
                scaled.clamp(i16::MIN as f32, i16::MAX as f32) as i16
            })
            .collect();

        // Mix to mono (assuming stereo input from ScreenCaptureKit)
        let mono_samples = if i16_samples.len() >= STEREO_CHANNELS {
            let frame_count = i16_samples.len() / STEREO_CHANNELS;
            let mut mono = Vec::with_capacity(frame_count);
            for i in 0..frame_count {
                let mut sum: i32 = 0;
                for ch in 0..STEREO_CHANNELS {
                    if i * STEREO_CHANNELS + ch < i16_samples.len() {
                        sum += i16_samples[i * STEREO_CHANNELS + ch] as i32;
                    }
                }
                mono.push((sum / STEREO_CHANNELS as i32) as i16);
            }
            mono
        } else {
            i16_samples
        };

        // Resample to target rate if needed
        let resampled = if self.source_sample_rate != self.target_sample_rate {
            resample_linear(
                &mono_samples,
                self.source_sample_rate,
                self.target_sample_rate,
            )
        } else {
            mono_samples
        };

        // Push to ring buffer
        let pushed = if let Ok(mut prod) = self.producer.lock() {
            prod.push_slice(&resampled)
        } else {
            0
        };

        // Log periodically
        if self
            .logger
            .should_log("system_audio", DEBUG_LOG_INITIAL_COUNT, LOG_INTERVAL_DEBUG)
        {
            eprintln!(
                "[DEBUG] System audio #{}: extracted {} f32 samples, pushed {} i16 samples",
                callback_count,
                audio_data.len(),
                pushed
            );
        }
    }
}

impl SCStreamOutputTrait for SystemAudioHandler {
    fn did_output_sample_buffer(&self, sample: CMSampleBuffer, output_type: SCStreamOutputType) {
        // Track all callbacks for debugging
        let callback_count = self.buffer_count.fetch_add(1, Ordering::Relaxed);

        // Only process audio buffers
        if output_type != SCStreamOutputType::Audio {
            return;
        }

        // Log first few audio callbacks
        if callback_count < DEBUG_LOG_INITIAL_COUNT {
            let num_samples = sample.get_num_samples();
            let total_size = sample.get_total_sample_size();
            let is_ready = sample.is_data_ready();
            eprintln!(
                "[DEBUG] Audio callback #{}: num_samples={}, total_size={}, is_ready={}",
                callback_count, num_samples, total_size, is_ready
            );
        }

        // Ensure data is ready for access
        if !sample.is_data_ready() {
            if let Err(e) = sample.make_data_ready() {
                if callback_count < DEBUG_LOG_EXTENDED_COUNT {
                    eprintln!("[DEBUG] make_data_ready failed: {}", e);
                }
                return;
            }
        }

        // Try to get audio data using multiple methods
        let audio_data = self.extract_audio_data(&sample, callback_count);

        if audio_data.is_empty() {
            if callback_count < DEBUG_LOG_EXTENDED_COUNT {
                eprintln!(
                    "[DEBUG] Audio callback #{}: No audio data extracted",
                    callback_count
                );
            }
            return;
        }

        self.process_audio_samples(audio_data, callback_count);
    }
}
