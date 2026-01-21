# =============================================================================
# Overlay-AI Docker Build Configuration
# =============================================================================
# This Dockerfile provides a consistent development environment for:
# - Running linting, type checking, and tests
# - Building TypeScript and Rust components
# - CI/CD pipeline support
#
# Note: Since this is a GUI desktop app (Electron), Docker cannot run the full
# application. Use native development for running the actual app.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage: node-base
# Common Node.js setup with essential build tools
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS node-base

# Install essential build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage: node-deps
# Install npm dependencies
# -----------------------------------------------------------------------------
FROM node-base AS node-deps

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build tools)
RUN npm ci

# Copy source files
COPY . .

# -----------------------------------------------------------------------------
# Stage: rust-base
# Common Rust setup with linting tools
# -----------------------------------------------------------------------------
FROM rust:1.83-bookworm AS rust-base

# Install Rust components for linting
RUN rustup component add clippy rustfmt

WORKDIR /app/native/audio-engine

# -----------------------------------------------------------------------------
# Stage: rust-builder-linux
# Rust build environment with ALSA for Linux audio library compilation
# -----------------------------------------------------------------------------
FROM rust-base AS rust-builder-linux

# Install system dependencies for cpal audio library (Linux/ALSA)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files first for dependency caching
COPY native/audio-engine/Cargo.toml native/audio-engine/Cargo.lock* ./

# Create dummy src to build dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Build dependencies only (cached layer)
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Copy actual source
COPY native/audio-engine/src ./src

# Build the Linux binary
RUN cargo build --release

# -----------------------------------------------------------------------------
# Stage: rust-builder-windows
# Cross-compile Rust for Windows using mingw-w64
# -----------------------------------------------------------------------------
FROM rust-base AS rust-builder-windows

# Install mingw-w64 for Windows cross-compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc-mingw-w64-x86-64 \
    && rm -rf /var/lib/apt/lists/*

# Add Windows target
RUN rustup target add x86_64-pc-windows-gnu

# Configure cargo for cross-compilation
RUN mkdir -p ~/.cargo && \
    echo '[target.x86_64-pc-windows-gnu]' >> ~/.cargo/config.toml && \
    echo 'linker = "x86_64-w64-mingw32-gcc"' >> ~/.cargo/config.toml

# Copy Cargo files first for dependency caching
COPY native/audio-engine/Cargo.toml native/audio-engine/Cargo.lock* ./

# Create dummy src to build dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Build dependencies only (cached layer)
RUN cargo build --release --target x86_64-pc-windows-gnu 2>/dev/null || true
RUN rm -rf src

# Copy actual source
COPY native/audio-engine/src ./src

# Build the Windows binary
RUN cargo build --release --target x86_64-pc-windows-gnu

# -----------------------------------------------------------------------------
# Stage: rust-builder (alias for Linux builder - backward compatibility)
# -----------------------------------------------------------------------------
FROM rust-builder-linux AS rust-builder

# -----------------------------------------------------------------------------
# Stage: test-runner
# Run Vitest tests
# -----------------------------------------------------------------------------
FROM node-deps AS test-runner

CMD ["npm", "run", "test"]

# -----------------------------------------------------------------------------
# Stage: ci
# Full CI pipeline: lint + typecheck + test + build
# -----------------------------------------------------------------------------
FROM node-deps AS ci

# Default command runs the full CI pipeline
CMD ["sh", "-c", "npm run lint && npm run typecheck && npm run format:check && npm run test && npm run build"]

# -----------------------------------------------------------------------------
# Stage: dev
# Interactive development shell
# -----------------------------------------------------------------------------
FROM node-deps AS dev

# Install additional tools useful for development
RUN apt-get update && apt-get install -y --no-install-recommends \
    vim \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up a nicer shell experience
ENV TERM=xterm-256color

# Default to bash shell
CMD ["/bin/bash"]
