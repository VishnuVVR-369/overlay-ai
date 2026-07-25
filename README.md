# Overlay AI

A stealth live-interview assistant overlay built with Electron.

## What it does

- Stays invisible to screen sharing (Zoom, Meet, Teams) on macOS 14.4+ and Windows 10 v2004+.
- Hidden from dock (macOS), taskbar, and Alt-Tab (Windows).
- Continuously transcribes your microphone ("You") and system audio ("Them") via ElevenLabs Scribe v2 Realtime (~150 ms latency).
- On `Cmd/Ctrl+\`, sends the full session transcript to Groq's `openai/gpt-oss-120b` and streams the answer back.
- On `Cmd/Ctrl+Shift+\`, captures the active display, sends the screenshot plus transcript context to OpenAI's vision model, and streams the answer back.
- Keeps setup, personal context, prompts, mock practice, session history, and help in one tabbed command console.
- Keeps unsaved personal-context and system-prompt drafts while you navigate or reopen the console; personal context persists only after you save it, and API-key inputs are never retained as drafts.
- Opens a searchable command palette with `Cmd/Ctrl+K`.
- Cycles compact, normal, and wide layouts with `Cmd/Ctrl+Shift+E`.
- On `Cmd/Ctrl+Shift+B`, toggles window visibility; `Cmd/Ctrl+Shift+Escape` stops capture, clears the session, and hides the overlay.
- Runs voice mock interviews and saves their transcripts, rubric scores, feedback, and follow-up drills in History.

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. Run in dev:
   ```sh
   npm run dev
   ```

3. On first launch, paste your ElevenLabs, Groq, and OpenAI API keys in the command console's Setup tab.

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
