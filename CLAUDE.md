# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project: Jarvis

Jarvis is a **local-first, ambient voice assistant** for Linux. It aims for the feel of a calm, persistent cognitive layer — always listening, contextually aware, non-intrusive. Voice is the primary interface; text chat is the fallback. The system is explicitly designed to avoid being a chatty LLM wrapper: short, natural responses are the default.

---

## Commands

All commands run from `apps/desktop/`:

```bash
# Install deps (from repo root)
pnpm install

# Development (Electron + Vite hot reload)
pnpm dev

# Type checking only
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Build for Linux
pnpm build:linux

# Build (includes typecheck)
pnpm build
```

Python environment: `.venv/` at the repo root — all Python subprocesses use `.venv/bin/python`.

---

## Architecture

### Process boundary

**Electron main process** (`src/main/`) handles all I/O and speech pipeline:
- Spawns Python subprocesses for wake-word detection, VAD, and Whisper ASR
- Runs the Ollama LLM client
- Bridges events to the renderer via IPC

**Renderer process** (`src/renderer/`) is a pure React/Three.js UI:
- Receives IPC events and drives the orb + conversation view
- Captures microphone audio via AudioWorklet and sends chunks to main via `window.jarvis.sendAudioChunk()`
- Maintains conversation state in Zustand

### Speech pipeline (main process)

```
Microphone (AudioWorklet, 16kHz Float32)
    → IPC audio:chunk
        → WakeWordProcess (ONNX via onnxruntime-node)
            → VAD (Python: silero-vad via websocket)
                → WhisperServer (Python: faster-whisper, websocket)
                    → ollamaClient (llama3.1:8b, localhost:11434)
                        → IPC assistant:llm_response → renderer
```

Each Python component extends `PyServer` (`src/main/pyServers/pyServer.ts`) — a generic subprocess lifecycle manager (start/stop/send with stdout/stderr callbacks).

### IPC channels

Main → Renderer:
- `assistant:wake` — wake word detected
- `assistant:speech_start` / `assistant:speech_end` — VAD boundaries
- `assistant:partial_transcript` / `assistant:final_transcript` — Whisper output
- `assistant:thinking_start` — LLM call started
- `assistant:llm_response` — LLM reply ready
- `assistant:llm_error` — LLM call failed

Renderer → Main:
- `audio:chunk` — Float32Array audio chunk from AudioWorklet

### Renderer state architecture (two separate systems)

**1. `eventBus`** (`src/renderer/src/runtime/event-bus.ts`): typed event emitter for runtime state transitions. Emitting an event automatically updates `runtimeState` and notifies `OrbController`. Events: `wake-word-detected`, `speech-start`, `speech-end`, `thinking-start`, `thinking-end`, `tool-running`, `tool-finished`, `error`.

**2. `sessionStore`** (Zustand, `src/renderer/src/store/sessionStore.ts`): conversation data — `messages[]`, `partialTranscript`. Used by `ConversationView` for rendering.

`App.tsx` bridges IPC events to both systems: speech/state events → `eventBus.emit()`, transcript/response events → `sessionStore`.

### Orb visualization

The orb (`src/renderer/src/orb/`) is a Three.js particle system with 5 states: `idle`, `listening`, `thinking`, `speaking`, `error`. State machine lives in `createorb.ts` with per-frame interpolated animation parameters (radius, speed, brightness, vortex, breathing). `OrbController` subscribes to `eventBus` and calls `orb.setState()`.

---

## Key design constraints

- **Local-first**: Ollama runs at `localhost:11434`, model `llama3.1:8b`. No cloud calls in the hot path.
- **Python path**: Always use `.venv/bin/python` for subprocesses.
- **Short responses**: The system prompt instructs Jarvis to answer in 1–2 sentences. Preserve this.
- **Event-driven**: New main process capabilities should emit IPC events rather than returning values; new renderer capabilities should subscribe to `eventBus` or `sessionStore`.
- **No UI logic in main**: Main process is orchestration-only; visual state belongs in renderer.

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 39 |
| Frontend | React 19, TypeScript, Vite (electron-vite) |
| 3D visualization | Three.js |
| State management | Zustand 5 |
| Wake word | ONNX model via `onnxruntime-node` |
| VAD | Python / silero-vad (PyServer websocket) |
| STT | Python / faster-whisper (PyServer websocket) |
| LLM | Ollama (local, llama3.1:8b) |
| Logging | Winston (main), console (renderer) |
| Python env | `.venv/` at repo root |
