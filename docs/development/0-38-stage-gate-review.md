# Diplomat 0.38 Stage Gate Review

Date: 2026-06-18

Stage: 0.38

Decision: Accepted

## Scope Completed

- Advanced release metadata to `0.38.0`.
- Added `worker/diplomat_worker/pipeline/segmentation.py`.
- Added speech activity and segmentation configuration data structures.
- Added deterministic speech-aware chunk planning.
- Added fixed-chunk fallback when speech activity is absent.
- Added micro-pause merging before chunk planning.
- Added forced splitting for continuous speech longer than `max_chunk_ms`.
- Added optional `segmentation_planner` injection to `run_core_pipeline`.
- Preserved existing default fixed-chunk behavior for current ASR jobs.
- Added unit coverage for segmentation planning and pipeline integration.

## Focused Verification

Passed:

```powershell
python -m pytest worker/tests/pipeline worker/tests/media -q
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
node .\scripts\verify-version.mjs
```

Observed results:

- Pipeline and media tests: 25 passed.
- Analysis job tests: 12 passed.
- Version metadata: all `0.38.0`.

## Full Verification

Passed:

```powershell
.\scripts\check.ps1
```

Observed results:

- Release version metadata: all `0.38.0`.
- Release assets: passed, including model manifests.
- Shared package tests: 51 passed.
- Desktop Cargo tests: 20 passed.
- Web tests: 179 passed.
- TypeScript typecheck: passed.
- Python Worker tests: 280 passed.

## Known Limitations

- 0.38 does not run NVIDIA NeMo, Sortformer, Silero VAD, or pyannote.
- 0.38 provides the segmentation planner and injection point, not a trained speech detector.
- Current production analysis jobs still use the fixed fallback unless a planner is injected.
- VibeVoice ASR and Hunyuan MT FP8 inference remain future work.
- The final 0.40 acceptance gate still requires a complete 2-3 hour video run.

## Acceptance

0.38 meets its stage target. The Worker now has a deterministic, tested speech-aware chunk planner and the ASR pipeline can consume injected chunk plans without breaking existing resume/retry behavior. The stage is ready to merge into `main`.
