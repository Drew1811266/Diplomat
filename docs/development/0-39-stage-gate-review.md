# Diplomat 0.39 Stage Gate Review

Date: 2026-06-18

Stage: 0.39

Decision: Accepted

## Scope Completed

- Advanced release metadata to `0.39.0`.
- Added runtime cleanup helper:
  - `worker/diplomat_worker/runtime/resources.py`
  - `release_runtime_resources(resource)`
- Added `close()` hooks for:
  - `FasterWhisperTranscriber`
  - `CTranslate2MarianProvider`
  - `LocalLlmTranslationProvider`
- Analysis jobs now release transcriber resources in `finally`.
- Translation jobs now release provider resources in `finally`.
- Cleanup messages are written into diagnostic logs.
- Cleanup is best-effort and does not mask the original task error.
- Translation resolver now accepts vendor-owned `local-llm` registry entries, including Hunyuan-style `provider="tencent"` entries.

## Focused Verification

Passed:

```powershell
python -m pytest worker/tests/runtime worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py worker/tests/translation/test_translation_resolver.py -q
node .\scripts\verify-version.mjs
```

Observed results:

- Runtime, task, and resolver focused tests: 43 passed.
- Version metadata: all `0.39.0`.

## Full Verification

Passed:

```powershell
.\scripts\check.ps1
```

Observed results:

- Release version metadata: all `0.39.0`.
- Release assets: passed, including model manifests.
- Shared package tests: 51 passed.
- Desktop Cargo tests: 20 passed.
- Web tests: 179 passed.
- TypeScript typecheck: passed.
- Python Worker tests: 290 passed.

## Known Limitations

- 0.39 does not download model weights.
- 0.39 does not execute VibeVoice ASR or Hunyuan MT FP8 inference.
- Cleanup is in-process and best-effort; full process isolation remains future work if model runtimes retain memory outside Python references.
- The final 0.40 acceptance gate still requires a complete 2-3 hour video run.

## Acceptance

0.39 meets its stage target. Local model resources now have explicit cleanup hooks, task managers release resources after success and failure, and Hunyuan-style vendor local LLM registry entries can resolve through the `local-llm` runtime. The stage is ready to merge into `main`.
