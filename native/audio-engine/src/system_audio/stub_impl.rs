//! Stub implementation for non-macOS platforms

use crate::ring_buffer::RingBufferProducer;
use anyhow::Result;

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
