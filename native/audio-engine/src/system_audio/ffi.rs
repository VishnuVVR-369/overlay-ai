//! FFI bindings for direct Core Media / Core Audio access
//!
//! This module provides unsafe FFI bindings for extracting audio data from
//! CMSampleBuffer on macOS. These bindings are used as a fallback when the
//! higher-level ScreenCaptureKit API doesn't provide direct access to audio data.

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
    /// Extract audio buffer list from CMSampleBuffer
    ///
    /// # Safety
    /// This function is unsafe because it performs raw FFI calls. The caller must ensure:
    /// - `sbuf` is a valid CMSampleBuffer pointer
    /// - `buffer_list_out` points to valid memory if provided
    /// - All returned pointers are properly released with CFRelease
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
    /// Release a Core Foundation object
    ///
    /// # Safety
    /// This function is unsafe. The caller must ensure `cf` is a valid Core Foundation object.
    pub fn CFRelease(cf: *const c_void);
}
