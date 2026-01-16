//! macOS implementation of system audio capture

use crate::config::SCREEN_CAPTURE_SAMPLE_RATE;
use crate::logging::DebugLogger;
use crate::ring_buffer::RingBufferProducer;
use anyhow::{Context, Result};
use screencapturekit::cm::CMTime;
use screencapturekit::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::handler::SystemAudioHandler;

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
    /// Debug logger
    logger: Arc<DebugLogger>,
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
            logger: Arc::new(DebugLogger::default()),
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
        let content = SCShareableContent::get()
            .context("Failed to get shareable content. Is Screen Recording permission granted?")?;

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
        let sck_sample_rate = SCREEN_CAPTURE_SAMPLE_RATE as i32;

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
        let handler = SystemAudioHandler::new(
            Arc::clone(&self.producer),
            sck_sample_rate as u32,
            self.sample_rate,
            Arc::clone(&self.logger),
        );

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
