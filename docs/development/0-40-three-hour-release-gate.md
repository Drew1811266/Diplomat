# Diplomat 0.40 Two-To-Three-Hour Release Gate

Date: 2026-06-18

Stage: 0.40

## Objective

Complete the 0.4 release by first proving the full workflow with a short smoke video, then proving that Diplomat can run a representative 2-3 hour video through the real desktop workflow. This stage is the final acceptance stage for the third major 0.4 task.

## Product Outcome

The user can run a 2-3 hour course, lecture, or tutorial video through intelligent segmentation, VibeVoice-ASR, Hunyuan-MT-7B-fp8 translation, editing, and export with evidence that the workflow actually completed.

## Scope

- Add 0.40 release evidence scripts.
- Add 2-3 hour acceptance checklist.
- Add short-video smoke acceptance before the expensive release-profile run.
- Add memory lifecycle report collection.
- Add ASR-to-translation stage transition verification.
- Add export artifact verification.
- Update README and version metadata to 0.40.0.
- Write final stage gate review.
- Create and push `v0.40` tag after acceptance.

## Non-Goals

- Do not add new major UI features in 0.40.
- Do not change the selected 0.4 default models.
- Do not make 30B translation required.
- Do not accept the release on automated fake-provider tests alone.

## Acceptance Criteria

- Version metadata is 0.40.0.
- A short English smoke video completes ASR, Chinese translation, subtitle export, and smoke summary verification.
- A representative 2-3 hour video with both video and audio streams completes the full workflow.
- Segmentation evidence exists.
- ASR chunk evidence exists.
- ASR memory release evidence exists.
- Translation batch evidence exists.
- Translation memory release evidence exists.
- Export artifact evidence exists.
- The final `acceptance-summary.json` passes the independent 0.40 summary verifier.
- Crash or cancellation recovery is verified for at least one long-running stage.
- Full repository verification passes.
- `main` is pushed to GitHub.
- `v0.40` tag is pushed to GitHub.

## Verification

Automated verification:

```powershell
.\scripts\check.ps1
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
```

Opt-in acceptance verification:

```powershell
python .\scripts\acceptance\find-0-40-media-candidates.py <file-or-directory> --recursive --ffprobe-path <ffprobe>
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <short-english-video> -AcceptanceProfile smoke -SourceLanguage en -TargetLanguage zh -OutputDir .\.dev\acceptance\0-40\smoke
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary .\.dev\acceptance\0-40\smoke\acceptance-summary.json --acceptance-profile smoke
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <two-to-three-hour-video> -AcceptanceProfile release -PreflightOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <two-to-three-hour-video> -AcceptanceProfile release -AsrModelDir .\models\dev\asr\microsoft--VibeVoice-ASR -TranslationModelDir .\models\dev\translation\tencent--Hunyuan-MT-7B-fp8 -OutputDir .\.dev\release-evidence\0.40
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary .\.dev\release-evidence\0.40\acceptance-summary.json
```

The candidate scanner and preflight-only command validate media duration, video/audio stream presence, local model readiness, model paths, and glossary parsing without starting ASR or translation. Smoke evidence proves short-video workflow health, but it cannot replace the full release-profile 2-3 hour acceptance run.

## Stage Gate

0.40 can merge and tag only when real two-to-three-hour evidence exists. If the 2-3 hour workflow cannot be executed in the current environment, the stage remains blocked rather than accepted.

Current smoke status: passed locally against `.dev/acceptance/0-40/smoke-20260619-120854`.

Current release status: passed locally against `.dev/acceptance/0-40/release-20260619-163807`. This is the accepted final two-to-three-hour release-profile evidence for the 0.40 gate.
