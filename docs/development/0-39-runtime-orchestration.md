# Diplomat 0.39 Runtime Orchestration

Date: 2026-06-18

Stage: 0.39

## Objective

Add runtime lifecycle control for local ASR and translation jobs. The goal is to prevent long-video processing from keeping one model resident while the next phase needs GPU/CPU memory.

This directly supports the intended flow:

1. Segment long audio.
2. Run ASR over chunks.
3. Release ASR runtime memory.
4. Run translation.
5. Release translation runtime memory.

## Product Outcome

The Worker can call model/provider cleanup hooks at task boundaries and clear accelerator caches when available. Local model providers can expose `close()` without changing task managers. Hunyuan MT FP8 can be resolved through the `local-llm` runtime even though its registry provider is `tencent`.

## Scope

- Add a Worker runtime resource cleanup helper.
- Add `close()` support to local ASR and translation providers.
- Ensure analysis jobs release transcriber resources in `finally`.
- Ensure translation jobs release provider resources in `finally`.
- Log cleanup diagnostics into task logs.
- Update translation resolver compatibility for vendor-owned `local-llm` registry entries.
- Add tests for cleanup on success and failure.
- Update release metadata to `0.39.0`.

## Non-Goals

- Do not download model weights in 0.39.
- Do not run VibeVoice ASR inference in 0.39.
- Do not run Hunyuan MT FP8 inference in 0.39.
- Do not implement a full process-isolated model worker in 0.39.
- Do not claim final 2-3 hour acceptance.

## Acceptance Criteria

- Analysis job cleanup calls a transcriber `close()` hook after success and failure.
- Translation job cleanup calls a provider `close()` hook after success and failure.
- Cleanup does not mask the original task error.
- Accelerator cache cleanup is best-effort and safe when Torch is unavailable.
- Hunyuan MT FP8 registry entries can resolve with `TranslationProviderConfig(provider="local-llm")`.
- Focused Worker tests pass.
- Full repository verification passes.

## Verification

Focused verification:

```powershell
python -m pytest worker/tests/runtime worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py worker/tests/translation/test_translation_resolver.py -q
node .\scripts\verify-version.mjs
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.39 can merge only when model/provider cleanup is deterministic, failures remain visible, resolver compatibility is covered by tests, and full verification passes.
