# Diplomat 0.35 Desktop Stability Development Document

Planning date: 2026-06-15 Asia/Shanghai local planning time

Target stage: 0.35

## Product Goal

0.35 is the final desktop stability and release-gate stage for the current long-video hardening arc. The goal is not to add a new product surface. The goal is to make the existing local desktop workflow more recoverable and to turn the remaining real-world acceptance checks into repeatable, evidence-producing scripts.

The product target remains one to three hour video workflows:

- local Worker startup from the desktop app.
- long ASR with chunk checkpoints and retry.
- batched translation with glossary quality checks.
- edit, subtitle export, and burned-in export.
- release evidence for installer, long-video, crash-resume, and full repository gates.

## Scope

- Advance all release metadata to `0.35.0`.
- Persist translated subtitle batches incrementally during translation jobs so completed batches survive cancellation, Worker crash, or app close.
- Ensure retrying a canceled translation job in `missing_only` mode reuses completed translated lines and continues remaining lines.
- Add a small release evidence writer for 0.35 operator acceptance records.
- Add PowerShell opt-in acceptance scripts:
  - `scripts/verify-0.35-installer.ps1`
  - `scripts/verify-0.35-long-video.ps1`
  - `scripts/verify-0.35-crash-resume.ps1`
- Update 0.35 release-gate documentation with the exact automated and operator-provided evidence expected.
- Run focused verification and the full repository `scripts/check.ps1` gate.

## Out Of Scope

- Downloading or bundling large model weights.
- Running real one-hour or three-hour media inside default CI.
- Replacing the ASR or translation model families.
- Adding LLM semantic review or automatic translation rewriting.
- Building a new release distribution service.

## Architecture

Translation recovery is implemented inside the Worker translation task manager. After each successful translation batch, the task manager updates the subtitle document on disk with completed translated lines. If the task is canceled or interrupted after that point, completed batches remain in the project document. A retry with `missing_only` selects only lines that are still untranslated or failed.

Release evidence is stored as JSON files under an operator-selected output directory, defaulting to `.dev/release-evidence`. Evidence scripts validate that the referenced installer, media, subtitle, export, benchmark, or project artifacts exist, then write a timestamped evidence report. These scripts are opt-in and are not part of the default automated gate because they depend on large local assets and packaged builds.

## Acceptance Criteria

- Full release metadata reports `0.35.0`.
- A translation job canceled after a completed batch leaves that batch translated in the subtitle document.
- Retrying that canceled translation job translates only the remaining missing lines and completes the document.
- 0.35 evidence writer tests pass.
- All 0.35 evidence scripts support `-OutputDir` and produce JSON evidence files.
- `scripts/check.ps1` passes.
- `docs/development/0-35-stage-gate-review.md` records automated evidence and any operator evidence not executed in this session.

## Release Caveat

Repository acceptance can pass without real one-hour or three-hour media, but the 0.35 public release remains caveated until an operator runs the opt-in scripts against packaged desktop builds and representative media.
