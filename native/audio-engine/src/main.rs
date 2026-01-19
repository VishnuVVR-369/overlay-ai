//! Audio Engine - Rust sidecar for Overlay AI
//!
//! This binary captures microphone audio (and system audio on macOS via ScreenCaptureKit),
//! resamples to 24kHz, mixes into stereo (Channel 0 = System, Channel 1 = Mic),
//! and streams raw i16 PCM bytes to stdout for piping into Electron.
//!
//! Usage: ./audio-engine --device=default | (Electron reads stdout)
//!
//! The output format is:
//! - Encoding: linear16 (i16 little-endian)
//! - Sample rate: 24000 Hz
//! - Channels: 2 (stereo) - Channel 0: System Audio (Interviewer), Channel 1: Mic (You)

mod capture;
mod config;
mod device;
mod errors;
mod logging;
mod mixing;
mod resampling;
mod ring_buffer;
mod sample_conversion;
mod system_audio;

use anyhow::Result;
use capture::CaptureArgs;
use clap::Parser;
use config::TARGET_SAMPLE_RATE;
use device::list_audio_devices;

/// Audio capture engine for Overlay AI
///
/// Captures microphone audio and outputs raw PCM to stdout.
/// System audio capture on macOS requires ScreenCaptureKit.
///
/// Example: ./audio-engine --device=default | (Electron reads stdout)
#[derive(Parser, Debug)]
#[command(name = "audio-engine")]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Target sample rate in Hz (default: 24000 for Deepgram)
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

fn main() -> Result<()> {
    let args = Args::parse();

    if args.list_devices {
        return list_audio_devices();
    }

    capture::run_audio_capture(CaptureArgs {
        sample_rate: args.sample_rate,
        device: args.device,
        output_file: args.output_file,
    })
}
