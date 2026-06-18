# Diplomat 0.37 Stage Gate Review

Date: 2026-06-18

Stage: 0.37

Decision: Accepted

## Scope Completed

- Advanced release metadata to `0.37.0`.
- Added committed development model paths:
  - `models/dev/asr/microsoft--VibeVoice-ASR/.gitkeep`
  - `models/dev/translation/tencent--Hunyuan-MT-7B-fp8/.gitkeep`
- Added model manifests:
  - `models/manifests/vibevoice-asr.json`
  - `models/manifests/hunyuan-mt-7b-fp8.json`
- Added release verification for model manifests.
- Added Worker development manifest loading and readiness checks.
- Added built-in registry entries for:
  - `asr.microsoft.vibevoice-asr`
  - `translation.tencent.hunyuan-mt-7b-fp8`
- Added API/shared schema support for `vibevoice-asr`.
- Added Web model catalog fixture coverage for both 0.4 real-model targets.

## Git Ignore Proof

The 0.37 model folders keep placeholders in Git while ignoring model weights.

Proof command:

```powershell
Set-Content -LiteralPath models\dev\asr\microsoft--VibeVoice-ASR\model-00001-of-00008.safetensors -Value "do-not-commit"
git status --short --untracked-files=all models
Remove-Item -LiteralPath models\dev\asr\microsoft--VibeVoice-ASR\model-00001-of-00008.safetensors
git status --short --untracked-files=all models
```

Result: both `git status` checks produced no model file output.

## Focused Verification

Passed:

```powershell
node .\scripts\verify-model-manifests.mjs
node .\scripts\verify-release-assets.mjs
python -m pytest worker/tests/models -q
corepack pnpm --dir apps/web test -- ModelsPage
corepack pnpm --dir apps/web typecheck
```

Observed results:

- Model manifest verification: 2 manifests verified.
- Release asset verification: passed for Diplomat `0.37.0`.
- Worker model tests: 22 passed.
- Web tests: 29 files, 179 tests passed.
- Web typecheck: passed.

## Full Verification

Passed:

```powershell
.\scripts\check.ps1
```

Observed results:

- Release version metadata: all `0.37.0`.
- Release assets: passed, including model manifests.
- Shared package tests: 51 passed.
- Desktop Cargo tests: 20 passed.
- Web tests: 179 passed.
- TypeScript typecheck: passed.
- Python Worker tests: 274 passed.

## Known Limitations

- 0.37 does not download model weights.
- 0.37 does not run VibeVoice ASR inference.
- 0.37 does not run Hunyuan MT FP8 translation inference.
- Hunyuan readiness is blocked until the local license acceptance record exists.
- VibeVoice readiness reports missing expected files until the development model folder is populated.
- The final 0.40 acceptance gate still requires a complete three-hour video run.

## Acceptance

0.37 meets its stage target. Model paths, manifests, ignore rules, Worker readiness, API schema, shared schema, and Web visibility are in place without committing model weights. The stage is ready to merge into `main`.
