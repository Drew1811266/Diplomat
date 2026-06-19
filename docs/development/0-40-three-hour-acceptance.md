# Diplomat 0.40 Three-Hour Acceptance

Date: 2026-06-18

Stage: 0.40

## Objective

Complete the final 0.4 acceptance gate: a three-hour video must run through the desktop/Worker pipeline end to end with the real ASR and translation model targets.

This stage cannot be accepted by unit tests alone.

## Required Acceptance Flow

1. Confirm real model files exist under committed development paths.
2. Confirm required local license acceptance records exist.
3. Run speech-aware segmentation over a three-hour source.
4. Run ASR over all chunks.
5. Release ASR resources.
6. Run translation over the transcript.
7. Release translation resources.
8. Persist subtitle document, task logs, and diagnostics.
9. Review output for missing chunks, failed lines, timing corruption, and translation errors.
10. Record evidence in `docs/development/0-40-stage-gate-review.md`.

## Current Hard Gate Status

Latest local check:

- `models/dev/asr/microsoft--VibeVoice-ASR` is populated locally with the expected VibeVoice ASR files.
- VibeVoice ASR files under `models/dev` are ignored by Git and must not be tracked.
- VibeVoice ASR GPU smoke completed on the local CUDA runtime and released CUDA memory after `close()`.
- Hunyuan MT FP8 runtime dependencies are installed locally, including `compressed_tensors`.
- Hunyuan MT FP8 provider code now uses the model's chat-template path and applies the FP8 config compatibility patch during model preparation.
- The 0.40 runner probes the source media before model preflight and rejects short or silent media before any model execution.
- The 0.40 runner passes manifest-verified `models/dev` paths as controlled local model paths for the acceptance runtime.
- The 0.40 runner validates ASR chunk evidence after analysis, including the chunk manifest, source-duration coverage, and every chunk result file.
- The 0.40 runner accepts an optional glossary JSON file and passes it into translation for professional terminology checks.
- The 0.40 runner reads ASR and translation diagnostic logs and fails acceptance if runtime resources are not closed or if CUDA-mode tasks do not report CUDA accelerator cache cleanup.
- The 0.40 runner validates the final subtitle document and fails acceptance on blank source lines, missing translations, failed translation states, incomplete translation states, timing corruption, or glossary quality issues.
- `scripts/verify-0.40-three-hour-workflow.ps1` is available as the operator-facing wrapper for the Python acceptance runner.
- `models/dev/translation/tencent--Hunyuan-MT-7B-fp8` still contains only `.gitkeep`.
- `models/licenses/accepted/tencent--Hunyuan-MT-7B-fp8.json` is missing.

Current readiness:

- `asr.microsoft.vibevoice-asr`: usable for 0.40 development verification.
- `translation.tencent.hunyuan-mt-7b-fp8`: blocked by missing license acceptance and local model files.

## Scope

- Add 0.40 acceptance preflight tooling.
- Add model readiness checks that fail the final gate clearly.
- Add a three-hour acceptance runner that records logs and output paths.
- Keep VibeVoice ASR adapter work verified against local model files.
- Keep Hunyuan translation adapter work aligned with the official chat-template and FP8 runtime requirements.
- Execute the full three-hour acceptance run before merging.

## Non-Goals

- Do not merge 0.40 while real model files are missing.
- Do not accept fake ASR or fake translation as 0.40 evidence.
- Do not commit model weights to Git.
- Do not bypass upstream license requirements.

## Acceptance Criteria

- VibeVoice ASR model readiness is usable.
- Hunyuan MT FP8 model readiness is usable.
- Three-hour source video completes ASR and translation.
- ASR chunk manifest covers the full source duration and every listed chunk has a valid result file.
- No task remains failed, canceled, queued, or partially complete.
- Subtitle document contains transcript and translated text for every source line in the completed run.
- Subtitle document has no blank source lines, missing translations, failed translation states, incomplete translation states, timing issues, or glossary quality issues.
- Runtime cleanup evidence is present in logs and in `acceptance-summary.json` for both ASR and translation.
- CUDA-mode ASR and translation tasks record `Cleared CUDA accelerator cache.` before the final gate can pass.
- Full repository verification passes after the acceptance run.

## Verification

Preflight:

```powershell
node .\scripts\verify-model-manifests.mjs
python .\scripts\acceptance\check-0-40-readiness.py
```

Acceptance:

```powershell
python .\scripts\acceptance\run-0-40-three-hour.py --source-video <path> --glossary-path <glossary.json>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <path> -GlossaryPath <glossary.json>
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.40 can merge only after the three-hour run produces durable evidence and the stage gate review is accepted.
