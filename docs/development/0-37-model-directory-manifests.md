# Diplomat 0.37 Model Directory And Manifests

Date: 2026-06-18

Stage: 0.37

## Objective

Create the development model directory system and model manifest layer needed for real ASR and translation model integration. This stage addresses the second major 0.4 task: real model onboarding and configuration.

## Product Outcome

The repository defines where development models live, how their metadata is represented, how model weights are excluded from Git, and how the app reports whether the selected real models are ready.

## Scope

- Add `models/` directory structure with committed folder placeholders.
- Add manifests for `microsoft/VibeVoice-ASR` and `tencent/Hunyuan-MT-7B-fp8`.
- Add Git ignore rules to prevent model weights from being committed.
- Extend model registry metadata for 0.4 real-model targets.
- Add license metadata and local license acceptance records.
- Add scripts for model path verification.
- Add UI copy for missing, downloading, installed, license-blocked, and checksum-failed states.

## Non-Goals

- Do not require the actual model downloads for default tests.
- Do not commit any model weights.
- Do not complete VibeVoice inference.
- Do not complete Hunyuan inference.

## Acceptance Criteria

- `models/dev/asr/microsoft--VibeVoice-ASR` exists as a committed path placeholder.
- `models/dev/translation/tencent--Hunyuan-MT-7B-fp8` exists as a committed path placeholder.
- `models/manifests/vibevoice-asr.json` defines source, license, expected files, and development path.
- `models/manifests/hunyuan-mt-7b-fp8.json` defines source, license, expected files, and development path.
- Git ignore rules block large model files.
- Worker readiness can report missing model directories without crashing.
- Model readiness tests pass.
- Full repository verification passes.

## Verification

Focused verification:

```powershell
python -m pytest worker/tests/models -q
node .\scripts\verify-release-assets.mjs
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.37 can merge only when model metadata is committed, model weights remain untracked, and readiness checks fail safely when local model files are absent.

