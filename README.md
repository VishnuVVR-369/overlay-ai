# Overlay AI

A stealth live-interview assistant overlay built with Electron.

## What it does

- Stays invisible to screen sharing (Zoom, Meet, Teams) on macOS 14.4+ and Windows 10 v2004+.
- Hidden from dock (macOS), taskbar, and Alt-Tab (Windows).
- Continuously transcribes your microphone ("You") and system audio ("Them") as 24 kHz PCM through separate server-side OpenAI GPT Live Transcribe WebSocket sessions.
- On `Cmd/Ctrl+\`, sends the full session transcript to OpenAI Responses using `gpt-5.6-sol` with low reasoning and streams the answer back.
- On `Cmd/Ctrl+Shift+\`, captures the active display, sends the screenshot plus transcript context to OpenAI's vision model, and streams the answer back.
- Keeps setup, personal context, prompts, mock practice, session history, and help in one tabbed command console.
- Keeps unsaved personal-context and system-prompt drafts while you navigate or reopen the console; personal context persists only after you save it, and API-key inputs are never retained as drafts.
- Opens a searchable command palette with `Cmd/Ctrl+K`.
- Cycles compact, normal, and wide layouts with `Cmd/Ctrl+Shift+E`.
- On `Cmd/Ctrl+Shift+B`, toggles window visibility; `Cmd/Ctrl+Shift+Escape` stops capture, clears the session, and hides the overlay.
- Runs voice mock interviews with `gpt-realtime-2.1` and saves their transcripts, rubric scores, feedback, and follow-up drills in History.

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. Run in dev:
   ```sh
   npm run dev
   ```

3. On first launch, paste your OpenAI API key in the command console's Setup tab.

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

## Install the latest local macOS app

On an Apple Silicon Mac, this builds the latest `origin` revision, stages and validates the app bundle, then replaces `/Applications/Overlay AI.app`. The existing app is deleted only after the staged replacement validates successfully:

```sh
npm run install:mac
```

Use `npm run install:mac -- --dry-run` to build and validate the staged replacement without changing the installed app. The command requires a clean Git working tree so it can safely fast-forward to the latest upstream revision.

## Stack

Electron + electron-vite + React + TypeScript. State via zustand. Audio loopback via [`electron-audio-loopback`](https://github.com/alectrocute/electron-audio-loopback).
