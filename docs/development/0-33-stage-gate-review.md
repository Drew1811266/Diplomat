# Diplomat 0.33 Stage Gate Review

Review date: 2026-06-15 Asia/Shanghai local build time

Stage: 0.33

Decision: accepted for merge to `main`.

Release caveat: a real local-model benchmark against representative 1-3 hour media was not executed in this session. The repository gate passes because runtime profile metadata, preflight hardware validation, model reuse, CTranslate2 batch execution, runtime diagnostics, benchmark report writing, focused tests, and full automated verification all pass. Before a public long-video desktop release, run `scripts/run-0.33-benchmark.ps1` with real media and record the generated report.

## Scope Completed

- Advanced release metadata to `0.33.0` across JavaScript packages, Tauri, Cargo, Python worker, README, lock metadata, and version verification.
- Added Worker runtime capability detection with CUDA availability and device count.
- Added model runtime profiles for faster-whisper, CTranslate2 Marian, and local LLM catalog entries.
- Exposed `runtimeProfiles` through the Worker model catalog API and shared TypeScript schemas.
- Added ASR and translation resolver preflight validation for unavailable CUDA profiles.
- Added runtime failure classification for out-of-memory and CUDA-unavailable errors.
- Reused faster-whisper model instances across chunked transcription calls.
- Added optional batch translation support and CTranslate2 Marian batch execution.
- Added `batchSize` to translation job payloads and shared schemas.
- Added opt-in benchmark report dataclasses, JSON writer, module CLI, and `scripts/run-0.33-benchmark.ps1`.
- Added frontend runtime profile explanations and disabled formal starts when the selected profile is unavailable.
- Changed Workbench default local profiles to CPU/int8 so the formal desktop path starts from a stable fallback profile.

## Verification Evidence

Passed:

```powershell
python -m pytest worker/tests/models worker/tests/translation/test_ct2_marian.py worker/tests/tasks/test_translation_jobs.py worker/tests/test_benchmarks.py worker/tests/tasks/test_errors.py -q
.\apps\web\node_modules\.bin\vitest.cmd run src/pages/ModelsPage.test.tsx src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx
.\apps\web\node_modules\.bin\vitest.cmd run tests/api.test.ts
.\apps\web\node_modules\.bin\vitest.cmd run src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Focused verification result:

```text
34 focused Worker model, translation, benchmark, and runtime error tests passed.
20 focused web model/profile inspector tests passed.
36 web API helper tests passed after synchronizing batchSize expectations.
55 Workbench and inspector integration tests passed.
```

Full repository check result:

```text
Release version metadata verified for 0.33.0.
Release packaging assets verified for Diplomat 0.33.0.
20 desktop Rust tests passed.
48 shared package tests passed.
172 web tests passed.
TypeScript checks passed.
257 Python tests passed.
```

## Known Limitations

- Real local-model benchmark smoke with representative long media was not executed in this session.
- Benchmark script currently records operator-provided metadata and elapsed report-writing time; it does not execute the full ASR or translation pipeline by itself.
- Automatic terminology consistency and glossary calibration across long-video chunks remain 0.34+ work.
- GPU-specific performance and memory behavior still needs validation on machines with a working NVIDIA CUDA runtime.
- `pnpm` reports ignored `esbuild` build scripts during install; this is a non-blocking local dependency policy warning in the current environment.

## Stage Gate Result

0.33 meets the repository merge gate for model runtime performance foundations. The next stage can start from `main` after this branch is merged and pushed.
