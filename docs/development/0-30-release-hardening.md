# Diplomat 0.30 Release Hardening

Checkpoint date: 2026-06-14

## Goal

Diplomat 0.30 is the release-candidate hardening stage for the full 0.3 Windows desktop product. The target is not to add another editing feature. The target is to make the product coherent as a desktop application: versioned as 0.3.0, packaged through a documented Windows build path, documented for real users, audited for local/offline behavior, and gated by release-readiness checks that make remaining blockers explicit.

0.30 must not hide incomplete release dependencies. If model packages, FFmpeg distribution, installer output, or manual real-GPU workflow checks cannot be proven in the current environment, the stage gate must record them as blocking findings instead of accepting 0.30.

## Product Decisions

- 0.3.0 is the release version across JavaScript packages, Worker metadata, Tauri config, and Rust package metadata.
- The formal 0.3 product path remains local and offline after model download.
- Remote ASR and remote translation are not part of the formal UI. Development-only fake and remote adapters can remain in code for tests and explicit development controls, but user-facing help and release docs must not present them as release workflow choices.
- The Help Center is in-app documentation, not a sample project launcher.
- The release build path should use Tauri's Windows bundle pipeline. The standard installer does not include model weights.
- FFmpeg distribution must be documented as a release dependency with license, version, source/build provenance, and binary choice.
- The model registry must be audited for production readiness. Placeholder checksums or non-downloadable repository-page URLs are release blockers.
- CPU-only mode is documented as a fallback for short media, light models, and non-AI editing. NVIDIA GPU remains the recommended production environment.
- Automated release checks should fail loudly when version metadata or release-readiness inputs drift.

## Scope

### Included

- Version metadata update to `0.3.0`.
- A version consistency verification script wired into the full check.
- Tauri bundle configuration for the Windows release build path.
- Root and desktop package scripts for release checking and desktop build execution.
- Worker release-readiness audit logic and `/release/readiness` API route.
- Shared TypeScript release-readiness contracts.
- Web API/query helpers for release readiness.
- In-app Help Center with:
  - first-run workflow.
  - model installation guidance.
  - local ASR and translation workflow.
  - editing and export workflow.
  - diagnostics and logs.
  - privacy/offline statement.
  - CPU/GPU expectations.
  - release acceptance checklist.
- Settings release-readiness panel showing blocking and warning checks.
- Chinese and English localization coverage for new 0.30 UI.
- README refresh for the 0.3 workflow.
- Release documentation:
  - 0.3 acceptance script.
  - privacy review.
  - model license/package audit.
  - FFmpeg distribution audit.
  - packaging checklist.
- Automated focused and full verification.
- Browser smoke for Help Center and release-readiness UI.

### Excluded

- Bundling model weights into the standard installer.
- Cross-platform installers.
- Release signing certificates.
- Cloud sync, collaboration, batch processing, sample projects, and advanced NLE effects.
- Replacing the existing ASR or translation model runtimes.
- Hiding test-only fake providers from source code.

## Release-Readiness Checks

The release-readiness report is a product and engineering gate. It should return structured checks with severity:

- `pass`: requirement is satisfied.
- `warning`: acceptable for development, must be reviewed before public release.
- `blocker`: 0.30 cannot be accepted until fixed or explicitly waived by a later release decision.

Initial checks:

- `version_metadata`: Worker and app metadata are `0.3.0`.
- `ffmpeg_available`: FFmpeg is discoverable in the active runtime.
- `ffprobe_available`: FFprobe is discoverable in the active runtime.
- `model_registry_checksums`: built-in registry entries do not use placeholder checksums.
- `model_registry_sources`: built-in registry entries use downloadable package sources, not bare model-card pages.
- `model_registry_licenses`: model entries expose license names and license URLs.
- `local_translation_only`: the formal UI does not expose remote translation controls.
- `desktop_packaging`: Tauri bundle configuration is enabled for Windows.
- `help_center`: Help Center is available in both Chinese and English.
- `privacy_docs`: release privacy review exists.
- `acceptance_script`: end-to-end release acceptance script exists.

The report should be visible from Settings and available from the Worker API. It can have blockers during implementation, but the final 0.30 stage gate cannot accept the release while blockers remain.

## Documentation Requirements

0.30 must update user-facing docs to match the actual 0.3 product:

- README must describe current SRT, VTT, ASS, and burn-in video export.
- README must describe the built-in model manager as the formal model path.
- README must not present LibreTranslate as the normal product workflow.
- Setup docs must clearly separate developer mode from installed desktop use.
- Release docs must state that model weights are downloaded separately and governed by upstream licenses.
- Release docs must state FFmpeg distribution obligations and the selected binary strategy.
- Acceptance docs must be executable as a checklist by a human tester.

## Manual Acceptance Script

The full 0.3 release acceptance script must cover:

1. Install the Windows desktop app from a release bundle.
2. Open the app without a developer terminal.
3. Confirm runtime status, directories, FFmpeg, and FFprobe from Settings.
4. Open Help Center and confirm Chinese and English content.
5. Install a curated ASR model from Models.
6. Install a curated Chinese-English translation model from Models.
7. Create a project from a local MP4 with an audio stream.
8. Run local ASR and confirm subtitle rows are generated.
9. Run local Chinese-English translation and confirm translations are generated.
10. Edit timing and text in the Workbench.
11. Use undo, redo, split, merge, batch timing offset, autosave draft, stable save, and snapshot recovery.
12. Export SRT, VTT, ASS, and a burned-in MP4.
13. Confirm generated files are in the project exports directory.
14. Open diagnostics/log paths from Settings and project actions.
15. Confirm no formal ASR/translation workflow sends media or subtitle text to a remote service after model download.

## Acceptance Criteria

0.30 is complete only when:

- Version metadata is `0.3.0` across package manifests, Worker metadata, Tauri config, Rust metadata, and README.
- `scripts/verify-version.mjs` passes and is run by `scripts/check.ps1`.
- Tauri Windows bundle configuration is enabled and documented.
- The Help Center is reachable from the app rail and has complete Chinese and English coverage.
- Settings shows release-readiness checks and clearly distinguishes blockers from warnings.
- Worker `/release/readiness` returns structured readiness data.
- Release docs exist for packaging, privacy, model audit, FFmpeg audit, and manual acceptance.
- README reflects the 0.3 local/offline workflow.
- Focused verification passes.
- Full repository verification passes.
- Browser smoke verifies Help Center and release-readiness UI.
- Installer smoke and real local ASR plus translation plus burn-in export acceptance either pass or are recorded as blockers. The stage cannot be accepted if blockers remain.
- A 0.30 stage gate review records verification evidence, blocker status, and acceptance decision.

## Known Release Risks

- The current model manager downloads local files and ordinary URLs, but production model entries point at Hugging Face repository pages and still contain placeholder checksums. This is a release blocker unless fixed before the 0.30 stage gate.
- Public model metadata and licenses can change. The final audit must use current upstream model cards and pinned package revisions.
- FFmpeg binary selection changes the license obligations. The project must not ship an incompatible binary without matching license/source obligations.
- Tauri installer generation may require local Windows packaging toolchain components that are not installed on every development machine.
- The final NVIDIA GPU workflow cannot be proven on a CPU-only or model-less environment.
