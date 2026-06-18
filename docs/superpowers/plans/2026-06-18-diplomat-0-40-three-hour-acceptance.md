# Diplomat 0.40 Three-Hour Acceptance Implementation Plan

> For agentic workers: this is the final 0.4 gate. Do not mark accepted until a real three-hour run completes.

**Goal:** Validate Diplomat 0.4 with a real three-hour video using the approved ASR and translation model targets.

**Hard Gate:** The current repository does not contain model weights and does not contain the Hunyuan license acceptance record. 0.40 execution is blocked until those local files exist.

**Progress Note:** Preflight, model preparation, and three-hour runner tooling are implemented. Final 0.40 acceptance remains pending until local models are prepared, real model adapters are validated, a three-hour source video is selected, and the full acceptance run succeeds.

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
  - Create a project.
  - Start ASR.
  - Wait for completion.
  - Start translation.
  - Wait for completion.
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

- Missing VibeVoice ASR weights under `models/dev/asr/microsoft--VibeVoice-ASR`.
- Missing Hunyuan MT FP8 weights under `models/dev/translation/tencent--Hunyuan-MT-7B-fp8`.
- Missing local Hunyuan license acceptance record.
- No three-hour source video has been selected for acceptance.
