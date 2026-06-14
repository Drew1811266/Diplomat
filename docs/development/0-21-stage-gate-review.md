# Diplomat 0.21 Stage Gate Review

Review date: 2026-06-14

## Gate Decision

Status: accepted for 0.21 code integration.

0.21 is accepted because the desktop runtime contract, Worker environment wiring, FFmpeg/FFprobe status model, Settings diagnostics UI, and browser-mode fallback are implemented and covered by automated verification. A native Tauri window click-through was not completed in this Codex session; that gap is recorded below and carried forward as release-candidate manual verification because 0.21 intentionally does not package FFmpeg or a Worker sidecar.

## Scope Reviewed

- Desktop runtime directory contract.
- Worker lifecycle environment variables.
- `runtime_status` command shape.
- FFmpeg and FFprobe status classification.
- Worker default runtime use of configured tool paths.
- Settings runtime diagnostics UI.
- Browser-mode Settings fallback.

## Automated Verification Evidence

```powershell
.\scripts\check.ps1
corepack pnpm --dir apps/desktop test
```

Results:

- `.\scripts\check.ps1`: passed.
- Shared package tests: 23 passed.
- Desktop Rust tests: 13 passed.
- Web tests: 93 passed.
- Worker tests: 103 passed.
- `corepack pnpm --dir apps/desktop test`: passed, 13 passed.

Warnings observed:

- `pnpm install` reported ignored `esbuild` build scripts.
- Node reported a `url.parse()` deprecation warning.
- `pip` reported an available update.

None of these warnings block the 0.21 acceptance criteria.

## Runtime Tool Evidence

Host PATH checks:

```powershell
ffmpeg -version
ffprobe -version
```

Results:

- `ffmpeg`: not found on PATH.
- `ffprobe`: not found on PATH.

This is acceptable for 0.21 because this stage implements discovery and status reporting but does not bundle binaries. The missing-tool state is covered by Rust status classification tests and Settings rendering tests.

## Worker Runtime Integration Evidence

A controlled Worker API integration check set:

- `DIPLOMAT_DATA_DIR`
- `DIPLOMAT_FFMPEG_PATH`
- `DIPLOMAT_FFPROBE_PATH`

The check then created a project through the Worker API with a patched probe function that records the `ffprobe` executable path.

Observed result:

```json
{
  "health": {
    "name": "diplomat-worker",
    "status": "ok",
    "version": "0.2.0"
  },
  "projectStatusCode": 201,
  "projectId": "project-a645180a03f74c56b3698cf15df6724b",
  "durationMs": 12345,
  "databaseExists": true,
  "projectListed": true,
  "runtimeFfmpegPath": "C:\\Users\\Drew\\AppData\\Local\\Temp\\Diplomat-0.21-gate-0ocuwgt_\\tools\\ffmpeg.cmd",
  "runtimeFfprobePath": "C:\\Users\\Drew\\AppData\\Local\\Temp\\Diplomat-0.21-gate-0ocuwgt_\\tools\\ffprobe.cmd",
  "probeCalls": [
    {
      "ffprobePath": "C:\\Users\\Drew\\AppData\\Local\\Temp\\Diplomat-0.21-gate-0ocuwgt_\\tools\\ffprobe.cmd"
    }
  ]
}
```

This verifies that the Worker default runtime honors the configured data directory and FFmpeg/FFprobe path variables used by the desktop runtime contract.

## Settings UI Evidence

Browser-mode Settings smoke verification at `http://127.0.0.1:1420` confirmed:

```json
{
  "fallbackText": "Desktop runtime controls are unavailable in browser mode.",
  "hasHorizontalOverflow": false,
  "runtimeHeadingVisible": true,
  "workerUrlValue": "http://127.0.0.1:8765"
}
```

The desktop-mode Settings runtime panel is covered by `SettingsPage.test.tsx` using a mocked `runtime_status` response, including Worker status, FFmpeg status, FFprobe status, app directories, and Start/Stop/Open actions.

## Native Desktop Verification Status

Native Tauri window verification was not completed in this session. The unverified manual items are:

1. Capture a live `runtime_status` JSON payload from the native Tauri command bridge.
2. Start Worker from the native Settings page.
3. Confirm logs are written under `%LOCALAPPDATA%\Diplomat\logs` by the native desktop command.
4. Import a real local video through the desktop picker.
5. Create a project through the native app using real FFmpeg/FFprobe.

Reasons:

- FFmpeg and FFprobe are not installed on PATH on this host.
- 0.21 does not bundle FFmpeg by design.
- The current Codex session does not expose a reliable native Tauri window automation surface.

Disposition:

- Keep these checks in the 0.30 release-candidate manual verification pass.
- Re-run them earlier if FFmpeg/FFprobe become available locally before 0.30.

## Acceptance Checklist

- Desktop `runtime_status` command exists: accepted.
- Runtime directories are stable and app-owned: accepted.
- Worker starts with `DIPLOMAT_DATA_DIR`: accepted by Rust helper tests.
- Worker runtime honors FFmpeg/FFprobe environment paths: accepted by Worker tests and controlled integration.
- FFmpeg/FFprobe availability is detected and displayed: accepted by Rust and Settings tests.
- Browser-mode Settings fallback works: accepted by browser smoke verification.
- Full repository verification passes: accepted.
- Native desktop manual verification: deferred and documented.

## Remaining Limitations

- 0.21 does not bundle an FFmpeg binary.
- 0.21 does not package a Python Worker sidecar.
- Fixed Worker port remains `8765`.
- Native release walkthrough remains required before v0.3 final release.
