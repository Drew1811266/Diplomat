# Diplomat 0.40 Two-To-Three-Hour Acceptance

Date: 2026-06-19

Stage: 0.40

## Objective

Complete the final 0.4 acceptance gate in two steps: first prove the complete workflow with a short English smoke video translated to Chinese, then prove the release gate with a representative 2-3 hour video through the desktop/Worker pipeline end to end with the real ASR and translation model targets.

This stage cannot be accepted by unit tests alone.

## Required Acceptance Flow

1. Confirm real model files exist under committed development paths.
2. Confirm required local license acceptance records exist.
3. Run speech-aware segmentation over the selected source.
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
- Hunyuan MT FP8 is treated as a restricted user-provided external model: Diplomat does not bundle or redistribute its weights, and readiness requires a local acceptance record with restricted-license, permitted-territory, and no-redistribution confirmations.
- Local Hunyuan license acceptance was recorded after user confirmation of the upstream Hunyuan license. The acceptance record is local-only and ignored by Git.
- `models/dev/translation/tencent--Hunyuan-MT-7B-fp8` is populated locally with the pinned FP8 manifest files. The weights are local-only and ignored by Git.
- Hunyuan MT FP8 real-model smoke completed on the local CUDA runtime with `NVIDIA GeForce RTX 5090 D v2`:
  - source text: `本节课介绍深度学习中的注意力机制和长视频字幕翻译流程。`
  - translated text: `This lesson introduces the attention mechanism in deep learning and the process of translating subtitles for long videos.`
- The 0.40 runner probes the source media before model preflight and rejects short or silent media before any model execution.
- The 0.40 runner also rejects audio-only containers before model preflight; final 0.40 evidence must come from a real video stream with an audio stream.
- `scripts/acceptance/find-0-40-media-candidates.py` can scan files or directories and report which local media files satisfy the 2-3 hour video/audio prerequisites.
- The 0.40 runner supports `--preflight-only` so an operator can validate a candidate 2-3 hour source, model readiness, model paths, and glossary before starting ASR or translation.
- The 0.40 runner supports `--acceptance-profile smoke` for short-video full workflow validation before the expensive release run.
- The final release profile remains `--acceptance-profile release`, which requires a 2-3 hour source and cannot be replaced by smoke evidence.
- The 0.40 runner passes manifest-verified `models/dev` paths as controlled local model paths for the acceptance runtime.
- The 0.40 runner validates ASR chunk evidence after analysis, including the chunk manifest, source-duration coverage, and every chunk result file.
- The 0.40 runner accepts an optional glossary JSON file and passes it into translation for professional terminology checks.
- The 0.40 runner reads ASR and translation diagnostic logs and fails acceptance if runtime resources are not closed or if CUDA-mode tasks do not report CUDA accelerator cache cleanup.
- The 0.40 runner validates the final subtitle document and fails acceptance on blank source lines, missing translations, failed translation states, incomplete translation states, timing corruption, or glossary quality issues.
- `scripts/acceptance/verify-0-40-acceptance-summary.py` verifies a completed `acceptance-summary.json` as final evidence and rejects preflight-only, failed, partial, fake, or incomplete summaries.
- `scripts/verify-0.40-three-hour-workflow.ps1` is available as the operator-facing wrapper for the Python acceptance runner.
- A representative 2 hour 26 minute test video is available locally under `test video/`.
- The current short-video test source is expected to be English and must be run with `--source-language en --target-language zh`.
- A previous 2 hour 26 minute release-profile trial was intentionally stopped during ASR and produced no accepted summary; it is not release evidence.
- The short-video smoke profile completed successfully on the local English Houdini tutorial source:
  - evidence directory: `.dev/acceptance/0-40/smoke-20260619-120854`
  - source duration: `603,927 ms`
  - ASR chunks: `21/21`
  - subtitle lines: `35`
  - translated lines: `35`
  - exports: `subtitle-bilingual.srt`, `subtitle-bilingual.vtt`, `subtitle-bilingual.ass`
  - independent verifier: `verify-0-40-acceptance-summary.py --acceptance-profile smoke` passed.
  - caveat: export validation reported readability warnings for dense cues; these are non-blocking smoke evidence but should inform subtitle editing UX and future segmentation tuning.
- The release profile completed successfully on the local 2 hour 26 minute H21 keynote source:
  - evidence directory: `.dev/acceptance/0-40/release-20260619-163807`
  - source duration: `8,782,576 ms`
  - ASR chunks: `298/298`
  - subtitle lines: `437`
  - translated lines: `437`
  - missing translations: `0`
  - failed translations: `0`
  - incomplete translation states: `0`
  - timing issues: `0`
  - translation quality issues: `0`
  - exports: `subtitle-bilingual.srt`, `subtitle-bilingual.vtt`, `subtitle-bilingual.ass`
  - independent verifier: `verify-0-40-acceptance-summary.py --acceptance-profile release` passed.
  - ASR and translation logs both recorded runtime closure and CUDA accelerator cache cleanup.

Current readiness:

- `asr.microsoft.vibevoice-asr`: usable for 0.40 development verification.
- `translation.tencent.hunyuan-mt-7b-fp8`: usable for 0.40 development verification.
- Final 0.40 release-profile acceptance evidence exists. The remaining release work is repository verification, merge to `main`, push, and tag.

## Scope

- Add 0.40 acceptance preflight tooling.
- Add model readiness checks that fail the final gate clearly.
- Add a long-video acceptance runner that records logs and output paths.
- Keep VibeVoice ASR adapter work verified against local model files.
- Keep Hunyuan translation adapter work aligned with the official chat-template and FP8 runtime requirements.
- Execute the full 2-3 hour acceptance run before merging.
- Execute a short-video smoke run before attempting the final 2-3 hour release run.

## Non-Goals

- Do not merge 0.40 before real two-to-three-hour acceptance evidence exists.
- Do not accept fake ASR or fake translation as 0.40 evidence.
- Do not commit model weights to Git.
- Do not bypass upstream license requirements.

## Acceptance Criteria

- VibeVoice ASR model readiness is usable.
- Hunyuan MT FP8 model readiness is usable.
- Source media is a real video file with both video and audio streams.
- Smoke profile: a short English source video completes ASR, Chinese translation, subtitle export, and summary verification.
- A 2-3 hour source video completes ASR and translation.
- ASR chunk manifest covers the full source duration and every listed chunk has a valid result file.
- No task remains failed, canceled, queued, or partially complete.
- Subtitle document contains transcript and translated text for every source line in the completed run.
- Subtitle document has no blank source lines, missing translations, failed translation states, incomplete translation states, timing issues, or glossary quality issues.
- SRT, VTT, and ASS subtitle export artifacts are generated and recorded in `acceptance-summary.json`.
- Runtime cleanup evidence is present in logs and in `acceptance-summary.json` for both ASR and translation.
- CUDA-mode ASR and translation tasks record `Cleared CUDA accelerator cache.` before the final gate can pass.
- `scripts/acceptance/verify-0-40-acceptance-summary.py --summary <acceptance-summary.json>` passes against the completed run evidence.
- Full repository verification passes after the acceptance run.

## Verification

Preflight:

```powershell
node .\scripts\verify-model-manifests.mjs
python .\scripts\acceptance\check-0-40-readiness.py
python .\scripts\acceptance\find-0-40-media-candidates.py <file-or-directory> --recursive --ffprobe-path <ffprobe>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <path> -PreflightOnly
```

Smoke acceptance:

```powershell
python .\scripts\acceptance\find-0-40-media-candidates.py <file-or-directory> --recursive --acceptance-profile smoke --ffprobe-path <ffprobe>
python .\scripts\acceptance\run-0-40-three-hour.py --source-video <short-video> --acceptance-profile smoke --source-language en --target-language zh
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary <evidence-dir>\acceptance-summary.json --acceptance-profile smoke
```

Hunyuan local license acceptance, after upstream license review:

```powershell
python .\scripts\acceptance\prepare-0-40-models.py `
  --model-id translation.tencent.hunyuan-mt-7b-fp8 `
  --accept-hunyuan-license `
  --confirm-hunyuan-restricted-license `
  --confirm-hunyuan-permitted-territory `
  --confirm-hunyuan-no-redistribution
```

Acceptance:

```powershell
python .\scripts\acceptance\run-0-40-three-hour.py --source-video <path> --acceptance-profile release --glossary-path <glossary.json>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <path> -AcceptanceProfile release -GlossaryPath <glossary.json>
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary <evidence-dir>\acceptance-summary.json
```

The media candidate scanner and `--preflight-only` / `-PreflightOnly` are not acceptance evidence. Smoke evidence proves short-video workflow health, but it cannot replace the final release-profile 2-3 hour run.

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.40 has durable two-to-three-hour release evidence and an accepted stage gate review. It is ready to merge after the final repository verification passes.
