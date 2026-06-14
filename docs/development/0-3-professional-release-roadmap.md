# Diplomat 0.3 Professional Release Roadmap

Checkpoint date: 2026-06-14

## Goal

Diplomat 0.3 is the professional Windows desktop release. It should turn the current 0.2 desktop-style subtitle workbench into a complete local subtitle production tool that a user can install, open, configure, and use without a terminal.

The final 0.3 workflow is:

1. Install and open the Windows desktop app.
2. Create or reopen a local video project.
3. Download a curated open-source ASR or translation model through the built-in model manager.
4. Transcribe a real local video with local ASR.
5. Translate Chinese-English subtitles locally.
6. Review and refine subtitles in a professional editor with video, waveform, timeline, shortcuts, undo/redo, autosave drafts, and stable save snapshots.
7. Export SRT, VTT, ASS, or a burned-in subtitle video.
8. Diagnose failures through application-visible logs and help content.

## Product Principles

- Windows is the 0.3 supported desktop platform.
- NVIDIA GPU is the recommended production environment.
- CPU-only is a fallback path for short media, light models, demo flows, and non-AI editing, but it is not the primary performance target.
- The formal product path is strictly local and offline after model download.
- Networking is allowed only for curated open-source model downloads and application/model-list update checks.
- Remote ASR and remote translation must not appear in the 0.3 formal product path.
- Model weights are not committed to the repository or bundled into the standard installer.
- The standard installer bundles the app and FFmpeg, but not AI model weights.
- FFmpeg distribution must pass a release legal check, including license text, version, source/build provenance, and avoidance of incompatible binary choices.
- The model manager exposes only Diplomat-curated open-source models in the formal UI.
- Chinese-English is the 0.3 hard acceptance language pair. The architecture should remain extensible for other languages.
- Chinese and English UI are both formal product experiences.
- Batch media processing, cross-platform installers, advanced NLE features, karaoke effects, multi-track subtitle editing, cloud sync, collaboration, and sample projects are outside 0.3.

## Release Process

0.3 is split into ten internal milestones: 0.21 through 0.30. Each milestone is a 0.01 stage. A stage is not complete until it is documented, implemented, verified, reviewed, merged to `main`, and pushed to GitHub.

Required sequence for every stage:

1. Start from clean `main`.
2. Create an isolated branch using the `codex/` prefix.
3. Write or update the stage development document.
4. Write the stage implementation plan.
5. Review the docs for scope, contradictions, missing acceptance criteria, and stale assumptions.
6. Commit the docs.
7. Implement the stage in focused commits.
8. Run focused verification while implementing.
9. Run full repository verification before stage acceptance.
10. Run stage gate reviews:
    - specification compliance review.
    - code quality review.
    - product workflow review.
    - licensing/security/privacy review when the stage touches models, FFmpeg, installers, paths, or local serving.
11. Fix all blocking findings.
12. Merge the accepted branch to `main`.
13. Push `main` to GitHub.

Recommended full verification command:

```powershell
.\scripts\check.ps1
```

Stages that touch the desktop shell, installer, browser-visible UI, or video editor must also define focused manual and E2E verification commands in that stage's implementation plan.

## Milestone Map

| Version | Theme | Product Outcome |
| --- | --- | --- |
| 0.21 | Desktop runtime foundation | The Windows desktop shell owns Worker lifecycle, app directories, diagnostics, and bundled FFmpeg groundwork. |
| 0.22 | Complete project center | Projects can be searched, deleted, cleaned, backed up, imported, diagnosed, and opened without understanding internal folders. |
| 0.23 | Built-in model manager | Users can download, verify, install, inspect, and delete curated open-source models. |
| 0.24 | Real local ASR | Users can transcribe real local video with local ASR, progress, cancel, retry, and diagnostics. |
| 0.25 | Local translation | Users can perform offline Chinese-English translation through light and high-quality local model tiers. |
| 0.26 | Professional editing core | Users can edit against video preview, waveform, zoomable timeline, draggable subtitle blocks, and timing validation. |
| 0.27 | Editing workflow polish | Users get shortcuts, split/merge, batch timing tools, undo/redo, autosave drafts, stable saves, and recovery snapshots. |
| 0.28 | Subtitle export and visual styles | Users can export SRT/VTT/ASS and configure subtitle styles with live preview and presets. |
| 0.29 | Burned-in video export | Users can render a new video with burned-in subtitles through FFmpeg with progress, cancel, safety, and diagnostics. |
| 0.30 | Release hardening | The app is packaged, documented, localized, audited, and accepted as the full 0.3 release. |

## 0.21 Desktop Runtime Foundation

### Objective

Make the desktop app responsible for local runtime ownership instead of relying on developer terminals.

### Deliverables

- Tauri commands for Worker start, stop, status, diagnostics, and app directory discovery.
- Stable app-owned directories for projects, models, downloads, exports, logs, cache, and diagnostics.
- Worker lifecycle behavior for development and packaged modes.
- Port conflict detection that distinguishes Diplomat Worker from an unrelated service.
- Worker logs written to a predictable diagnostics directory.
- FFmpeg bundling plan implemented far enough for runtime discovery and version/license reporting.
- Settings or diagnostics surface that shows Worker status, FFmpeg status, directory paths, and recent runtime errors.
- Desktop-safe local file picking for video import.

### Acceptance Criteria

- A developer can launch the desktop app and see Worker status without manually starting Uvicorn.
- The web layer can request desktop runtime status through a stable boundary.
- Runtime diagnostics are visible in the UI and stored on disk.
- FFmpeg path and version are detectable from the desktop application context.
- Browser-only development mode still has a documented fallback.

## 0.22 Complete Project Center

### Objective

Turn the current project center into a complete local project library.

### Deliverables

- Project search and status filters.
- Project delete with confirmation and safe file handling.
- Project disk usage display.
- Open project folder, export folder, and log folder actions.
- Project cache cleanup.
- Export cleanup.
- Project backup/export package.
- Project import/restore package.
- Project status derivation: not transcribed, transcribed, translated, dirty draft, exported, failed task.
- Clear empty, unavailable, corrupted, and migration-failed states.

### Acceptance Criteria

- Users can manage projects without manually browsing internal directories.
- Destructive actions require confirmation, show the affected files or directories, and clearly state when an action cannot be undone.
- Backup/import preserves subtitle documents, project metadata, and references needed to reopen the project.
- Project center remains responsive with a realistic number of projects.

## 0.23 Built-In Model Manager

### Objective

Provide a formal, curated model installation path for local ASR and translation.

### Deliverables

- Model registry schema for curated open-source models.
- Registry entries for ASR and translation model tiers:
  - light tier.
  - high-quality tier.
- Per-model metadata:
  - name.
  - provider/runtime.
  - task type.
  - language support.
  - model size.
  - download size.
  - disk requirement.
  - recommended hardware.
  - license.
  - source URL.
  - checksum.
  - version.
- Download queue with progress, cancel active download, retry failed download, and failure diagnostics.
- Checksum verification and install state tracking.
- Model deletion and cache cleanup.
- UI surfaces for model details, license text, hardware warnings, and installed status.
- Tests using mocked downloads and fake model entries.

### Acceptance Criteria

- Users can install only curated models through the formal UI.
- The app refuses to use incomplete or checksum-failed models.
- Installed model state persists across restarts.
- The model manager can explain why a model is unavailable.
- No test requires downloading a real model.

## 0.24 Real Local ASR

### Objective

Replace fake ASR as the formal user path with real local transcription while keeping deterministic fake ASR for tests.

### Deliverables

- ASR runtime integration using model-manager-installed models.
- GPU-first execution path with clear CPU fallback behavior.
- Hardware and model compatibility checks before job start.
- Audio extraction and preprocessing tied to project directories.
- Analysis job progress, cancel, retry, failure state, and diagnostic log paths.
- Subtitle document generation from real ASR segments.
- Preservation of fake ASR as a test/demo provider outside the formal product path.
- UI for selecting installed ASR model tier and starting transcription.

### Acceptance Criteria

- A short real local video can be transcribed into editable subtitle lines.
- Job state remains accurate through queued, running, completed, failed, canceled, and retried states.
- Failed ASR jobs leave actionable diagnostics.
- Generated subtitle lines can be edited, saved, reopened, and exported as text subtitles.

## 0.25 Local Translation

### Objective

Provide offline Chinese-English translation through curated local models.

### Deliverables

- Local translation runtime integration using model-manager-installed models.
- Light and high-quality translation tiers.
- Chinese-to-English and English-to-Chinese hard acceptance paths.
- Translation compatibility checks before job start.
- Translation job progress, cancel, retry, failure state, and diagnostics.
- Per-line translation metadata for generated, edited, missing, failed, and stale translations.
- UI for model tier selection, translation mode, overwrite/missing-only behavior, and failure recovery.
- Removal or hiding of remote translation providers from the formal 0.3 UI.

### Acceptance Criteria

- A saved source subtitle document can be translated offline in both Chinese-English directions.
- Manually edited translations are protected from accidental overwrite unless the user explicitly chooses overwrite behavior.
- Bilingual save/reopen/export remains reliable.
- The formal UI does not require or encourage a remote translation endpoint.

## 0.26 Professional Editing Core

### Objective

Make the workbench feel like a subtitle editor rather than a form-based review tool.

### Deliverables

- Video preview with local media access in desktop mode.
- Playback state shared with the subtitle editor.
- Click subtitle row to seek.
- Active line highlighting during playback.
- Waveform generation job and waveform data endpoint.
- Waveform renderer with playhead and selected subtitle range.
- Zoomable and scrollable timeline.
- Subtitle blocks rendered on the timeline.
- Drag subtitle blocks to move timing.
- Resize subtitle block edges to adjust start/end.
- Timing validation for negative time, end-before-start, overlaps, too-short duration, and likely overlong text.

### Acceptance Criteria

- Users can edit subtitle timing while watching and seeking video.
- Waveform and timeline remain synchronized with playback time.
- Drag/resize operations update draft state without corrupting subtitle order.
- Invalid timing is visible before save/export.

## 0.27 Editing Workflow Polish

### Objective

Complete the core editing loop for repeated daily use.

### Deliverables

- Keyboard shortcut system with focus-safe input gating.
- Shortcut help panel.
- Split subtitle at cursor or playhead.
- Merge with previous and merge with next.
- Batch offset selected lines, all lines, or lines after playhead.
- Undo/redo stack for text and timing edits.
- Autosaved draft state.
- Manual stable save.
- Version snapshots around risky operations:
  - ASR overwrite.
  - translation overwrite.
  - batch timing.
  - burn-in export preparation.
- Recovery UI for drafts and snapshots.
- Export protection based on stable saved state.

### Acceptance Criteria

- Users can recover from common editing mistakes without leaving the app.
- Shortcuts do not fire accidentally inside text fields.
- Autosave prevents accidental data loss, while stable save keeps export behavior predictable.
- Reopening a project offers clear draft recovery when relevant.

## 0.28 Subtitle Export And Visual Styles

### Objective

Complete text subtitle output and subtitle appearance configuration.

### Deliverables

- SRT export hardening.
- VTT export.
- ASS export.
- Export mode selection: source, target, bilingual.
- Visual style editor:
  - font family.
  - font size.
  - primary/secondary colors.
  - outline.
  - shadow.
  - background bar.
  - alignment.
  - margins.
  - line spacing.
  - bilingual layout.
  - safe-area overlay.
- Live style preview over video.
- Style preset save, select, rename, and delete.
- Export validation and user-visible warnings.

### Acceptance Criteria

- SRT, VTT, and ASS exports are generated from the stable saved subtitle document.
- Bilingual exports preserve source and target text as configured.
- Style changes are previewable before export.
- Export is blocked or warned when subtitle timing is invalid.

## 0.29 Burned-In Video Export

### Objective

Render a new video file with burned-in subtitles.

### Deliverables

- Burn-in export request schema.
- FFmpeg command construction with safe path handling.
- ASS intermediate generation from the selected style preset.
- Export task state, progress, cancel, retry by starting a fresh render from the same settings, and diagnostics.
- Output path safety:
  - never overwrite source video.
  - default to project exports directory.
  - explicit user-selected output path when supported by desktop UI.
- Output validation after render.
- Open output folder action.
- Failure messages for missing FFmpeg, invalid fonts, path errors, codec failures, and canceled jobs.

### Acceptance Criteria

- A short local video can be rendered into a playable output video with visible subtitles.
- Progress and cancel behavior are visible and reliable enough for real use.
- Output files are never written unsafely or over source media.
- Diagnostics let a user or developer understand failed FFmpeg renders.

## 0.30 Release Hardening

### Objective

Package, audit, document, localize, and verify the full 0.3 release.

### Deliverables

- Windows installer pipeline.
- First-run experience for runtime checks, model installation, and project setup.
- Full in-app help center without sample projects.
- Complete Chinese and English UI coverage.
- Accessibility and keyboard review.
- Performance pass for project center, editor, model manager, and export flows.
- Privacy review confirming no formal ASR/translation path sends media or text remotely.
- Model license audit.
- FFmpeg license and distribution audit.
- Installer smoke tests.
- End-to-end manual acceptance script from install to burned-in video export.
- README and development docs updated for 0.3.
- Version metadata updated to 0.3.0.

### Acceptance Criteria

- A user can install Diplomat on Windows and complete the full workflow without opening a terminal.
- The full Chinese-English local workflow passes on the recommended NVIDIA GPU environment.
- CPU fallback behavior is documented and does not misrepresent performance expectations.
- All mandatory automated checks pass.
- All mandatory manual acceptance steps pass.
- The repository has a clean `main` branch pushed to GitHub for the 0.3 release.

## Review Gates

Every stage must end with a stage gate document under `docs/development/` recording:

- stage version.
- branch.
- commits reviewed.
- automated verification commands and results.
- manual verification steps and results.
- known limitations.
- review findings and fixes.
- acceptance decision.

The next stage must not begin until the current stage gate is accepted.

## Documentation Plan

Master roadmap:

- `docs/development/0-3-professional-release-roadmap.md`

Per-stage development documents:

- `docs/development/0-21-desktop-runtime-foundation.md`
- `docs/development/0-22-complete-project-center.md`
- `docs/development/0-23-model-manager.md`
- `docs/development/0-24-real-local-asr.md`
- `docs/development/0-25-local-translation.md`
- `docs/development/0-26-professional-editing-core.md`
- `docs/development/0-27-editing-workflow-polish.md`
- `docs/development/0-28-export-visual-styles.md`
- `docs/development/0-29-burn-in-video-export.md`
- `docs/development/0-30-release-hardening.md`

Per-stage implementation plans:

- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-21-desktop-runtime-foundation.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-22-complete-project-center.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-23-model-manager.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-24-real-local-asr.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-25-local-translation.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-26-professional-editing-core.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-27-editing-workflow-polish.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-28-export-visual-styles.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-29-burn-in-video-export.md`
- `docs/superpowers/plans/YYYY-MM-DD-diplomat-0-30-release-hardening.md`

Stage gate reviews:

- `docs/development/0-21-stage-gate-review.md`
- `docs/development/0-22-stage-gate-review.md`
- `docs/development/0-23-stage-gate-review.md`
- `docs/development/0-24-stage-gate-review.md`
- `docs/development/0-25-stage-gate-review.md`
- `docs/development/0-26-stage-gate-review.md`
- `docs/development/0-27-stage-gate-review.md`
- `docs/development/0-28-stage-gate-review.md`
- `docs/development/0-29-stage-gate-review.md`
- `docs/development/0-30-stage-gate-review.md`
