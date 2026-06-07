# Diplomat

Diplomat is a Windows-first local AI subtitle editor. It imports video files, runs local speech analysis, creates editable subtitle drafts, and prepares the project for subtitle export workflows.

This repository contains the MIT-licensed application source code. AI model weights are not part of this repository and keep their upstream licenses.

## Current Development Targets

- Monorepo foundation.
- Shared subtitle and task schemas.
- Python Worker core pipeline.
- FFmpeg preflight and audio extraction helpers.
- Pluggable ASR interface with deterministic fake tests.
- Local background analysis jobs with progress, cancellation, and retry.
- Optional faster-whisper ASR provider for real local transcription.
- Local fake translation provider and optional LibreTranslate provider.
- Background translation jobs with settings, progress, cancellation, and retry.
- React subtitle workbench with project reopen, analysis job controls, editing, saving, and SRT export.
- Web translation controls, missing translation filtering, edited target text tracking, and bilingual SRT export.
- Tauri development shell with Worker lifecycle support.

## Requirements

- Windows 11 or a current Windows development environment.
- Node.js 24 or newer.
- pnpm via Corepack.
- Python 3.12.
- Rust stable toolchain for Tauri.
- FFmpeg available on PATH for media integration tests.

## Setup

```powershell
corepack enable
pnpm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".\worker[dev]"
# Optional faster-whisper support
python -m pip install -e ".\worker[dev,asr]"
```

## Verify

```powershell
.\scripts\check.ps1
```

## Development Docs

- [M0/M1 Core Pipeline](docs/development/m0-m1-core-pipeline.md)
- [M2a Implementation Document](docs/development/m2a-implementation-document.md)
- [M2a Workbench Loop](docs/development/m2a-workbench-loop.md)
- [M2b Usability Foundation](docs/development/m2b-usability-foundation.md)
- [M3 Real ASR MVP](docs/development/m3-real-asr-mvp.md)
- [M3 Stage Gate Review](docs/development/m3-stage-gate-review.md)
- [M4 Translation And Bilingual Subtitles](docs/development/m4-translation-bilingual.md)
- [M4 Stage Gate Review](docs/development/m4-stage-gate-review.md)
- [M2b-M6 Development Roadmap](docs/development/m2b-m6-development-roadmap.md)
- [Product Design Spec](docs/superpowers/specs/2026-06-04-diplomat-ai-subtitle-editor-design.md)
