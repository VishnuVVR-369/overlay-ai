# Overlay AI

A stealth live-interview assistant overlay built with Electron.

## What it does

- Stays invisible to screen sharing (Zoom, Meet, Teams) on macOS 14.4+ and Windows 10 v2004+.
- Hidden from dock (macOS), taskbar, and Alt-Tab (Windows).
- Continuously transcribes your microphone ("You") and system audio ("Them") via ElevenLabs Scribe v2 Realtime (~150 ms latency).
- On `Cmd/Ctrl+\`, sends the full session transcript to Groq's `openai/gpt-oss-120b` and streams the answer back.
- On `Cmd/Ctrl+Shift+\`, captures the active display, sends the screenshot plus transcript context to OpenAI's vision model, and streams the answer back.
- On `Cmd/Ctrl+B`, toggles window visibility.

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. Run in dev:
   ```sh
   npm run dev
   ```

3. On first launch, paste your ElevenLabs, Groq, and OpenAI API keys in the Settings panel.

## Permissions (macOS)

- **Microphone**: granted via the standard `getUserMedia` prompt on first capture.
- **Screen Recording**: required for system audio capture and screen ask. Grant in System Settings → Privacy & Security → Screen Recording → Overlay AI, then relaunch.

## Use headphones

Without headphones, your microphone will pick up the interviewer's voice from your speakers, which pollutes the "You" transcript stream. Always wear headphones.

## Build

```sh
npm run dist:mac    # macOS DMG
npm run dist:win    # Windows NSIS installer
```

Without code-signing certificates, installers run unsigned (right-click → Open on macOS, "More info → Run anyway" on Windows SmartScreen).

## Stack

Electron + electron-vite + React + TypeScript. State via zustand. Audio loopback via [`electron-audio-loopback`](https://github.com/alectrocute/electron-audio-loopback).
