# Overlay AI

A stealth overlay assistant for technical interviews. Captures audio in real-time, transcribes it using Deepgram, and generates contextual answers with an LLM.

## Features

- **Real-time transcription** - Captures microphone (and system audio on supported platforms) via a native Rust sidecar
- **20-minute rolling context** - Maintains conversation history for accurate, context-aware responses
- **Stealth mode** - Overlay window is invisible to screen capture software (Zoom, Teams, OBS)
- **Global hotkeys** - Control everything without switching windows
- **Streaming LLM responses** - Get answers as they're generated

## Prerequisites

- Node.js 18+
- Rust toolchain (for building the audio engine)
- macOS (primary), Windows support planned

## Installation

```bash
# Install dependencies
npm install

# Build the Rust audio sidecar
npm run build:native
```

## Configuration

Create a `.env` file in the project root:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key
GROQ_API_KEY=your_groq_api_key
```

## Usage

```bash
# Development mode
npm run dev

# Build for production
npm run build:all

# Package for distribution
npm run package:mac
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+L` | Toggle Live Mode (start/stop audio capture) |
| `Cmd+Shift+X` | Generate Answer (send context to LLM) |
| `Cmd+Shift+Z` | Clear Overlay |

## Architecture

```
┌─────────────┐    PCM     ┌─────────────┐   WebSocket   ┌──────────┐
│ audio-engine│ ─────────► │  Electron   │ ────────────► │ Deepgram │
│   (Rust)    │   stdout   │   Main      │               │   API    │
└─────────────┘            └──────┬──────┘               └────┬─────┘
                                  │                           │
                                  │ IPC                       │ transcript
                                  ▼                           ▼
                           ┌─────────────┐            ┌─────────────┐
                           │  Renderer   │◄───────────│  Context    │
                           │  (React)    │            │  Buffer     │
                           └─────────────┘            └──────┬──────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │  LLM (Groq) │
                                                      └─────────────┘
```

## Project Structure

```
overlay-ai/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React UI (overlay)
│   └── lib/           # Shared types
├── native/
│   └── audio-engine/  # Rust audio capture binary
├── scripts/           # Build scripts
└── tests/             # Verification tests
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build TypeScript + Vite |
| `npm run build:native` | Compile Rust sidecar |
| `npm run build:all` | Build everything |
| `npm run package` | Package for distribution |
| `npm test` | Run tests |
| `npm run typecheck` | Type check |

## Tech Stack

- **Runtime**: Electron 29+
- **Language**: TypeScript 5.4, Rust
- **UI**: React 18, Tailwind CSS
- **Audio**: cpal (Rust), ScreenCaptureKit (macOS)
- **Transcription**: Deepgram Nova-2
- **LLM**: Groq (GPT OSS 120B)

## How It Works

1. The Rust sidecar captures microphone audio and outputs raw PCM to stdout
2. Electron pipes this audio to Deepgram for real-time transcription
3. Transcripts are stored in a rolling 20-minute context buffer (~4000 tokens)
4. When triggered, the full context is sent to the LLM with a system prompt optimized for interview assistance
5. Streaming responses are rendered in the transparent overlay

## License

Private
