/**
 * Build script for the Rust audio-engine sidecar
 *
 * Per PLAN.md Phase 10:
 * This script:
 * 1. Runs `cargo build --release` in native/audio-engine/
 * 2. Copies the compiled binary to resources/bin/ with platform-specific naming
 *
 * Usage: node scripts/build-audio-engine.js [--check-only]
 */

const { execSync } = require('child_process');
const { copyFileSync, mkdirSync, existsSync, chmodSync } = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.join(__dirname, '..');
const AUDIO_ENGINE_DIR = path.join(PROJECT_ROOT, 'native', 'audio-engine');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'resources', 'bin');

// Platform-specific binary names per PLAN.md
const BINARY_CONFIG = {
  darwin: {
    sourceName: 'audio-engine',
    outputName: 'audio-engine-mac',
  },
  win32: {
    sourceName: 'audio-engine.exe',
    outputName: 'audio-engine-win.exe',
  },
  linux: {
    sourceName: 'audio-engine',
    outputName: 'audio-engine-linux',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function log(message) {
  console.log(`[build-audio-engine] ${message}`);
}

function error(message) {
  console.error(`[build-audio-engine] ERROR: ${message}`);
}

function getPlatformConfig() {
  const config = BINARY_CONFIG[process.platform];
  if (!config) {
    error(`Unsupported platform: ${process.platform}`);
    process.exit(1);
  }
  return config;
}

function getSourceBinaryPath() {
  const config = getPlatformConfig();
  return path.join(AUDIO_ENGINE_DIR, 'target', 'release', config.sourceName);
}

function getOutputBinaryPath() {
  const config = getPlatformConfig();
  return path.join(OUTPUT_DIR, config.outputName);
}

function checkRustInstalled() {
  try {
    execSync('cargo --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkCargoProject() {
  return existsSync(path.join(AUDIO_ENGINE_DIR, 'Cargo.toml'));
}

// ============================================================================
// Build Steps
// ============================================================================

function runCargoBuild() {
  log('Running cargo build --release...');

  try {
    execSync('cargo build --release', {
      cwd: AUDIO_ENGINE_DIR,
      stdio: 'inherit',
    });
    log('Cargo build completed successfully');
    return true;
  } catch (err) {
    error(`Cargo build failed: ${err.message}`);
    return false;
  }
}

function copyBinary() {
  const sourcePath = getSourceBinaryPath();
  const outputPath = getOutputBinaryPath();

  // Check if source binary exists
  if (!existsSync(sourcePath)) {
    error(`Built binary not found at: ${sourcePath}`);
    return false;
  }

  // Create output directory if needed
  if (!existsSync(OUTPUT_DIR)) {
    log(`Creating output directory: ${OUTPUT_DIR}`);
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Copy binary
  log(`Copying binary:`);
  log(`  From: ${sourcePath}`);
  log(`  To:   ${outputPath}`);

  try {
    copyFileSync(sourcePath, outputPath);

    // Make executable on Unix
    if (process.platform !== 'win32') {
      chmodSync(outputPath, 0o755);
      log('Set executable permissions');
    }

    return true;
  } catch (err) {
    error(`Failed to copy binary: ${err.message}`);
    return false;
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check-only');

  log('='.repeat(60));
  log('Building Rust audio-engine sidecar');
  log('='.repeat(60));
  log(`Platform: ${process.platform}`);
  log(`Architecture: ${process.arch}`);
  log(`Audio engine dir: ${AUDIO_ENGINE_DIR}`);
  log(`Output dir: ${OUTPUT_DIR}`);

  // Pre-flight checks
  log('\nRunning pre-flight checks...');

  if (!checkRustInstalled()) {
    error('Rust/Cargo is not installed. Please install from https://rustup.rs/');
    process.exit(1);
  }
  log('Rust/Cargo: OK');

  if (!checkCargoProject()) {
    error('Cargo.toml not found in native/audio-engine/');
    error('Please ensure the Rust project is initialized');
    process.exit(1);
  }
  log('Cargo.toml: OK');

  if (checkOnly) {
    log('\nCheck-only mode: Skipping build');
    log('All pre-flight checks passed');
    process.exit(0);
  }

  // Build
  log('\n' + '-'.repeat(60));
  if (!runCargoBuild()) {
    process.exit(1);
  }

  // Copy binary
  log('\n' + '-'.repeat(60));
  if (!copyBinary()) {
    process.exit(1);
  }

  // Success
  log('\n' + '='.repeat(60));
  log('Build completed successfully!');
  log(`Binary available at: ${getOutputBinaryPath()}`);
  log('='.repeat(60));
}

main();
