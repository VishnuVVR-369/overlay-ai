//! Audio Engine - Rust sidecar for Overlay AI
//!
//! This binary captures microphone audio (and system audio on macOS via ScreenCaptureKit),
//! resamples to 16kHz, mixes into stereo (Channel 0 = System, Channel 1 = Mic),
//! and streams raw i16 PCM bytes to stdout for piping into Electron.
//!
//! Usage: ./audio-engine --device=default | (Electron reads stdout)
//!
//! The output format is:
//! - Encoding: linear16 (i16 little-endian)
//! - Sample rate: 16000 Hz
//! - Channels: 2 (stereo) - Channel 0: System Audio (Interviewer), Channel 1: Mic (You)

use anyhow::{Context, Result};
use byteorder::{LittleEndian, WriteBytesExt};
use clap::Parser;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::HeapRb;
use std::fs::File;
use std::io::{self, BufWriter, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

// ============================================================================
// PCM Output Format Contract (per PLAN.md)
// ============================================================================

/// Target sample rate for Deepgram (16kHz as per PLAN.md)
const TARGET_SAMPLE_RATE: u32 = 16000;

/// Output channels: Stereo (Channel 0 = System, Channel 1 = Mic)
const OUTPUT_CHANNELS: u16 = 2;

/// Ring buffer size in samples (enough for ~1 second of stereo audio at 16kHz)
const RING_BUFFER_SIZE: usize = TARGET_SAMPLE_RATE as usize * OUTPUT_CHANNELS as usize * 2;

/// Ring buffer size for system audio (mono, before mixing)
const SYSTEM_AUDIO_BUFFER_SIZE: usize = TARGET_SAMPLE_RATE as usize * 2;

// ============================================================================
// Type Aliases
// ============================================================================

/// Type alias for ring buffer producer wrapped in Arc<Mutex<...>>
type RingBufferProducer = Arc<std::sync::Mutex<ringbuf::Producer<i16, Arc<HeapRb<i16>>>>>;

/// Type alias for ring buffer consumer wrapped in Arc<Mutex<...>>
type RingBufferConsumer = Arc<std::sync::Mutex<ringbuf::Consumer<i16, Arc<HeapRb<i16>>>>>;

// ============================================================================
// CLI Arguments
// ============================================================================

/// Audio capture engine for Overlay AI
///
/// Captures microphone audio and outputs raw PCM to stdout.
/// System audio capture on macOS requires ScreenCaptureKit (placeholder).
///
/// Example: ./audio-engine --device=default | (Electron reads stdout)
#[derive(Parser, Debug)]
#[command(name = "audio-engine")]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Target sample rate in Hz (default: 16000 for Deepgram)
    #[arg(long, default_value_t = TARGET_SAMPLE_RATE)]
    sample_rate: u32,

    /// Audio input device name ("default" uses system default)
    #[arg(long, default_value = "default")]
    device: String,

    /// Output to file instead of stdout (for debugging/testing)
    #[arg(long)]
    output_file: Option<String>,

    /// List available audio devices and exit
    #[arg(long)]
    list_devices: bool,
}

// ============================================================================
// macOS System Audio Capture via ScreenCaptureKit
// ============================================================================

/// macOS System Audio Capture using ScreenCaptureKit
///
/// Per PLAN.md:
/// - Uses ScreenCaptureKit for system audio capture (macOS 12.3+)
/// - Requires "Screen Recording" permission in System Preferences
/// - Outputs audio to Channel 0 (Interviewer/System audio)
///
/// The audio is captured at the configured sample rate and pushed to a ring buffer
/// for mixing with microphone audio.
#[cfg(target_os = "macos")]
mod system_audio {
    use super::*;
    use screencapturekit::cm::CMTime;
    use screencapturekit::prelude::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// System audio capture using ScreenCaptureKit
    pub struct SystemAudioCapture {
        /// The SCStream handle
        stream: Option<SCStream>,
        /// Sample rate for audio capture
        sample_rate: u32,
        /// Ring buffer producer for captured audio
        producer: RingBufferProducer,
        /// Flag indicating if capture is active
        is_running: Arc<AtomicBool>,
    }

    /// Handler for ScreenCaptureKit stream output
    struct SystemAudioHandler {
        /// Producer to push audio samples to
        producer: RingBufferProducer,
        /// Source sample rate from ScreenCaptureKit
        source_sample_rate: u32,
        /// Target sample rate (16kHz)
        target_sample_rate: u32,
        /// Number of audio buffers received (for logging)
        buffer_count: Arc<std::sync::atomic::AtomicUsize>,
    }

    impl SCStreamOutputTrait for SystemAudioHandler {
        fn did_output_sample_buffer(
            &self,
            sample: CMSampleBuffer,
            output_type: SCStreamOutputType,
        ) {
            // Track all callbacks for debugging
            let callback_count = self
                .buffer_count
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

            // Only process audio buffers
            if output_type != SCStreamOutputType::Audio {
                return;
            }

            // Log first few audio callbacks
            if callback_count < 5 {
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
                    if callback_count < 10 {
                        eprintln!("[DEBUG] make_data_ready failed: {}", e);
                    }
                    return;
                }
            }

            // Try to get audio data using multiple methods
            let audio_data = self.extract_audio_data(&sample, callback_count);

            if audio_data.is_empty() {
                if callback_count < 10 {
                    eprintln!(
                        "[DEBUG] Audio callback #{}: No audio data extracted",
                        callback_count
                    );
                }
                return;
            }

            // Convert f32 to i16 (ScreenCaptureKit outputs Float32)
            let i16_samples: Vec<i16> = audio_data
                .iter()
                .map(|&s| {
                    let scaled = s * i16::MAX as f32;
                    scaled.clamp(i16::MIN as f32, i16::MAX as f32) as i16
                })
                .collect();

            // Mix to mono (assuming stereo input from ScreenCaptureKit)
            let channels = 2usize; // ScreenCaptureKit typically outputs stereo
            let mono_samples = if i16_samples.len() >= channels {
                let frame_count = i16_samples.len() / channels;
                let mut mono = Vec::with_capacity(frame_count);
                for i in 0..frame_count {
                    let mut sum: i32 = 0;
                    for ch in 0..channels {
                        if i * channels + ch < i16_samples.len() {
                            sum += i16_samples[i * channels + ch] as i32;
                        }
                    }
                    mono.push((sum / channels as i32) as i16);
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
            if callback_count < 5 || callback_count.is_multiple_of(100) {
                eprintln!(
                    "[DEBUG] System audio #{}: extracted {} f32 samples, pushed {} i16 samples",
                    callback_count,
                    audio_data.len(),
                    pushed
                );
            }
        }
    }

    impl SystemAudioHandler {
        /// Extract audio data from CMSampleBuffer using multiple methods
        fn extract_audio_data(&self, sample: &CMSampleBuffer, callback_count: usize) -> Vec<f32> {
            // Method 1: Try get_audio_buffer_list() (wrapper method)
            if let Some(audio_buffer_list) = sample.get_audio_buffer_list() {
                let mut all_samples = Vec::new();
                for buffer in audio_buffer_list.iter() {
                    let data = buffer.data();
                    if !data.is_empty() {
                        // Convert bytes to f32 samples
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
                    if callback_count < 3 {
                        eprintln!(
                            "[DEBUG] Method 1 (audio_buffer_list): got {} samples",
                            all_samples.len()
                        );
                    }
                    return all_samples;
                }
            }

            // Method 2: Direct FFI call to CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer
            if let Some(samples) = extract_audio_via_ffi(sample.as_ptr(), callback_count) {
                return samples;
            }

            // Method 3: Log diagnostic info if no method worked
            let num_samples = sample.get_num_samples();
            let total_size = sample.get_total_sample_size();
            if callback_count < 5 && num_samples > 0 {
                eprintln!(
                    "[DEBUG] Audio info: num_samples={}, total_size={} bytes (no extraction method worked)",
                    num_samples, total_size
                );
            }

            Vec::new()
        }
    }

    /// FFI bindings for direct Core Media / Core Audio access
    mod ffi_audio {
        use std::ffi::c_void;

        /// AudioBuffer structure from Core Audio
        #[repr(C)]
        pub struct AudioBuffer {
            pub number_channels: u32,
            pub data_byte_size: u32,
            pub data: *mut c_void,
        }

        /// AudioBufferList structure from Core Audio
        #[repr(C)]
        pub struct AudioBufferList {
            pub number_buffers: u32,
            pub buffers: [AudioBuffer; 1], // Variable length array
        }

        // Core Media FFI declarations
        #[link(name = "CoreMedia", kind = "framework")]
        extern "C" {
            pub fn CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sbuf: *const c_void,
                buffer_list_size_needed_out: *mut usize,
                buffer_list_out: *mut AudioBufferList,
                buffer_list_size: usize,
                block_buffer_structure_allocator: *const c_void,
                block_buffer_block_allocator: *const c_void,
                flags: u32,
                block_buffer_out: *mut *mut c_void,
            ) -> i32;
        }

        #[link(name = "CoreFoundation", kind = "framework")]
        extern "C" {
            pub fn CFRelease(cf: *const c_void);
        }
    }

    /// Extract audio data using direct FFI call
    fn extract_audio_via_ffi(
        sample_buffer_ptr: *mut std::ffi::c_void,
        callback_count: usize,
    ) -> Option<Vec<f32>> {
        use ffi_audio::*;
        use std::ptr;

        if sample_buffer_ptr.is_null() {
            return None;
        }

        unsafe {
            // First call to get required buffer size
            let mut buffer_list_size_needed: usize = 0;
            let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
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
                if callback_count < 5 {
                    eprintln!(
                        "[DEBUG] FFI: size query failed, status={}, size={}",
                        status, buffer_list_size_needed
                    );
                }
                return None;
            }

            // Allocate buffer for AudioBufferList
            let layout = std::alloc::Layout::from_size_align(buffer_list_size_needed, 8).ok()?;
            let buffer_list_ptr = std::alloc::alloc(layout) as *mut AudioBufferList;
            if buffer_list_ptr.is_null() {
                return None;
            }

            // Second call to get actual audio data
            let mut block_buffer: *mut std::ffi::c_void = ptr::null_mut();
            let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
                sample_buffer_ptr,
                ptr::null_mut(),
                buffer_list_ptr,
                buffer_list_size_needed,
                ptr::null(),
                ptr::null(),
                0, // kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment = 1
                &mut block_buffer,
            );

            if status != 0 {
                std::alloc::dealloc(buffer_list_ptr as *mut u8, layout);
                if callback_count < 5 {
                    eprintln!("[DEBUG] FFI: get audio failed, status={}", status);
                }
                return None;
            }

            // Extract audio samples from AudioBufferList
            let buffer_list = &*buffer_list_ptr;
            let mut all_samples = Vec::new();

            if callback_count < 3 {
                eprintln!(
                    "[DEBUG] FFI: got {} audio buffers",
                    buffer_list.number_buffers
                );
            }

            for i in 0..buffer_list.number_buffers as usize {
                // Access buffers array (variable length)
                let buffer_ptr = buffer_list.buffers.as_ptr().add(i);
                let buffer = &*buffer_ptr;

                if !buffer.data.is_null() && buffer.data_byte_size > 0 {
                    // ScreenCaptureKit outputs Float32 audio
                    let num_floats = buffer.data_byte_size as usize / std::mem::size_of::<f32>();
                    let float_samples =
                        std::slice::from_raw_parts(buffer.data as *const f32, num_floats);
                    all_samples.extend_from_slice(float_samples);

                    if callback_count < 3 {
                        eprintln!(
                            "[DEBUG] FFI buffer {}: {} channels, {} bytes = {} f32 samples",
                            i, buffer.number_channels, buffer.data_byte_size, num_floats
                        );
                    }
                }
            }

            // Clean up
            if !block_buffer.is_null() {
                CFRelease(block_buffer);
            }
            std::alloc::dealloc(buffer_list_ptr as *mut u8, layout);

            if all_samples.is_empty() {
                None
            } else {
                if callback_count < 3 {
                    eprintln!(
                        "[DEBUG] FFI: extracted {} total f32 samples",
                        all_samples.len()
                    );
                }
                Some(all_samples)
            }
        }
    }

    /// Simple linear resampling for system audio
    fn resample_linear(input: &[i16], source_rate: u32, target_rate: u32) -> Vec<i16> {
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

    impl SystemAudioCapture {
        /// Initialize system audio capture with ScreenCaptureKit
        ///
        /// Requires:
        /// - macOS 12.3 or later
        /// - Screen Recording permission granted in System Preferences
        pub fn new(sample_rate: u32, producer: RingBufferProducer) -> Result<Self> {
            eprintln!("[INFO] Initializing system audio capture via ScreenCaptureKit");
            eprintln!("[INFO] Note: Screen Recording permission required");

            Ok(Self {
                stream: None,
                sample_rate,
                producer,
                is_running: Arc::new(AtomicBool::new(false)),
            })
        }

        /// Start capturing system audio
        pub fn start(&mut self) -> Result<()> {
            if self.is_running.load(Ordering::Relaxed) {
                eprintln!("[WARN] System audio capture already running");
                return Ok(());
            }

            eprintln!("[INFO] Starting system audio capture...");

            // Get shareable content (displays)
            let content = SCShareableContent::get().context(
                "Failed to get shareable content. Is Screen Recording permission granted?",
            )?;

            // Get the primary display
            let display = content
                .displays()
                .into_iter()
                .next()
                .context("No displays found for audio capture")?;

            // Get display dimensions for valid video configuration
            // ScreenCaptureKit requires valid video dimensions even for audio-only capture
            let display_width = display.width();
            let display_height = display.height();

            eprintln!(
                "[INFO] Capturing system audio from display: {:?} ({}x{})",
                display.display_id(),
                display_width,
                display_height
            );

            // Create content filter for display capture (audio only needs a display context)
            let filter = SCContentFilter::builder()
                .display(&display)
                .exclude_windows(&[])
                .build();

            // Configure for audio-only capture
            // IMPORTANT: ScreenCaptureKit requires valid video dimensions even for audio
            let sck_sample_rate = 48000i32; // ScreenCaptureKit commonly uses 48kHz

            // Create a CMTime for minimum frame interval (1/10 second = 10 FPS max)
            // Using a reasonable frame interval to avoid potential issues with 1 FPS
            let frame_interval = CMTime::new(1, 10); // 10 FPS (0.1 second per frame)

            let mut config = SCStreamConfiguration::default();

            // Use scaled-down display dimensions (1/4 size to reduce overhead)
            // ScreenCaptureKit may reject 1x1 or very small dimensions
            let scaled_width = (display_width / 4).max(64);
            let scaled_height = (display_height / 4).max(64);

            eprintln!(
                "[DEBUG] Video config: {}x{} @ 10fps (scaled from {}x{})",
                scaled_width, scaled_height, display_width, display_height
            );

            config.set_width(scaled_width);
            config.set_height(scaled_height);
            config.set_minimum_frame_interval(&frame_interval);
            config.set_captures_audio(true);
            config.set_excludes_current_process_audio(true); // Exclude our own audio to avoid feedback
            config.set_sample_rate(sck_sample_rate);
            config.set_channel_count(2); // Stereo
            config.set_shows_cursor(false); // Don't need cursor for audio capture

            // Create the audio handler
            let handler = SystemAudioHandler {
                producer: Arc::clone(&self.producer),
                source_sample_rate: sck_sample_rate as u32,
                target_sample_rate: self.sample_rate,
                buffer_count: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            };

            // Create and start the stream
            eprintln!("[DEBUG] Creating SCStream...");
            let mut stream = SCStream::new(&filter, &config);

            eprintln!("[DEBUG] Adding audio output handler...");
            stream.add_output_handler(handler, SCStreamOutputType::Audio);

            eprintln!("[DEBUG] Starting capture...");
            match stream.start_capture() {
                Ok(()) => {
                    eprintln!("[INFO] System audio capture started successfully");
                }
                Err(e) => {
                    // Provide detailed error context
                    eprintln!("[ERROR] SCStream::start_capture() failed: {:?}", e);
                    eprintln!("[DEBUG] This usually means:");
                    eprintln!("[DEBUG]   1. Screen Recording permission not granted");
                    eprintln!("[DEBUG]   2. Invalid stream configuration");
                    eprintln!("[DEBUG]   3. Display/content not available");
                    return Err(anyhow::anyhow!(
                        "Failed to start system audio capture: {:?}. \
                        Please grant Screen Recording permission in System Preferences → \
                        Privacy & Security → Screen Recording",
                        e
                    ));
                }
            }

            self.stream = Some(stream);
            self.is_running.store(true, Ordering::Relaxed);

            eprintln!(
                "[INFO] System audio capture active ({}Hz → {}Hz)",
                sck_sample_rate, self.sample_rate
            );

            Ok(())
        }

        /// Stop capturing system audio
        pub fn stop(&mut self) -> Result<()> {
            if !self.is_running.load(Ordering::Relaxed) {
                return Ok(());
            }

            eprintln!("[INFO] Stopping system audio capture...");

            if let Some(stream) = self.stream.take() {
                stream
                    .stop_capture()
                    .context("Failed to stop system audio capture")?;
            }

            self.is_running.store(false, Ordering::Relaxed);
            eprintln!("[INFO] System audio capture stopped");

            Ok(())
        }
    }

    impl Drop for SystemAudioCapture {
        fn drop(&mut self) {
            let _ = self.stop();
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod system_audio {
    use super::*;

    /// System audio capture stub for non-macOS platforms
    pub struct SystemAudioCapture {
        _producer: RingBufferProducer,
    }

    impl SystemAudioCapture {
        pub fn new(_sample_rate: u32, producer: RingBufferProducer) -> Result<Self> {
            eprintln!("[WARN] System audio capture only supported on macOS");
            eprintln!("[WARN] Currently outputting silence on Channel 0 (System)");
            Ok(Self {
                _producer: producer,
            })
        }

        pub fn start(&mut self) -> Result<()> {
            Ok(())
        }

        pub fn stop(&mut self) -> Result<()> {
            Ok(())
        }
    }
}

// ============================================================================
// Resampling (Placeholder)
// ============================================================================

/// Resample audio to target sample rate (16kHz mono)
///
/// This is a placeholder implementation that performs simple linear interpolation.
/// For production use, consider using a proper resampling library like `rubato`.
///
/// Per PLAN.md: "Convert incoming streams to 16kHz / Mono (Deepgram requirement)"
fn resample_to_16khz_mono(input: &[i16], input_sample_rate: u32, input_channels: u16) -> Vec<i16> {
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

// ============================================================================
// Stereo Mixing
// ============================================================================

/// Mix system audio and microphone audio into interleaved stereo frames
///
/// Per PLAN.md:
/// - Channel 0: System Audio (Interviewer)
/// - Channel 1: Microphone (You)
///
/// This allows Deepgram to use "Multichannel" diarization for better accuracy.
fn mix_to_stereo(system: &[i16], mic: &[i16]) -> Vec<i16> {
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

// ============================================================================
// Device Enumeration
// ============================================================================

/// List all available audio input devices
fn list_audio_devices() -> Result<()> {
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
fn get_input_device(device_name: &str) -> Result<cpal::Device> {
    let host = cpal::default_host();

    if device_name == "default" {
        host.default_input_device()
            .context("No default input device available")
    } else {
        host.input_devices()
            .context("Failed to enumerate input devices")?
            .find(|d| d.name().map(|n| n == device_name).unwrap_or(false))
            .context(format!("Input device '{}' not found", device_name))
    }
}

// ============================================================================
// Sample Conversion Helpers
// ============================================================================

/// Convert f32 sample to i16
fn f32_to_i16(sample: &f32) -> i16 {
    let scaled = sample * i16::MAX as f32;
    scaled.clamp(i16::MIN as f32, i16::MAX as f32) as i16
}

/// Convert u16 sample to i16
fn u16_to_i16(sample: &u16) -> i16 {
    (*sample as i32 - 32768) as i16
}

// ============================================================================
// Audio Capture
// ============================================================================

/// Capture audio from the microphone and system, mix to stereo, and write to output
fn run_audio_capture(args: Args) -> Result<()> {
    // Get the input device
    let device = get_input_device(&args.device)?;
    let device_name = device.name().unwrap_or_else(|_| "Unknown".to_string());
    eprintln!("[INFO] Using input device: {}", device_name);

    // Get supported config
    let config = device
        .default_input_config()
        .context("Failed to get default input config")?;

    eprintln!(
        "[INFO] Device config: {} channels, {} Hz, {:?}",
        config.channels(),
        config.sample_rate().0,
        config.sample_format()
    );
    eprintln!(
        "[INFO] Target output: {} channels, {} Hz, i16 PCM",
        OUTPUT_CHANNELS, args.sample_rate
    );

    let input_sample_rate = config.sample_rate().0;
    let input_channels = config.channels();

    // Create ring buffer for mixed stereo output (mic + system)
    let ring = HeapRb::<i16>::new(RING_BUFFER_SIZE);
    let (producer, mut consumer) = ring.split();

    // Wrap producer in Arc<Mutex> for thread-safe sharing
    let producer = Arc::new(std::sync::Mutex::new(producer));

    // Create separate ring buffer for system audio (mono, for mixing)
    let system_ring = HeapRb::<i16>::new(SYSTEM_AUDIO_BUFFER_SIZE);
    let (system_producer, system_consumer) = system_ring.split();
    let system_producer = Arc::new(std::sync::Mutex::new(system_producer));
    let system_consumer = Arc::new(std::sync::Mutex::new(system_consumer));

    // Flag to signal shutdown
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    // Handle Ctrl+C
    ctrlc_handler(running.clone());

    // Initialize and start system audio capture
    let mut system_audio =
        system_audio::SystemAudioCapture::new(args.sample_rate, system_producer)?;
    if let Err(e) = system_audio.start() {
        // Use {:#} to show full error chain from anyhow
        eprintln!("[WARN] Failed to start system audio capture: {:#}", e);
        eprintln!("[WARN] Continuing with microphone only (Channel 0 will be silence)");
        eprintln!("[HINT] Make sure Screen Recording permission is granted in:");
        eprintln!("[HINT]   System Preferences → Privacy & Security → Screen Recording");
    }

    // Build the input stream based on sample format
    let err_fn = |err| {
        eprintln!("[ERROR] Audio stream error: {}", err);
    };

    let stream_config: cpal::StreamConfig = config.clone().into();

    let stream = match config.sample_format() {
        cpal::SampleFormat::I16 => {
            let mic_prod = Arc::clone(&producer);
            let sys_cons = Arc::clone(&system_consumer);
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    process_audio_data(
                        data,
                        input_sample_rate,
                        input_channels,
                        &mic_prod,
                        &sys_cons,
                        |s| *s,
                    );
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::F32 => {
            let mic_prod = Arc::clone(&producer);
            let sys_cons = Arc::clone(&system_consumer);
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    process_audio_data(
                        data,
                        input_sample_rate,
                        input_channels,
                        &mic_prod,
                        &sys_cons,
                        f32_to_i16,
                    );
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            let mic_prod = Arc::clone(&producer);
            let sys_cons = Arc::clone(&system_consumer);
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    process_audio_data(
                        data,
                        input_sample_rate,
                        input_channels,
                        &mic_prod,
                        &sys_cons,
                        u16_to_i16,
                    );
                },
                err_fn,
                None,
            )
        }
        format => {
            anyhow::bail!("Unsupported sample format: {:?}", format);
        }
    }
    .context("Failed to build input stream")?;

    stream.play().context("Failed to start audio stream")?;
    eprintln!("[INFO] Audio capture started. Press Ctrl+C to stop.");

    // Output writer (stdout or file)
    let mut output: Box<dyn Write> = if let Some(ref path) = args.output_file {
        eprintln!("[INFO] Writing output to file: {}", path);
        Box::new(BufWriter::new(
            File::create(path).context("Failed to create output file")?,
        ))
    } else {
        eprintln!("[INFO] Writing output to stdout");
        Box::new(BufWriter::new(io::stdout()))
    };

    // Buffer for reading from ring buffer
    let mut read_buffer = vec![0i16; 1024];

    // Main output loop
    while running_clone.load(Ordering::Relaxed) {
        // Read available samples from ring buffer
        let count = consumer.pop_slice(&mut read_buffer);

        if count > 0 {
            // Write samples as little-endian i16
            for &sample in &read_buffer[..count] {
                if output.write_i16::<LittleEndian>(sample).is_err() {
                    // Pipe closed (e.g., Electron process terminated)
                    eprintln!("[INFO] Output pipe closed");
                    running_clone.store(false, Ordering::Relaxed);
                    break;
                }
            }

            // Flush frequently for real-time streaming
            if output.flush().is_err() {
                eprintln!("[INFO] Output pipe closed");
                running_clone.store(false, Ordering::Relaxed);
            }
        } else {
            // No data available, sleep briefly to avoid busy-waiting
            std::thread::sleep(Duration::from_millis(10));
        }
    }

    // Cleanup
    drop(stream);
    system_audio.stop()?;
    eprintln!("[INFO] Audio capture stopped");

    Ok(())
}

/// Counter for process_audio_data calls (for debug logging)
static PROCESS_AUDIO_COUNTER: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

/// Process audio data from the input stream (microphone)
/// Mixes with system audio from the system_consumer ring buffer
fn process_audio_data<T, F>(
    data: &[T],
    input_sample_rate: u32,
    input_channels: u16,
    producer: &RingBufferProducer,
    system_consumer: &RingBufferConsumer,
    convert: F,
) where
    T: Copy,
    F: Fn(&T) -> i16,
{
    let call_count = PROCESS_AUDIO_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Convert samples to i16
    let samples_i16: Vec<i16> = data.iter().map(convert).collect();

    // Resample microphone to target rate (mono)
    let mic_resampled = resample_to_16khz_mono(&samples_i16, input_sample_rate, input_channels);

    // Get system audio samples from ring buffer (same count as mic samples)
    let (system_samples, system_read) = if let Ok(mut cons) = system_consumer.lock() {
        let available = cons.len();
        let mut buf = vec![0i16; mic_resampled.len()];
        let read = cons.pop_slice(&mut buf);
        if read < buf.len() {
            // Not enough system audio, fill rest with silence
            buf.truncate(read);
            buf.resize(mic_resampled.len(), 0);
        }
        (buf, (read, available))
    } else {
        // If we can't lock, use silence
        (vec![0i16; mic_resampled.len()], (0, 0))
    };

    // Log mixing details for first few calls and periodically
    if call_count < 5 || call_count.is_multiple_of(500) {
        eprintln!(
            "[DEBUG] Mixer #{}: mic={} samples, system={}/{} samples (read/available)",
            call_count,
            mic_resampled.len(),
            system_read.0,
            system_read.1
        );
    }

    // Mix to stereo (Channel 0 = System, Channel 1 = Mic)
    let stereo = mix_to_stereo(&system_samples, &mic_resampled);

    // Push to ring buffer (drop samples if buffer is full)
    if let Ok(mut prod) = producer.lock() {
        let _ = prod.push_slice(&stereo);
    }
}

/// Set up Ctrl+C handler
fn ctrlc_handler(running: Arc<AtomicBool>) {
    let _ = ctrlc::set_handler(move || {
        eprintln!("\n[INFO] Received Ctrl+C, shutting down...");
        running.store(false, Ordering::Relaxed);
    });
}

// ============================================================================
// Main Entry Point
// ============================================================================

fn main() -> Result<()> {
    let args = Args::parse();

    if args.list_devices {
        return list_audio_devices();
    }

    run_audio_capture(args)
}
