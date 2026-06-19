# Diplomat 0.40 Three-Hour Acceptance Implementation Plan

> For agentic workers: this is the final 0.4 gate. Do not mark accepted until a real three-hour run completes.

**Goal:** Validate Diplomat 0.4 with a real three-hour video using the approved ASR and translation model targets.

**Hard Gate:** The local development machine now has the Hunyuan license acceptance record and Hunyuan MT FP8 weights. 0.40 execution remains blocked until a representative three-hour source video is selected and the full real-model acceptance run succeeds.

**Progress Note:** Preflight, model preparation, three-hour runner tooling, preflight-only media/model validation, ASR chunk evidence checks, glossary quality checks, runtime-cleanup evidence checks, subtitle-completeness checks, the PowerShell verification wrapper, VibeVoice ASR runtime validation, Hunyuan MT FP8 adapter preparation, and Hunyuan real-model smoke are implemented. Final 0.40 acceptance remains pending until a three-hour source video is selected and the full acceptance run succeeds.

## Files

- Modify: version metadata files from `0.39.0` to `0.40.0` only after preflight requirements are satisfied.
- Create: `scripts/acceptance/check-0-40-readiness.py`
- Create: `scripts/acceptance/prepare-0-40-models.py`
- Create: `scripts/acceptance/run-0-40-three-hour.py`
- Create: `docs/development/0-40-stage-gate-review.md`
- Modify Worker model adapters as needed once real model APIs are validated locally.

## Task 1: Preflight Tooling

- [ ] Add `scripts/acceptance/check-0-40-readiness.py`.
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

## Task 3: Three-Hour Acceptance Runner

- [ ] Add `scripts/acceptance/run-0-40-three-hour.py`.
- [ ] The runner must:
  - Accept a real source video path.
  - Reject media shorter than three hours before model preflight.
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
  - Save paths to logs, subtitle output, and timing summary.
  - Return nonzero on any failed task or missing output.

## Task 4: Version, Verification, Gate

- [ ] Update release metadata to `0.40.0`.
- [ ] Run focused tests.
- [ ] Run the three-hour acceptance runner.
- [ ] Run full verification:

```powershell
.\scripts\check.ps1
```

- [ ] Write `docs/development/0-40-stage-gate-review.md` with real run evidence.

## Task 5: Merge And Push

- [ ] Merge only after acceptance evidence exists.
- [ ] Push `main` to GitHub.

## Current Blockers

- No three-hour source video has been selected for acceptance.
