# Diplomat 0.35 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.35

Decision: accepted for merge to `main` with release caveats.

Release caveat: real packaged-installer, one-hour video, three-hour video, GPU, and crash-recovery operator acceptance were not executed with representative production assets in this session. The repository gate passes because the final release metadata, translation batch recovery, evidence writer, opt-in evidence scripts, focused tests, script smoke checks, and full automated repository verification all pass.

## Scope Completed

- Advanced release metadata to `0.35.0` across JavaScript packages, Tauri, Cargo, Python worker, README, lock metadata, and version verification.
- Added translation batch persistence after each successful translation batch.
- Verified canceled translation jobs preserve completed translated batches and retry only remaining missing lines.
- Added `diplomat_worker.release.evidence` for timestamped 0.35 release evidence JSON.
- Added opt-in PowerShell evidence scripts:
  - `scripts/verify-0.35-installer.ps1`
  - `scripts/verify-0.35-long-video.ps1`
  - `scripts/verify-0.35-crash-resume.ps1`
- Added explicit `-PythonExe` support for the evidence scripts so packaged or local acceptance runs can use a known Python interpreter.
- Updated 0.35 release-gate documentation with evidence script parameters and expected evidence files.
- Added 0.35 development and implementation planning documents.

## Verification Evidence

Passed:

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py worker/tests/release/test_evidence.py worker/tests/release/test_readiness.py -q
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
corepack pnpm --dir packages/shared test
corepack pnpm --dir apps/web typecheck
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-installer.ps1 -Help
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-long-video.ps1 -Help
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.35-crash-resume.ps1 -Help
python -m diplomat_worker.release.evidence --help
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Focused verification result:

```text
21 focused Worker translation recovery, release evidence, and readiness tests passed.
50 shared package tests passed.
Web TypeScript check passed.
0.35 evidence CLI help passed.
0.35 installer, long-video, and crash-resume script help passed.
0.35 evidence script smoke wrote installer, long_video, and crash_resume JSON reports with placeholder local artifacts under .dev/evidence-smoke.
```

Full repository check result:

```text
Release version metadata verified for 0.35.0.
Release packaging assets verified for Diplomat 0.35.0.
20 desktop Rust tests passed.
50 shared package tests passed.
175 web tests passed.
TypeScript checks passed.
267 Python tests passed.
```

## Known Limitations

- Real Windows installer smoke was not executed in this session.
- Real one-hour and three-hour media acceptance was not executed in this session.
- GPU-specific model runtime behavior was not verified on a CUDA machine in this session.
- Evidence scripts verify and record operator-supplied artifacts; they do not replace actually running the packaged desktop workflow.
- Translation batch persistence preserves completed batches, but process-kill timing can still lose the currently executing batch if the process exits before that batch returns.
- `pnpm` reports ignored `esbuild` build scripts during install; this remains a non-blocking local dependency policy warning in the current environment.

## Stage Gate Result

0.35 meets the repository merge gate for the final desktop stability stage. Public release should remain caveated until operator-provided installer, one-hour, three-hour, GPU, and crash-resume evidence files are generated and archived.
