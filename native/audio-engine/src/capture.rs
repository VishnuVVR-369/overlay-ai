//! Audio capture and streaming
//!
//! This module provides the main audio capture loop that:
//! - Captures microphone audio via CPAL
//! - Captures system audio (macOS only)
//! - Mixes both into stereo
//! - Outputs raw PCM to stdout or file

use crate::config::{
    LOG_INTERVAL_MIXER, OUTPUT_BUFFER_SIZE, OUTPUT_CHANNELS, RING_BUFFER_SIZE, SLEEP_MS_NO_DATA,
    SYSTEM_AUDIO_BUFFER_SIZE,
};
use crate::device::get_input_device;
use crate::errors::AudioEngineError;
use crate::mixing::mix_to_stereo;
use crate::resampling::resample_to_16khz_mono;
use crate::ring_buffer::{create_ring_buffer, RingBufferConsumer, RingBufferProducer};
use crate::sample_conversion::SampleConverter;
use crate::system_audio::SystemAudioCapture;
use anyhow::{Context, Result};
use byteorder::{LittleEndian, WriteBytesExt};
use cpal::traits::{DeviceTrait, StreamTrait};
use std::fs::File;
use std::io::{self, BufWriter, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Counter for process_audio_data calls (for debug logging)
static PROCESS_AUDIO_COUNTER: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

/// Arguments for audio capture
pub struct CaptureArgs {
    pub sample_rate: u32,
    pub device: String,
    pub output_file: Option<String>,
}

/// Capture audio from the microphone and system, mix to stereo, and write to output
pub fn run_audio_capture(args: CaptureArgs) -> Result<()> {
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

    // Create ring buffers
    let (producer, consumer) = create_ring_buffer(RING_BUFFER_SIZE);
    let (system_producer, system_consumer) = create_ring_buffer(SYSTEM_AUDIO_BUFFER_SIZE);

    // Flag to signal shutdown
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    // Handle Ctrl+C
    ctrlc_handler(running.clone());

    // Initialize and start system audio capture
    let mut system_audio = SystemAudioCapture::new(args.sample_rate, system_producer)?;
    if let Err(e) = system_audio.start() {
        // Use {:#} to show full error chain from anyhow
        eprintln!("[WARN] Failed to start system audio capture: {:#}", e);
        eprintln!("[WARN] Continuing with microphone only (Channel 0 will be silence)");
        eprintln!("[HINT] Make sure Screen Recording permission is granted in:");
        eprintln!("[HINT]   System Preferences → Privacy & Security → Screen Recording");
    }

    // Build the input stream based on sample format
    let stream = build_input_stream(
        &device,
        &config,
        input_sample_rate,
        input_channels,
        &producer,
        &system_consumer,
    )?;

    stream.play().context("Failed to start audio stream")?;
    eprintln!("[INFO] Audio capture started. Press Ctrl+C to stop.");

    // Output writer (stdout or file)
    let mut output = create_output_writer(&args.output_file)?;

    // Main output loop
    run_output_loop(consumer, &mut output, &running_clone)?;

    // Cleanup
    drop(stream);
    system_audio.stop()?;
    eprintln!("[INFO] Audio capture stopped");

    Ok(())
}

/// Build input stream for the given device and config
fn build_input_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    input_sample_rate: u32,
    input_channels: u16,
    producer: &RingBufferProducer,
    system_consumer: &RingBufferConsumer,
) -> Result<cpal::Stream> {
    let err_fn = |err| {
        eprintln!("[ERROR] Audio stream error: {}", err);
    };

    let stream_config: cpal::StreamConfig = config.clone().into();

    let stream = match config.sample_format() {
        cpal::SampleFormat::I16 => build_stream_for_format(
            device,
            &stream_config,
            input_sample_rate,
            input_channels,
            producer,
            system_consumer,
            err_fn,
            <i16 as SampleConverter<i16>>::to_i16,
        ),
        cpal::SampleFormat::F32 => build_stream_for_format(
            device,
            &stream_config,
            input_sample_rate,
            input_channels,
            producer,
            system_consumer,
            err_fn,
            <f32 as SampleConverter<f32>>::to_i16,
        ),
        cpal::SampleFormat::U16 => build_stream_for_format(
            device,
            &stream_config,
            input_sample_rate,
            input_channels,
            producer,
            system_consumer,
            err_fn,
            <u16 as SampleConverter<u16>>::to_i16,
        ),
        format => {
            return Err(AudioEngineError::UnsupportedFormat(format).into());
        }
    }
    .context("Failed to build input stream")?;

    Ok(stream)
}

/// Build stream for a specific sample format
#[allow(clippy::too_many_arguments)]
fn build_stream_for_format<T, F>(
    device: &cpal::Device,
    stream_config: &cpal::StreamConfig,
    input_sample_rate: u32,
    input_channels: u16,
    producer: &RingBufferProducer,
    system_consumer: &RingBufferConsumer,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
    convert: F,
) -> Result<cpal::Stream>
where
    T: cpal::Sample + cpal::SizedSample + Send + 'static,
    F: Fn(&T) -> i16 + Send + 'static + Clone,
{
    let mic_prod = Arc::clone(producer);
    let sys_cons = Arc::clone(system_consumer);
    let convert_clone = convert.clone();

    device
        .build_input_stream(
            stream_config,
            move |data: &[T], _: &cpal::InputCallbackInfo| {
                process_audio_data(
                    data,
                    input_sample_rate,
                    input_channels,
                    &mic_prod,
                    &sys_cons,
                    &convert_clone,
                );
            },
            err_fn,
            None,
        )
        .context("Failed to build input stream")
}

/// Process audio data from the input stream (microphone)
/// Mixes with system audio from the system_consumer ring buffer
fn process_audio_data<T, F>(
    data: &[T],
    input_sample_rate: u32,
    input_channels: u16,
    producer: &RingBufferProducer,
    system_consumer: &RingBufferConsumer,
    convert: &F,
) where
    T: Copy,
    F: Fn(&T) -> i16,
{
    let call_count = PROCESS_AUDIO_COUNTER.fetch_add(1, Ordering::Relaxed);

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
    if call_count < 5 || call_count.is_multiple_of(LOG_INTERVAL_MIXER) {
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

/// Create output writer (stdout or file)
fn create_output_writer(output_file: &Option<String>) -> Result<BufWriter<Box<dyn Write + Send>>> {
    if let Some(ref path) = output_file {
        eprintln!("[INFO] Writing output to file: {}", path);
        Ok(BufWriter::new(Box::new(
            File::create(path).context("Failed to create output file")?,
        )))
    } else {
        eprintln!("[INFO] Writing output to stdout");
        Ok(BufWriter::new(Box::new(io::stdout())))
    }
}

/// Main output loop that reads from ring buffer and writes to output
fn run_output_loop(
    consumer: RingBufferConsumer,
    output: &mut BufWriter<Box<dyn Write + Send>>,
    running: &Arc<AtomicBool>,
) -> Result<()> {
    let mut read_buffer = vec![0i16; OUTPUT_BUFFER_SIZE];

    while running.load(Ordering::Relaxed) {
        // Read available samples from ring buffer
        let count = if let Ok(mut cons) = consumer.lock() {
            cons.pop_slice(&mut read_buffer)
        } else {
            0
        };

        if count > 0 {
            // Write samples as little-endian i16
            for &sample in &read_buffer[..count] {
                if output.write_i16::<LittleEndian>(sample).is_err() {
                    // Pipe closed (e.g., Electron process terminated)
                    eprintln!("[INFO] Output pipe closed");
                    running.store(false, Ordering::Relaxed);
                    break;
                }
            }

            // Flush frequently for real-time streaming
            if output.flush().is_err() {
                eprintln!("[INFO] Output pipe closed");
                running.store(false, Ordering::Relaxed);
            }
        } else {
            // No data available, sleep briefly to avoid busy-waiting
            std::thread::sleep(Duration::from_millis(SLEEP_MS_NO_DATA));
        }
    }

    Ok(())
}

/// Set up Ctrl+C handler
fn ctrlc_handler(running: Arc<AtomicBool>) {
    let _ = ctrlc::set_handler(move || {
        eprintln!("\n[INFO] Received Ctrl+C, shutting down...");
        running.store(false, Ordering::Relaxed);
    });
}
