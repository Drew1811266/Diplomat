# Diplomat 0.40 Two-To-Three-Hour Acceptance Implementation Plan

> For agentic workers: this is the final 0.4 gate. Do not mark accepted until a real 2-3 hour run completes.

**Goal:** Validate Diplomat 0.4 with a real 2-3 hour video using the approved ASR and translation model targets.

**Hard Gate:** The local development machine now has the Hunyuan license acceptance record and Hunyuan MT FP8 weights. 0.40 execution now proceeds through a short-video `smoke` profile before the final 2-3 hour `release` profile. The user-provided short video is English and must be translated to Chinese.

**Progress Note:** Preflight, model preparation, media candidate scanning, long-video runner tooling, short-video smoke profile, preflight-only media/model validation, ASR chunk evidence checks, glossary quality checks, runtime-cleanup evidence checks, subtitle-completeness checks, export-artifact evidence checks, completed-summary verification, the PowerShell verification wrapper, VibeVoice ASR runtime validation, Hunyuan MT FP8 adapter preparation, and Hunyuan real-model smoke are implemented. The local English-to-Chinese short-video smoke run passed at `.dev/acceptance/0-40/smoke-20260619-120854`. The final two-to-three-hour release-profile acceptance run passed at `.dev/acceptance/0-40/release-20260619-163807`.

## Files

- Modify: version metadata files from `0.39.0` to `0.40.0` only after preflight requirements are satisfied.
- Create: `scripts/acceptance/check-0-40-readiness.py`
- Create: `scripts/acceptance/find-0-40-media-candidates.py`
- Create: `scripts/acceptance/prepare-0-40-models.py`
- Create: `scripts/acceptance/run-0-40-three-hour.py`
- Create: `scripts/acceptance/verify-0-40-acceptance-summary.py`
- Create: `docs/development/0-40-stage-gate-review.md`
- Modify Worker model adapters as needed once real model APIs are validated locally.

## Task 1: Preflight Tooling

- [ ] Add `scripts/acceptance/check-0-40-readiness.py`.
- [ ] Add `scripts/acceptance/find-0-40-media-candidates.py`.
- [ ] Check:
  - VibeVoice expected files exist.
  - Hunyuan expected files exist.
  - Hunyuan acceptance record exists.
  - Model weights remain ignored by Git.
  - Worker can import required optional runtime dependencies.
- [ ] The script must return nonzero while any hard gate is missing.
- [ ] Run:

```powershell
python .\scripts\acceptance\check-0-40-readiness.py
```

Expected now: fail with missing model files/license record.

## Task 2: Real Model Runtime Validation

- [ ] Use `scripts/acceptance/prepare-0-40-models.py` to prepare local model files after license review.
- [ ] Validate VibeVoice ASR model loading against the local model folder.
- [ ] Implement or adjust the VibeVoice transcriber adapter.
- [ ] Validate Hunyuan MT FP8 local loading against the local model folder.
- [ ] Implement or adjust the Hunyuan translation provider path.
- [ ] Confirm ASR and translation run sequentially and cleanup logs appear.

## Task 3: Two-To-Three-Hour Acceptance Runner

- [ ] Add `scripts/acceptance/run-0-40-three-hour.py`.
- [ ] Add `scripts/acceptance/verify-0-40-acceptance-summary.py`.
- [ ] The runner must:
  - Accept a real source video path.
  - Reject release-profile media shorter than two hours before model preflight.
  - Support `--acceptance-profile smoke` for short-video full workflow testing before the final release run.
  - Reject media with no audio stream before model preflight.
  - Reject audio-only containers with no video stream before model preflight.
  - Support a preflight-only mode that validates media, model readiness, model paths, and glossary parsing without starting ASR or translation.
  - Resolve manifest-verified `models/dev` paths for the selected real models.
  - Create a project.
  - Start ASR.
  - Wait for completion.
  - Fail acceptance if ASR chunk manifest is missing, duration coverage is incomplete, or any listed chunk result file is missing/corrupt.
  - Fail acceptance if ASR cleanup logs do not show the runtime resource was closed.
  - Start translation.
  - Pass optional glossary terms into translation for terminology validation.
  - Wait for completion.
  - Fail acceptance if translation cleanup logs do not show the runtime resource was closed.
  - Fail acceptance for CUDA-mode tasks unless the diagnostic logs show CUDA accelerator cache cleanup.
  - Fail acceptance if the final subtitle document has blank source lines, missing translations, failed translation states, incomplete translation states, timing corruption, or glossary quality issues.
  - Generate SRT, VTT, and ASS subtitle export artifacts and record them in `acceptance-summary.json`.
  - Save paths to logs, subtitle output, and timing summary.
  - Return nonzero on any failed task or missing output.
- [ ] The summary verifier must reject preflight-only, failed, partial, fake, or incomplete `acceptance-summary.json` files.

## Task 4: Version, Verification, Gate

- [x] Update release metadata to `0.40.0`.
- [ ] Run focused tests.
- [x] Run the short-video smoke acceptance runner with `--source-language en --target-language zh`.
- [x] Run the 2-3 hour acceptance runner.
- [x] Run the completed acceptance summary verifier:

```powershell
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary <evidence-dir>\acceptance-summary.json
```

- [x] Run full verification:

```powershell
.\scripts\check.ps1
```

- [x] Write `docs/development/0-40-stage-gate-review.md` with real run evidence.

## Task 5: Merge And Push

- [ ] Merge only after acceptance evidence exists.
- [ ] Push `main` to GitHub.

## Current Blockers

- Full repository verification, merge to `main`, push, and `v0.40` tag are still pending.
