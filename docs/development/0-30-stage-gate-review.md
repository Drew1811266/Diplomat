# Diplomat 0.30 Stage Gate Review

Date: 2026-06-14

Stage: 0.30 Release Hardening

Branch: `codex/0.30-release-hardening`

## Scope Accepted

0.30 turns the 0.2x feature line into the Diplomat 0.3.0 release candidate:

- Version metadata is unified at 0.3.0 across JS packages, Tauri, Cargo, Worker, lockfile metadata, and README.
- Release version verification is automated by `scripts/verify-version.mjs`.
- Shared release readiness schemas define pass, warning, and blocker checks.
- Worker exposes `GET /release/readiness`.
- Web Settings displays release readiness status, counts, checks, and remediation.
- Help Center is available from the app rail in English and Chinese.
- Tauri Windows NSIS bundle metadata and icons are active.
- Release packaging, privacy, model, FFmpeg, and acceptance documents are present.
- Built-in model registry entries use pinned Hugging Face snapshot sources and audited manifest checksums.
- Model downloader supports `hf://repo@revision` sources through `huggingface-hub`.
- Release readiness reports zero blockers when the release FFmpeg and FFprobe runtime paths are configured.

## Commits Reviewed

- `3f3cfde docs: plan 0.30 release hardening`
- `1f60c2c chore(release): verify 0.3 version metadata`
- `62a2919 feat(shared): add release readiness contract`
- `b803a5a feat(worker): expose release readiness checks`
- `5cf6af7 feat(web): add release readiness help center`
- `213d5e2 chore(release): add packaging docs and asset checks`
- `277f27e fix(release): clear model readiness blockers`
- `a555847 fix(web): prevent release readiness overflow`

## Focused Verification

All focused verification commands exited with status 0.

```powershell
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
```

Result: version metadata and release packaging assets verified for Diplomat 0.3.0.

```powershell
python -m pytest worker/tests/models/test_manager.py worker/tests/models/test_registry.py worker/tests/release/test_readiness.py worker/tests/api/test_app.py -q
```

Result: focused model manager, registry, release readiness, and API tests passed.

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/SettingsPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Result: Settings page tests and Web TypeScript passed after the mobile overflow fix.

## Full Verification

Latest full verification on final 0.30 branch head:

```powershell
python -m pip install -e '.\worker[dev]'
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
python -m pytest
corepack pnpm -r test
corepack pnpm -r typecheck
```

Results:

- Worker editable install completed as `diplomat-worker==0.3.0`.
- Python suite: 232 passed.
- Desktop Rust tests: 13 passed.
- Shared package tests: 6 files, 48 tests passed.
- Web Vitest suite: 28 files, 170 tests passed.
- TypeScript package checks passed for shared and web; desktop has no TypeScript sources.

## Release Readiness

Release runtime paths used for the gate:

```powershell
$env:DIPLOMAT_FFMPEG_PATH = (Resolve-Path ".\.dev\tools\ffmpeg-release-essentials\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe").Path
$env:DIPLOMAT_FFPROBE_PATH = (Resolve-Path ".\.dev\tools\ffmpeg-release-essentials\ffmpeg-8.1.1-essentials_build\bin\ffprobe.exe").Path
```

`GET http://127.0.0.1:8765/release/readiness` returned:

```json
{
  "version": "0.3.0",
  "ready": true,
  "summary": {
    "pass": 9,
    "warning": 0,
    "blocker": 0
  }
}
```

The passing checks covered:

- version metadata.
- FFmpeg availability.
- FFprobe availability.
- model registry checksums.
- model registry sources.
- model registry licenses.
- desktop packaging.
- Help Center.
- release documentation.

## Model Audit Evidence

The registry uses pinned Hugging Face snapshot sources and manifest checksums. A lightweight network audit checked remote model metadata without downloading the weights:

```text
asr.faster-whisper.small: bcfe217645389979477c3abc24b1d03f75b80fa6225f96a51d85f3ddae4f22b9
asr.faster-whisper.medium: 1b60d162dfa44c0fbc371d8f4593c6ba0fa0d1d631da1854014c88261a46a64a
translation.opus-mt.zh-en: 26ff589b3c7cdead35b5f9d5230a3a2cb25ad2e1ca4e52ccd7404d362f823256
translation.opus-mt.en-zh: 5be230bc6ec3bf6bc74356f44da071a224a723744c78065908def2e9318a8308
translation.qwen3.4b: b31e1da988e39a506f50ab27701e65a46c13a1bfea94e1bb180fe36cfbf354eb
```

Large real model downloads were not executed during the stage gate. The downloader path is covered by local fixture tests plus Hugging Face source parsing and manifest checksum tests.

## Browser Smoke

Browser smoke used the in-app Browser against:

- Worker: `http://127.0.0.1:8765`
- Web: `http://127.0.0.1:1420`
- FFmpeg: `.dev/tools/ffmpeg-release-essentials/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe`
- FFprobe: `.dev/tools/ffmpeg-release-essentials/ffmpeg-8.1.1-essentials_build/bin/ffprobe.exe`

Verified:

- Project Center loads as the first screen.
- App rail exposes Help and Settings.
- Help Center opens and shows First run, Model management, and Release checklist.
- Settings opens and shows Release readiness.
- Settings readiness shows `RELEASE READY`, `9 PASS`, `0 WARNING`, and `0 BLOCKER`.
- Readiness rows show FFmpeg, FFprobe, and model registry checks.
- Desktop viewport has no horizontal overflow.
- Mobile-width Help and Settings views have no horizontal overflow after the readiness row wrap fix.
- Browser console error count for the app tab: 0.

## Known Limitations

- The release installer must either bundle release-approved FFmpeg and FFprobe binaries or set equivalent runtime paths before the Worker starts. This repository does not commit FFmpeg binaries.
- Full real model downloads were not run because the curated models range from roughly 160 MB to 8 GB. The release gate validates pinned remote manifests; installation flow uses fixture and unit coverage.
- Final Windows installer creation was not run in this stage gate because the task scope was readiness hardening, not artifact publication. Tauri NSIS metadata is active and verified.

## Decision

0.30 meets the release hardening goal and is accepted for merge to `main`.
