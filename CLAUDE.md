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

### Mono-repo layout

The repository contains three separate apps, each in its own package:

| Package | Path | Role |
|---|---|---|
| `desktop` | `apps/desktop/` | Electron app — wake word, STT, LLM, TTS, UI |
| `tools-server` | `apps/tools-server/` | Node.js HTTP server on **port 3001** — general tools (memory, web search, weather, reminders…) |
| `system-tools-server` | `apps/system-tools-server/` | Node.js HTTP server on **port 7824** — OS/system tools (screenshot, shutdown, notifications…) |

The two tool servers run as **independent Node.js processes** — they are not embedded in Electron. `apps/desktop/` spawns and manages them at startup via child_process, and communicates with them over HTTP from the main process (`toolsClient`).

---

### Electron process model

The desktop app is split into three Electron layers:

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main  (apps/desktop/src/main/)                │
│  Node.js full access — I/O, child processes, IPC        │
│  • Wake word (ONNX), STT sidecar, Ollama client, TTS   │
│  • Spawns tool servers; calls them via HTTP             │
│  • Sends IPC events to renderer                         │
└────────────────────┬────────────────────────────────────┘
                     │ contextBridge (ipcMain ↔ ipcRenderer)
┌────────────────────▼────────────────────────────────────┐
│  Preload  (apps/desktop/src/preload/)                   │
│  Isolated bridge — exposes a typed `window.jarvis` API  │
│  • Wraps ipcRenderer calls into safe named methods      │
│  • No direct Node.js access in renderer                 │
└────────────────────┬────────────────────────────────────┘
                     │ window.jarvis.*
┌────────────────────▼────────────────────────────────────┐
│  Renderer  (apps/desktop/src/renderer/)                 │
│  React/Three.js UI — sandboxed, no Node.js             │
│  • Subscribes to IPC events via window.jarvis.on*()    │
│  • Drives orb animation + conversation view             │
│  • State: eventBus (runtime) + sessionStore (Zustand)  │
└─────────────────────────────────────────────────────────┘
```

**Rule**: renderer code must never import from `src/main/` or call Node APIs directly. All cross-boundary communication goes through preload → IPC → main.

### Speech pipeline (main process)

```
WakeWordProcess (ONNX via onnxruntime-node)
    → handleWake() → SpeechSession created
        → Chrome STT Sidecar (Web Speech API, WebSocket port 7823)
            → handleSttEvent(partial|final)
                → SpeechSession.onFinal() → handleUserMessage()
                    → responseOrchestrator → ollamaClient (streaming)
                        → tool calls dispatched via toolsClient (HTTP)
                        → TTS Piper (piper binary + aplay, sentence-chunked)
                            → IPC assistant:speaking_start/end → renderer
```

Chrome STT Sidecar (`src/main/sttSidecar.ts`): headless Chrome process communicates via WebSocket. Main → Chrome: `session-start` / `session-end`. Chrome → Main: `partial`, `final`, `log-*`.

Tokenizer microservice (`src/main/llm/tokenizer_server.py`): FastAPI server on port 8123, started at app launch. Counts tokens via HuggingFace transformers for Llama 3, Mistral, Qwen. Used by `ollamaClient` to trim conversation history before each LLM call. Falls back to char-count estimation on timeout.

### IPC channels

Main → Renderer:
- `assistant:wake` — wake word detected
- `assistant:speech_start` — speech session opened
- `assistant:speech_expired` — speech session timed out without a response (→ idle)
- `assistant:partial_transcript` / `assistant:final_transcript` — Chrome STT output
- `assistant:thinking_start` — LLM call started
- `assistant:llm_stream_start` / `assistant:llm_token` / `assistant:llm_response` — LLM streaming
- `assistant:llm_error` — LLM call failed
- `assistant:speaking_start` / `assistant:speaking_end` — TTS playback boundaries
- `assistant:tool_call` / `assistant:tool_result` — tool execution events
- `assistant:llm_queued` — LLM task enqueued but blocked (Ollama busy) — triggers UI waiting indicator
- `assistant:reminder` — a due reminder was triggered (`{ text: string }`)
- `conversation:cleared` — conversation reset
- `service:status` — service lifecycle updates (`{ service, status }`)

Renderer → Main:
- `app:startup-complete` — renderer ready, enables wake word
- `mic:set-muted` — mute/unmute microphone
- `tts:set-volume` — adjust TTS volume
- `tts:replay` — replay last response
- `assistant:user_text` — text input from UI
- `conversation:clear` — clear conversation history
- `stt:session-start` / `stt:session-end` — forwarded to Chrome sidecar

### Renderer state architecture (two separate systems)

**1. `eventBus`** (`src/renderer/src/runtime/event-bus.ts`): typed event emitter for runtime state transitions. Emitting an event automatically updates `runtimeState` and notifies `OrbController`. Events: `wake-word-detected`, `speech-start`, `speech-end`, `thinking-start`, `thinking-end`, `tool-running`, `tool-finished`, `error`.

**2. `sessionStore`** (Zustand, `src/renderer/src/store/sessionStore.ts`): conversation data — `messages[]`, `partialTranscript`. Used by `ConversationView` for rendering.

`App.tsx` bridges IPC events to both systems: speech/state events → `eventBus.emit()`, transcript/response events → `sessionStore`.

### Orb visualization

The orb (`src/renderer/src/orb/`) is a Three.js particle system with 5 states: `idle`, `listening`, `thinking`, `speaking`, `error`. State machine lives in `createorb.ts` with per-frame interpolated animation parameters (radius, speed, brightness, vortex, breathing). `OrbController` subscribes to `eventBus` and calls `orb.setState()`.

---

## Implementation specs

The `.docs/` directory contains the full design specs for each subsystem. **Always read the relevant spec before implementing or extending a system.** The technical docs (jarvis_16+) are the authoritative reference:

| Doc | System | Key files |
|---|---|---|
| `.docs/jarvis_16_cognitive_core_orchestration_ia.md` | Cognitive Core — context manager, prompt orchestrator, memory integration, tool reasoning, response planner | `src/main/speech/conversation/` |
| `.docs/jarvis_17_memory_system_temporal_intelligence.md` | Memory System — working/episodic/semantic memory, temporal engine, retrieval, consolidation | `src/main/memory/` |
| `.docs/jarvis_18_tool_runtime_function_calling.md` | Tool Runtime — registry, validation, execution pipeline, permissions, tool chaining | `src/main/tools/` |
| `.docs/jarvis_19_heartbeat_engine_proactivite.md` | Heartbeat Engine — scheduler cycles, attention engine, reminder system, background tasks, recovery | `src/main/heartbeat/`, `src/main/taskQueue.ts` |
| `.docs/jarvis_20_vision_desktop_context_awareness.md` | Desktop Context Awareness — OS integration, context signals | — |
| `.docs/jarvis_21_ui_ux_desktop_application_orb_interface.md` | UI/UX & Orb Interface — panels, notification system, visual states | `src/renderer/src/orb/`, `src/renderer/src/components/` |
| `.docs/jarvis_22_local_ai_stack_models_performance_architecture.md` | Local AI Stack — model selection, performance, embeddings | `src/main/llm/` |
| `.docs/jarvis_23_security_permissions_trust_architecture.md` | Security & Permissions — trust model, tool access control | — |
| `.docs/jarvis_25_development_roadmap_implementation_phases.md` | Roadmap — implementation phases, priorities | — |
| `.docs/jarvis_26_final_global_architecture_summary_system_blueprint.md` | Global blueprint — full system map | — |

The earlier docs (jarvis_01–15) are the philosophical/design layer behind the same subjects. The jarvis_16+ docs are the technical specs to implement from.

**Rules:**
- Before implementing or extending any of these systems, read the relevant spec.
- Follow the spec. Do not deviate without flagging it explicitly.
- If a request contradicts the spec, or the spec is ambiguous/incomplete, say so before implementing — don't silently diverge.

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
