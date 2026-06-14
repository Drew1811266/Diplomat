# Diplomat 0.35 Stability Release Gate

Date: 2026-06-14

Stage: 0.35

## Objective

Accept or reject the full 0.35 release based on real packaged-desktop, long-video, crash-recovery, model-runtime, and export evidence.

## Deliverables

- 0.35 release readiness checks.
- Installer smoke script and notes.
- One-hour real-video acceptance script.
- Three-hour real-video acceptance script.
- Crash and resume verification script.
- Translation consistency acceptance script.
- Benchmark report collection.
- Updated README and release documentation.
- Stage gate review with known limitations and final decision.

## Non-Goals

- Do not add new large product features in 0.35.
- Do not change core model families unless a previous stage proves the current choices fail.
- Do not ship model weights in the repository.

## Acceptance Criteria

- Clean Windows install launches the desktop app and Worker without terminal setup.
- FFmpeg and FFprobe are available from release-approved runtime paths.
- Model manager can install and verify curated models.
- One-hour video completes ASR, translation, edit, text subtitle export, and burned-in video export.
- Three-hour video completes ASR and translation or resumes correctly after interruption.
- Worker crash during ASR preserves completed chunk outputs.
- App close during translation preserves completed batch outputs.
- Release readiness reports zero blockers.
- Full repository verification passes.
- GitHub `main` contains the accepted 0.35 release state.

## Verification Commands

```powershell
.\scripts\check.ps1
node .\scripts\verify-version.mjs
node .\scripts\verify-release-assets.mjs
```

Opt-in release verification:

```powershell
.\scripts\verify-0.35-installer.ps1
.\scripts\verify-0.35-long-video.ps1 -Duration OneHour
.\scripts\verify-0.35-long-video.ps1 -Duration ThreeHour
.\scripts\verify-0.35-crash-resume.ps1
```

## Stage Gate

0.35 is accepted only when automated verification, installer smoke, long-video acceptance, and crash recovery evidence are all recorded in the stage gate review.

