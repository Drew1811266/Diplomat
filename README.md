# Diplomat

Diplomat is a Windows-first local AI subtitle editor. It imports video files, runs local speech analysis, creates editable subtitle drafts, and prepares the project for subtitle export workflows.

This repository contains the MIT-licensed application source code. AI model weights are not part of this repository and keep their upstream licenses.

## M0/M1 Development Targets

- Monorepo foundation.
- Shared subtitle and task schemas.
- Python Worker core pipeline.
- FFmpeg preflight and audio extraction helpers.
- Pluggable ASR interface with deterministic fake tests.
- Minimal Worker API.
- Minimal React and Tauri shells.

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
python -m pip install -e .\worker[dev]
```

## Verify

```powershell
.\scripts\check.ps1
```

## Development Docs

- [M0/M1 Core Pipeline](docs/development/m0-m1-core-pipeline.md)
- [M2a Implementation Document](docs/development/m2a-implementation-document.md)
- [M2a Workbench Loop](docs/development/m2a-workbench-loop.md)
- [Product Design Spec](docs/superpowers/specs/2026-06-04-diplomat-ai-subtitle-editor-design.md)
