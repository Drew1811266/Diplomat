# Diplomat 0.40 Three-Hour Release Gate

Date: 2026-06-18

Stage: 0.40

## Objective

Complete the 0.4 release by proving that Diplomat can run a representative three-hour video through the real desktop workflow. This stage is the final acceptance stage for the third major 0.4 task.

## Product Outcome

The user can run a three-hour course, lecture, or tutorial video through intelligent segmentation, VibeVoice-ASR, Hunyuan-MT-7B-fp8 translation, editing, and export with evidence that the workflow actually completed.

## Scope

- Add 0.40 release evidence scripts.
- Add three-hour acceptance checklist.
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
- A representative three-hour video with both video and audio streams completes the full workflow.
- Segmentation evidence exists.
- ASR chunk evidence exists.
- ASR memory release evidence exists.
- Translation batch evidence exists.
- Translation memory release evidence exists.
- Export artifact evidence exists.
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
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <three-hour-video> -PreflightOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-0.40-three-hour-workflow.ps1 -MediaPath <three-hour-video> -AsrModelDir .\models\dev\asr\microsoft--VibeVoice-ASR -TranslationModelDir .\models\dev\translation\tencent--Hunyuan-MT-7B-fp8 -OutputDir .\.dev\release-evidence\0.40
```

The candidate scanner and preflight-only command validate media duration, video/audio stream presence, local model readiness, model paths, and glossary parsing without starting ASR or translation. They cannot replace the full three-hour acceptance run.

## Stage Gate

0.40 can merge and tag only when real three-hour evidence exists. If the three-hour workflow cannot be executed in the current environment, the stage remains blocked rather than accepted.
