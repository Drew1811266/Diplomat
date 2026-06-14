# Diplomat 0.31 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.31

Decision: accepted for merge to `main`.

Distribution caveat: a separate clean Windows VM install was not available in this session. The repository gate passes because the packaged worker sidecar starts from the generated binary, the NSIS installer builds successfully, and full automated verification passes. Before distributing a public installer, repeat the manual clean-machine smoke from `docs/development/0-31-desktop-runtime-packaging.md`.

## Scope Completed

- Advanced release metadata to `0.31.0` across JavaScript packages, Tauri, Cargo, Python worker, README, and version verification.
- Added desktop Worker launch modes for packaged, development, external, and blocked-port states.
- Added packaged Worker sidecar discovery for `diplomat-worker.exe` and Tauri's Windows sidecar name.
- Added packaged FFmpeg and FFprobe resource discovery with environment override and PATH fallback.
- Surfaced Worker launcher mode in runtime status and the Settings page.
- Added Tauri bundle metadata for the Worker sidecar and FFmpeg/FFprobe resources.
- Added `scripts/prepare-desktop-runtime.ps1` to prepare local release artifacts.
- Added `scripts/verify-0.31-desktop-runtime.ps1` to verify metadata, prepare runtime artifacts, build web, and build the desktop installer.
- Hardened PowerShell verification scripts so native command failures return nonzero.
- Updated Worker release readiness to compare against the current worker package version instead of the old `0.3.0` literal.

## Verification Evidence

Passed:

```powershell
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
corepack pnpm --dir apps/desktop test
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web typecheck
.\scripts\verify-0.31-desktop-runtime.ps1
python -m pytest worker/tests/api/test_app.py::test_health_endpoint_returns_worker_status worker/tests/api/test_app.py::test_release_readiness_route_reports_tool_blockers_without_model_audit_blockers worker/tests/release/test_readiness.py
.\scripts\check.ps1
```

Packaged Worker health smoke:

```json
{"name":"diplomat-worker","status":"ok","version":"0.31.0"}
```

Generated installer:

```text
D:\Software Project\Diplomat\apps\desktop\src-tauri\target\release\bundle\nsis\Diplomat_0.31.0_x64-setup.exe
```

Artifact sizes from the local build:

```text
diplomat-worker.exe                         425100942 bytes
diplomat-worker-x86_64-pc-windows-msvc.exe 425100942 bytes
ffmpeg.exe                                  101457920 bytes
ffprobe.exe                                 101251072 bytes
Diplomat_0.31.0_x64-setup.exe               479419363 bytes
```

Full repository check result:

```text
232 Python tests passed.
20 desktop Rust tests passed.
48 shared package tests passed.
170 web tests passed.
TypeScript checks passed.
```

## Known Limitations

- The PyInstaller Worker sidecar currently pulls in heavy optional dependencies including `torch`, `transformers`, `scipy`, and related packages. This makes the Worker sidecar about 425 MB and is the main optimization target for 0.33.
- NSIS installer size is about 479 MB because the current installer includes the large Worker sidecar and FFmpeg/FFprobe resources.
- Vite reports a non-blocking large chunk warning for the web bundle.
- Tauri reports a non-blocking identifier warning for `dev.diplomat.app`; this matters more if macOS packaging is added later.
- FFmpeg and FFprobe were copied from the local `.dev\tools` release bundle for verification. Public redistribution still needs the release licensing checklist before external distribution.
- Clean Windows VM install smoke was not executed in this session.

## Stage Gate Result

0.31 meets the repository merge gate for desktop runtime packaging. The next stage can start from `main` after this branch is merged and pushed.
