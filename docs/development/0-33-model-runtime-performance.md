# Diplomat 0.33 Model Runtime Performance

Date: 2026-06-14

Stage: 0.33

## Objective

Make model runtime behavior predictable for long video processing. Diplomat should expose model profiles, validate hardware compatibility, reuse runtime state safely, batch translation where supported, and produce benchmark evidence.

## Deliverables

- Runtime profile model for ASR and translation.
- GPU/CPU compatibility checks before job start.
- Model health checks for installed curated models.
- Model warmup hooks and clear load progress.
- Model reuse policy for long tasks.
- CTranslate2 batch translation configuration.
- Memory and out-of-memory diagnostic messages.
- Benchmark script for 10 minute, one hour, and three hour operator-provided media.
- Performance report schema and stored benchmark outputs.

## Non-Goals

- Do not add new cloud models.
- Do not require benchmark media in default automated verification.
- Do not optimize UI rendering in this stage unless it blocks benchmark display.

## Architecture

Model profiles are stored as structured runtime options, not hidden form defaults. A profile defines task, provider, model tier, device, compute type, batch size, and hardware notes. The Worker validates profile compatibility against installed models and available runtime capabilities before starting a job.

Benchmark execution is an opt-in developer/release command. It writes JSON reports under `.dev/benchmarks` or a release diagnostics directory and never becomes part of normal `scripts/check.ps1`.

## Acceptance Criteria

- The UI can explain why a selected profile is unavailable.
- ASR jobs report model loading, warmup, and inference progress.
- Translation jobs can use CTranslate2 batch mode.
- Out-of-memory and CUDA-unavailable failures are mapped to actionable errors.
- Benchmark reports include duration, model, device, compute type, elapsed time, and peak memory when available.
- Full repository verification passes.

## Focused Verification

```powershell
python -m pytest worker/tests/models worker/tests/translation/test_ct2_marian.py worker/tests/tasks/test_translation_jobs.py -q
corepack pnpm --dir apps/web exec vitest run src/pages/ModelsPage.test.tsx src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx
```

Manual benchmark smoke:

1. Install at least one ASR model and one light translation model.
2. Run the benchmark script against a short local video.
3. Confirm a JSON report is written.
4. Confirm Settings or diagnostics can reference the latest benchmark result.

## Stage Gate

0.33 is accepted when runtime profiles and benchmark evidence make long-video model behavior measurable and diagnosable.

