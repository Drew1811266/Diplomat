# Diplomat 0.31 Desktop Runtime Packaging

Date: 2026-06-14

Stage: 0.31

## Objective

Make the installed Windows desktop app own the local runtime. A user should be able to install and open Diplomat without a developer checkout, manually activated Python environment, or separate Worker terminal.

## Current Baseline

The 0.3 desktop shell can build an NSIS installer and can start a Worker in development mode. The current launcher still starts `python -m uvicorn diplomat_worker.api.app:app --app-dir worker` from a discovered repository root. That is not sufficient for an installed end-user desktop app.

FFmpeg and FFprobe are currently release-readiness inputs through environment paths or PATH discovery. The repository does not commit FFmpeg binaries, and the installer smoke path still needs release-approved runtime packaging.

## Deliverables

- Packaged-mode Worker launcher that does not depend on repository discovery.
- Development-mode Worker launcher remains available for local development.
- Worker sidecar or equivalent release executable discovery.
- FFmpeg and FFprobe release runtime discovery from bundled resources or explicit packaged paths.
- Runtime status distinguishes development launcher, packaged launcher, external Worker, and blocked port.
- Worker logs are always written to application-owned log directories.
- Tauri bundle metadata includes the planned Worker and media runtime artifacts.
- Release asset verifier checks packaged runtime metadata.
- Clean Windows install smoke instructions and script support.
- Settings or readiness UI reports actual packaged paths and launcher mode.

## Non-Goals

- Do not bundle model weights.
- Do not solve long-video ASR chunking in 0.31.
- Do not introduce cloud services.
- Do not require GPU validation in this stage.

## Architecture

The desktop shell owns runtime discovery and process launch. The Worker continues to expose FastAPI on `127.0.0.1:8765`. Web continues to talk to the Worker through the existing local HTTP boundary.

Launcher resolution order:

1. Existing reachable Diplomat Worker on port 8765.
2. Packaged Worker sidecar in release mode.
3. Development Worker from repository root in development mode.
4. Blocked state when another service owns the port.

FFmpeg and FFprobe resolution order:

1. `DIPLOMAT_FFMPEG_PATH` and `DIPLOMAT_FFPROBE_PATH`.
2. Packaged app resource paths.
3. System PATH fallback for development.

## Acceptance Criteria

- Packaged desktop launcher does not call `find_repo_root` for release startup.
- Development startup still works from the repository.
- Runtime status reports launcher mode and actual Worker command source.
- FFmpeg and FFprobe paths reported by Settings are the same paths passed to the Worker.
- Clean-machine smoke can install, open, start Worker, inspect runtime paths, and create a project.
- Full repository verification passes.

## Focused Verification

```powershell
corepack pnpm --dir apps/desktop test
corepack pnpm --dir apps/web test -- SettingsPage.test.tsx
node .\scripts\verify-release-assets.mjs
corepack pnpm --dir apps/desktop build
```

Manual clean install smoke:

1. Build the NSIS installer.
2. Install into a clean Windows profile or VM.
3. Launch from Start menu.
4. Open Settings.
5. Confirm Worker status, FFmpeg status, FFprobe status, data path, model path, and logs path.
6. Create a project using a local video path or file picker.
7. Confirm Worker logs are written under the app-owned log directory.

## Stage Gate

0.31 is accepted only when the packaged runtime starts without a development repository and all focused plus full verification commands pass.

