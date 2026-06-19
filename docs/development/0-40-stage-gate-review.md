# Diplomat 0.40 Stage Gate Review

Date: 2026-06-19

Stage: 0.40

Decision: Accepted

## Objective

Complete the final 0.4 release gate by proving the real-model workflow with a short English-to-Chinese smoke video and then a representative two-to-three-hour release-profile video.

## Scope Reviewed

- VibeVoice ASR local model readiness.
- Hunyuan MT 7B FP8 local translation readiness.
- Short-video smoke acceptance.
- Two-to-three-hour release-profile acceptance.
- ASR chunk evidence and duration coverage.
- ASR-to-translation memory lifecycle.
- Subtitle completeness and export artifact evidence.
- Version metadata update to `0.40.0`.

## Acceptance Evidence

Smoke evidence:

- Evidence directory: `.dev/acceptance/0-40/smoke-20260619-120854`
- Profile: `smoke`
- Source duration: `603,927 ms`
- Source language: English
- Target language: Chinese
- ASR chunks: `21/21`
- Subtitle lines: `35`
- Translated lines: `35`
- Exports: SRT, VTT, ASS
- Independent verifier: `verify-0-40-acceptance-summary.py --acceptance-profile smoke` passed.

Release evidence:

- Evidence directory: `.dev/acceptance/0-40/release-20260619-163807`
- Profile: `release`
- Source: `test video/H21 Keynote Vancouver [C--08SipCNU].mp4`
- Source duration: `8,782,576 ms`
- Minimum release duration: `7,200,000 ms`
- Audio/video: AAC audio, H.264 video
- ASR chunks: `298/298`
- Subtitle lines: `437`
- Source lines: `437`
- Translated lines: `437`
- Missing translations: `0`
- Failed translations: `0`
- Incomplete translation statuses: `0`
- Timing issues: `0`
- Translation quality issues: `0`
- Export artifacts:
  - SRT: `338,982 bytes`
  - VTT: `336,915 bytes`
  - ASS: `348,832 bytes`
- Export validation warnings: `410` readability warnings for dense cues; these are non-blocking and should inform future editing and segmentation tuning.

## Runtime Lifecycle

- ASR cleanup log recorded `Runtime cleanup: Closed runtime resource.`
- ASR cleanup log recorded `Runtime cleanup: Cleared CUDA accelerator cache.`
- Translation cleanup log recorded `Runtime cleanup: Closed runtime resource.`
- Translation cleanup log recorded `Runtime cleanup: Cleared CUDA accelerator cache.`
- GPU memory returned to approximately `1,067 MiB / 24,455 MiB` after the release run.

Cancellation recovery was exercised during the earlier long-video trial that was intentionally stopped during ASR at the user's request. That stopped run produced no accepted summary and was not counted as release evidence. A fresh release evidence directory was then used for the accepted run.

## Full Verification

Acceptance verifier:

```powershell
python .\scripts\acceptance\verify-0-40-acceptance-summary.py --summary .\.dev\acceptance\0-40\release-20260619-163807\acceptance-summary.json --acceptance-profile release
```

Result:

```text
0.40 acceptance summary verified: .dev\acceptance\0-40\release-20260619-163807\acceptance-summary.json
```

Full repository verification after the version metadata and stage gate review update:

```powershell
.\scripts\check.ps1
```

Result:

```text
All release version metadata matches 0.40.0.
Release assets verified for Diplomat 0.40.0.
Python tests: 340 passed.
All M0/M1 checks completed.
```

The stage is ready to merge into `main`.

## Risks And Follow-Up

- The real release run passed, but dense subtitle cues generated many export readability warnings. This does not block 0.40, but future work should improve cue splitting and editing ergonomics for lecture/tutorial material.
- The 0.40 release uses Hunyuan MT 7B FP8 as the development translation target. The 30B-A3B model remains a future quality upgrade, not a 0.40 requirement.
- Model weights and local license acceptance records remain local-only and must not be committed.
