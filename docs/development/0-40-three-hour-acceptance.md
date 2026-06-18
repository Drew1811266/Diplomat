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

Checked on 2026-06-18:

- `models/dev/asr/microsoft--VibeVoice-ASR` contains only `.gitkeep`.
- `models/dev/translation/tencent--Hunyuan-MT-7B-fp8` contains only `.gitkeep`.
- `models/licenses/accepted/tencent--Hunyuan-MT-7B-fp8.json` is missing.

Current readiness:

- `asr.microsoft.vibevoice-asr`: blocked by missing model files.
- `translation.tencent.hunyuan-mt-7b-fp8`: blocked by missing license acceptance.

## Scope

- Add 0.40 acceptance preflight tooling.
- Add model readiness checks that fail the final gate clearly.
- Add a three-hour acceptance runner that records logs and output paths.
- Add real model adapter work only after model files and license acceptance are available.
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
- No task remains failed, canceled, queued, or partially complete.
- Subtitle document contains transcript and translated text for the completed run.
- Runtime cleanup evidence is present in logs.
- Full repository verification passes after the acceptance run.

## Verification

Preflight:

```powershell
node .\scripts\verify-model-manifests.mjs
python .\scripts\acceptance\check-0-40-readiness.py
```

Acceptance:

```powershell
python .\scripts\acceptance\run-0-40-three-hour.py --source-video <path>
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.40 can merge only after the three-hour run produces durable evidence and the stage gate review is accepted.
