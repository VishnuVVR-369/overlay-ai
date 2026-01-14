//! Build script for audio-engine
//!
//! This ensures the correct rpath is set for Swift runtime libraries,
//! which are required by the screencapturekit crate.

fn main() {
    // Only needed on macOS
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() != "macos" {
        return;
    }

    // Use the system Swift library path (macOS 12.3+ has Swift runtime built-in)
    // This avoids duplicate symbol warnings from loading multiple Swift runtimes
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}
