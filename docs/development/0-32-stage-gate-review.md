# Diplomat 0.32 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.32

Decision: accepted for merge to `main`.

Release caveat: a real local-model, real-media long-video smoke was not executed in this session. The repository gate passes because chunk manifests, persisted chunk outputs, retry reuse, faster-whisper chunk clipping, API retry behavior, and full automated verification all pass. Before a public long-video release, repeat the manual smoke from `docs/development/0-32-long-media-asr.md` with a real local ASR model and representative media.

## Scope Completed

- Advanced release metadata to `0.32.0` across JavaScript packages, Tauri, Cargo, Python worker, README, and version verification.
- Added manifest-backed ASR chunk metadata under `cache/asr/<task-id>/manifest.json`.
- Added atomic per-chunk ASR result persistence under `cache/asr/<task-id>/chunks/`.
- Added deterministic chunk output merge with overlap de-duplication, monotonic timings, and stable segment ordering.
- Updated faster-whisper execution to honor single-chunk `clip_timestamps` and disable previous-text conditioning for chunked runs.
- Updated the core pipeline to transcribe one chunk at a time, reuse valid current-task chunk outputs, and copy valid previous-task outputs during retry.
- Updated analysis retry tasks to record `resumeTaskId` and pass it into the core pipeline.
- Updated API expectations so retry payloads preserve the resume source task.

## Verification Evidence

Passed:

```powershell
python -m pytest worker/tests/asr/test_chunk_store.py worker/tests/asr/test_merge.py worker/tests/asr/test_faster_whisper.py worker/tests/pipeline/test_long_asr.py worker/tests/tasks/test_analysis_jobs.py -q
python -m pytest worker/tests/api/test_app.py -q
.\apps\web\node_modules\.bin\vitest.cmd run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Focused verification result:

```text
25 focused Worker ASR, pipeline, and task tests passed.
Worker API tests passed.
44 focused web tests passed.
```

Full repository check result:

```text
Release version metadata verified for 0.32.0.
Release packaging assets verified for Diplomat 0.32.0.
20 desktop Rust tests passed.
48 shared package tests passed.
170 web tests passed.
TypeScript checks passed.
244 Python tests passed.
```

## Known Limitations

- Real local-model smoke with representative long media was not executed in this session.
- Speaker diarization remains out of scope for 0.32.
- Translation glossary and cross-chunk terminology consistency remain 0.34+ work.
- Chunk sizing is currently fixed at 30 seconds with 500 ms overlap; 0.33 should add runtime benchmarking and tuning guidance before large-scale desktop use.
- `pnpm --dir apps/web exec vitest ...` did not resolve `vitest` in this PowerShell session, although direct invocation through `apps/web/node_modules/.bin/vitest.cmd` and `scripts/check.ps1` both passed.

## Stage Gate Result

0.32 meets the repository merge gate for recoverable long-media ASR. The next stage can start from `main` after this branch is merged and pushed.
