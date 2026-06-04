# M0/M1 Core Pipeline

This document describes the first executable Diplomat path.

## Implemented In M0/M1

- Shared TypeScript subtitle and task schemas.
- Python Worker schema mirror.
- SQLite project store.
- FFmpeg source validation and media probing.
- Audio extraction command generation.
- Fixed-size recoverable chunk planning.
- Pluggable ASR interface.
- Deterministic fake ASR for tests.
- Optional faster-whisper adapter.
- Core pipeline that writes `subtitle.diplomat.json`.
- Minimal Worker health API.
- Minimal React shell.
- Minimal Tauri v2 shell.

## Running Checks

```powershell
.\scripts\check.ps1
```

## Running Worker API

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

## Running Web Shell

```powershell
corepack pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

## Running Desktop Shell

```powershell
corepack pnpm --filter @diplomat/desktop dev
```

This requires Rust and Tauri prerequisites.

## Current Pipeline Boundary

The M0/M1 pipeline writes Diplomat's internal subtitle document. It does not export SRT/VTT/ASS and does not burn subtitles into video. Those capabilities are covered by separate milestone plans.
