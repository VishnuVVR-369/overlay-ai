# Overlay AI

A stealth overlay assistant for technical interviews. Captures audio in real-time, transcribes it using Deepgram, and generates contextual answers with an LLM.

## Features

- **🎙️ Real-time transcription** - Captures microphone and system audio via a native Rust sidecar, with speaker identification (interviewer vs you)
- **💾 20-minute rolling context** - Maintains conversation history for accurate, context-aware responses
- **👻 Stealth mode** - Overlay window is invisible to screen capture software (Zoom, Teams, OBS)
- **⌨️ Global hotkeys** - Control everything without switching windows or losing focus
- **⚡ Streaming LLM responses** - Get answers as they're generated with real-time markdown rendering
- **📱 Minimize mode** - Reduce overlay to a compact view to focus on the interviewer
- **🎯 Custom system prompts** - Customize how the AI assistant behaves for different interview scenarios
- **🔐 Secure key storage** - API keys are encrypted and stored locally on your device
- **🖱️ Draggable overlay** - Position the window anywhere on your screen
- **📊 Status indicators** - Clear visual feedback on connection and generation states

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

## Quick Start Guide

1. **Get your API keys** (free tiers available):
   - [Deepgram API Key](https://console.deepgram.com/) - for transcription
   - [Groq API Key](https://console.groq.com/) - for AI answers

2. **Configure the app**:
   - Run `npm run dev`
   - Click the Settings (⚙️) icon in the overlay
   - Add your API keys and save

3. **Start your interview**:
   - Press `Cmd+Shift+L` to start transcription
   - Press `Cmd+Shift+M` to minimize overlay when needed
   - Press `Cmd+Shift+X` when you need help with a question

4. **Stay hidden**:
   - The overlay is invisible to Zoom, Teams, OBS, and other screen sharing tools
   - You can drag it anywhere on your screen

## Keyboard Shortcuts

| Shortcut      | Action                                            |
| ------------- | ------------------------------------------------- |
| `Cmd+Shift+L` | Toggle Live Mode (start/stop audio capture)       |
| `Cmd+Shift+X` | Generate Answer (send context to LLM)             |
| `Cmd+Shift+Z` | Clear Overlay (clears display, preserves context) |
| `Cmd+Shift+M` | Toggle Minimize Mode (expand/collapse overlay)    |

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
│   │   ├── components/  # UI components (HelpModal, AnswerCard, etc.)
│   │   └── hooks/      # Custom React hooks
│   └── lib/           # Shared types and utilities
├── native/
│   └── audio-engine/  # Rust audio capture binary
├── scripts/           # Build scripts
└── tests/             # Verification tests
```

## Customization

### System Prompts

You can customize how the AI assistant behaves by editing the system prompt in Settings:

- Default prompt is optimized for technical interviews
- Customize for specific roles (frontend, backend, ML, etc.)
- Adjust tone (concise, detailed, explanation-focused)

### Transcript Display

- Shows last 60 seconds of conversation
- Groups segments by speaker for readability
- Interim (in-progress) text shown with reduced opacity
- Automatic scrolling to latest content

## Scripts

| Script                 | Description              |
| ---------------------- | ------------------------ |
| `npm run dev`          | Start development server |
| `npm run build`        | Build TypeScript + Vite  |
| `npm run build:native` | Compile Rust sidecar     |
| `npm run build:all`    | Build everything         |
| `npm run package`      | Package for distribution |
| `npm test`             | Run tests                |
| `npm run typecheck`    | Type check               |

## Tech Stack

- **Runtime**: Electron 29+
- **Language**: TypeScript 5.4, Rust
- **UI**: React 18, Tailwind CSS, custom glass morphism design system
- **Audio**: cpal (Rust), ScreenCaptureKit (macOS)
- **Transcription**: Deepgram Nova-2 WebSocket API
- **LLM**: Groq (GPT OSS 120B, Llama 3.1)
- **Markdown**: Streamdown (streaming markdown renderer)
- **State Management**: React Hooks with custom overlay state management
- **Storage**: electron-store (encrypted local storage)

## How It Works

1. The Rust sidecar captures microphone and system audio, outputting raw PCM data
2. Electron pipes this audio to Deepgram for real-time transcription with speaker detection
3. Transcripts are stored in a rolling 20-minute context buffer (~4000 tokens)
4. When triggered, the full context is sent to Groq's LLM with a system prompt optimized for interview assistance
5. Streaming responses are rendered with markdown support (code blocks, lists, formatting) in the transparent overlay
6. The overlay window is flagged to be invisible to screen capture software for privacy

## Troubleshooting

### Transcription not working

- Verify your Deepgram API key is correct in Settings
- Make sure Live Mode is active (green indicator in header)
- Check that your microphone is not muted in system settings
- Try restarting the app

### Answers not generating

- Verify your Groq API key is valid in Settings
- Ensure you have at least a few seconds of transcript before triggering
- Check the status indicator - it may show an error if there are API issues

### Build errors

- Make sure Rust toolchain is installed (`rustc --version`)
- Run `npm run clean:all` then `npm install` to reset dependencies
- For macOS audio capture issues, check Screen Recording permissions in System Settings

### Overlay not visible/invisible

- Press `Cmd+Shift+M` to toggle minimize mode
- Check if the window was dragged off-screen - restart the app
- The overlay is designed to be invisible to screen sharing tools (this is normal behavior)

## License

Private
