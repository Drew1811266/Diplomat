# Diplomat 0.35 Long-Video Runtime Roadmap

Checkpoint date: 2026-06-14

## Goal

Diplomat 0.35 is the desktop stability and long-video optimization release line. It turns the 0.3 release-candidate into a local Windows application that can reliably process one to three hour videos through transcription, translation, editing, subtitle export, and burned-in video export.

The 0.35 goal is not broad feature expansion. It is production hardening for the existing product promise:

- self-contained desktop runtime.
- recoverable long-running ASR and translation jobs.
- efficient model execution on recommended NVIDIA systems.
- reliable CPU fallback messaging for short or light workflows.
- consistent terminology across long translated videos.
- installer and stress-test acceptance evidence.

## Product Principles

- Windows remains the supported desktop platform for 0.35.
- NVIDIA GPU remains the recommended production environment.
- The formal ASR and translation path remains local after model download.
- Networking is allowed only for curated model downloads and release update checks.
- Remote ASR and remote translation remain outside the formal 0.35 path.
- Model weights are not committed to the repository.
- The installed app must not require a developer checkout.
- Long tasks must be recoverable after app close, Worker crash, task cancellation, and machine restart.
- Default automated tests must not require large model downloads, GPU, network, or multi-hour media.
- Release acceptance must include opt-in real-video and packaged-desktop tests.

## Stage Map

| Version | Theme | Product Outcome |
| --- | --- | --- |
| 0.31 | Self-contained desktop runtime | Installed Windows app owns Worker startup, FFmpeg/FFprobe paths, runtime directories, logs, and clean-machine smoke. |
| 0.32 | Recoverable long-media ASR | One to three hour audio can be chunked, transcribed chunk-by-chunk, checkpointed, resumed, and merged into stable subtitles. |
| 0.33 | Model runtime performance | Model profiles, GPU/CPU checks, memory diagnostics, batching, warmup, and benchmark reporting make runtime behavior predictable. |
| 0.34 | Long-video translation consistency | Translation runs in batches with glossary support, context windows, incremental saves, and consistency review. |
| 0.35 | Stability and release gate | The final 0.35 release passes installer, one-hour, three-hour, crash-recovery, and full workflow gates. |

## Required Stage Process

Every stage must be executed as a complete 0.01 release:

1. Start from clean `main`.
2. Create a `codex/` branch for the stage.
3. Update the stage development document under `docs/development/`.
4. Update version metadata to the stage version, such as `0.31.0`, `0.32.0`, `0.33.0`, `0.34.0`, or `0.35.0`.
5. Write an implementation plan under `docs/superpowers/plans/`.
6. Commit planning docs.
7. Implement with focused commits.
8. Run focused verification while implementing.
9. Run full verification:

```powershell
.\scripts\check.ps1
```

10. Run stage-specific verification.
11. Write a stage gate review under `docs/development/`.
12. Fix all blocking findings.
13. Merge accepted branch into `main`.
14. Push `main` to GitHub.
15. Start the next stage only after the previous stage is accepted.

## Branch And Push Policy

- Stage branches use `codex/0.31-desktop-runtime-packaging`, `codex/0.32-long-media-asr`, `codex/0.33-model-runtime-performance`, `codex/0.34-translation-consistency`, and `codex/0.35-stability-release-gate`.
- A stage must not merge while `git status --short` contains unintended changes.
- A stage must not push if full verification fails.
- If GitHub authentication or network push fails, record the push failure as a release-process blocker and do not mark the stage complete.

## Verification Layers

### Default Automated

- JavaScript package tests.
- Web Vitest tests.
- Shared schema tests.
- Web TypeScript checks.
- Worker pytest suite.
- Desktop Rust tests.
- Release metadata checks.

### Stage-Specific

- 0.31: clean-machine packaged desktop smoke.
- 0.32: generated long-audio chunk resume tests and short real-media ASR smoke.
- 0.33: model runtime profile checks and benchmark reports.
- 0.34: glossary and consistency review fixtures.
- 0.35: one-hour and three-hour operator-provided video acceptance.

## Definition Of Done For 0.35

Diplomat 0.35 is complete when:

- The Windows installer starts the app and Worker without a terminal.
- FFmpeg and FFprobe are release-approved and discoverable by the installed runtime.
- A one-hour video can complete ASR, translation, edit, subtitle export, and burn-in export.
- A three-hour video can complete ASR and translation or resume cleanly from interruption.
- Worker crash or app close during ASR does not destroy completed chunk output.
- Worker crash or app close during translation does not destroy completed batch output.
- Release readiness reports zero blockers.
- Full repository verification passes.
- 0.35 stage gate documents all known limitations and acceptance evidence.
