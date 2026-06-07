# M2b-M6 Development Roadmap

Diplomat is currently at M2a: a developer-facing workbench loop that can create a local project from a video path, run the fake-ASR pipeline, edit subtitle lines, save the internal subtitle document, and export SRT. This is an architecture proof and a useful development slice, not yet a production subtitle editor.

This document defines the next stages from M2b through M6. Each stage must be planned, implemented, reviewed, verified, and accepted before the next stage begins. The intent is to support long-running goal-mode execution without losing stage boundaries or quality gates.

## Current Product Reality

M2a proves that the main layers can communicate:

- Python Worker owns durable project state and file output.
- React workbench can call Worker APIs and validate responses through shared TypeScript schemas.
- Subtitle documents can be edited and saved.
- SRT export writes a real file.

M2a still has early-stage limitations:

- Users manually type local video paths.
- The web workbench is not yet integrated with Tauri desktop file dialogs.
- Analysis still uses fake ASR.
- Translation generation does not exist.
- No project list, project reopening, or recent-project workflow exists.
- No background task queue, progress stream, cancellation, or retry exists.
- No video preview, waveform, timeline, or keyboard-first subtitle editing exists.
- No VTT, ASS, styled subtitle rendering, or burned-in video export exists.
- SQLite schema migration is not yet safe for older local databases.

## Execution Model

Each stage should run as its own implementation goal:

1. Create or update a detailed implementation plan for the stage.
2. Start from a clean `master`.
3. Create an isolated branch or worktree.
4. Implement with focused commits and test-first changes.
5. Run focused tests after each task.
6. Run the full repository verification before stage completion.
7. Dispatch a final stage review that checks the stage objective, not just tests.
8. Merge only after the final review finds no blocking issues.

Do not begin the next stage until the current stage has passed its stage gate.

Required verification at every stage:

```powershell
.\scripts\check.ps1
```

Required review gates at every stage:

- Specification compliance review.
- Code quality review.
- Product workflow review for user-facing behavior.
- Final integration readiness review.

Definition of "done" for a stage:

- All explicitly listed deliverables are implemented.
- Tests cover the main success path and the main failure paths.
- Documentation is updated.
- The full check script passes.
- The working tree is clean.
- A reviewer can run the stage's manual test from the documentation.
- No blocking review findings remain.

## Milestone Summary

| Stage | Theme | Product Outcome |
| --- | --- | --- |
| M2b | Usability foundation | The development build becomes easy to try locally with file picking, project reopening, safer persistence, and Worker lifecycle support. |
| M3 | Real ASR MVP | Users can transcribe real local video/audio through a local faster-whisper path with progress and cancellable jobs. |
| M4 | Translation and bilingual subtitles | Users can generate, review, edit, and export bilingual subtitles from source to target language. |
| M5 | Professional editing workbench | Users can edit subtitles against video preview, waveform, timeline, shortcuts, and batch timing tools. |
| M6 | Export and burn-in | Users can export SRT, VTT, ASS, and burned-in video with visible progress and validation. |

---

## M2b: Usability Foundation

### Goal

Turn the M2a developer loop into a usable local desktop workflow before adding real AI complexity.

M2b should make the current app feel like a real early desktop application: the user can pick a file, create and reopen projects, see clear Worker state, and recover from basic errors without reading logs.

### Non-Goals

M2b must not add real ASR, translation, waveform editing, timeline editing, subtitle burn-in, or model management. Those belong to M3 and later.

### Product Deliverables

- Tauri file picker for selecting a source video.
- Project list or recent-project panel.
- Reopen project workflow.
- Worker lifecycle management from the desktop shell.
- Clear development storage directory behavior.
- SQLite migration path for M2a project metadata.
- More actionable errors in the workbench.
- A sample manual test workflow documented for local developers.

### Architecture

M2b should keep the Worker responsible for durable state and file access. The Tauri shell should handle desktop-native actions such as file selection and process lifecycle, then pass data to the React workbench. The React app should stop assuming that the user knows filesystem paths.

Preferred boundaries:

- `apps/desktop`: desktop commands, file picker, Worker launch/stop, app lifecycle.
- `apps/web`: UI workflow, project list, error display, API client calls.
- `worker`: project listing, project loading, schema migration, stable API behavior.
- `packages/shared`: shared response schemas for project list and desktop-visible data.

### Worker Work

Add project listing and reopening endpoints:

- `GET /projects`
- `GET /projects/{project_id}`
- Optional later endpoint for deleting projects, but do not add destructive project deletion in M2b unless the UI needs it.

Project list response should include:

- `projectId`
- `name`
- `sourceVideoPath`
- `projectDir`
- `durationMs`
- `sourceLanguage`
- `targetLanguage`
- `createdAt`
- `updatedAt`

Add schema migration support:

- Store an integer schema version.
- Detect pre-M2a project databases.
- Add missing columns using `ALTER TABLE`.
- Preserve existing project rows when possible.
- Test migration from a minimal older schema.

Improve storage tests:

- Fresh database creation.
- Existing M2a database reopen.
- Older database migration.
- Invalid database handling.

### Desktop Work

Add Tauri commands:

- `pick_video_file()`
- `start_worker()`
- `stop_worker()`
- `worker_status()`
- `open_path_in_file_manager(path)`

The desktop layer should not parse subtitle documents. It should only handle operating-system integration and process management.

Worker lifecycle behavior:

- Start the Worker on a stable local port.
- Detect if the port is already occupied by a Diplomat Worker.
- Fail clearly if the port is occupied by another process.
- Stop the Worker when the desktop app exits in development mode.
- Write Worker logs to a predictable diagnostics directory.

### Web Workbench Work

Add a project sidebar or compact project strip:

- Recently created projects.
- Reopen project.
- Show source path and duration.
- Show whether subtitles exist.

Replace manual source path entry with:

- A desktop file picker when running under Tauri.
- Manual path fallback when running in browser-only development mode.

Improve error states:

- No Worker running.
- Worker running but wrong service on port.
- Video path not found.
- No audio stream.
- Unsupported file.
- Migration failed.

Add empty states that are operational, not explanatory marketing text:

- No project selected.
- No subtitles generated.
- No export yet.

### Shared Schema Work

Add schemas for:

- Project list item.
- Project list response.
- Reopen project response if it differs from `ProjectResponse`.
- Worker lifecycle status if exposed to web.

### Testing

Required Python tests:

- Project list endpoint.
- Reopen project endpoint.
- Migration from old project table.
- Migration does not rewrite subtitle documents.
- Project `updatedAt` changes after subtitle save or export when applicable.

Required TypeScript tests:

- Shared project list schemas.
- Web API client `listProjects`.
- React project reopen workflow with mocked Worker responses.
- File-picker fallback behavior.

Required desktop tests:

- Tauri command metadata or command unit tests where practical.
- Worker lifecycle command tests with process spawning mocked when direct process tests are fragile.

### Manual Test

1. Start the development desktop app.
2. Start the Worker through the app.
3. Pick a local video file with the file picker.
4. Create a project.
5. Confirm the project appears in the recent-project list.
6. Run analysis.
7. Save one subtitle edit.
8. Close and reopen the app.
9. Reopen the project from the list.
10. Confirm saved subtitle edits are still present.

### Acceptance Criteria

M2b is complete when:

- A developer can run the desktop development app without manually starting the Worker in a separate terminal.
- A user can select a video through a file picker.
- A project can be reopened after app restart.
- Existing M2a fresh databases still work.
- Older development databases migrate or fail with a clear diagnostic.
- All tests and typechecks pass through `.\scripts\check.ps1`.

### Stage Gate

Do not start M3 until:

- Project reopen is reliable.
- Worker lifecycle behavior is stable enough for real ASR jobs.
- Storage migration is tested.
- The final M2b review confirms no blocking workflow gaps.

---

## M3: Real ASR MVP

### Goal

Replace fake-ASR as the main user path with real local transcription while preserving fake-ASR as a deterministic test path.

M3 should let a user select a local video, run a real transcription job, see progress, and receive editable subtitle lines generated from real speech.

### Non-Goals

M3 must not implement translation, diarization, waveform editing, timeline editing, or burned-in video export. It may expose model configuration, but it must not ship third-party model weights inside the MIT repository.

### Product Deliverables

- Real transcription path using the existing faster-whisper adapter or a refined local ASR abstraction.
- Model configuration UI.
- Development model setup instructions.
- Background job queue for analysis.
- Progress events.
- Cancel analysis.
- Retry failed analysis.
- ASR diagnostics in Worker logs.
- Fake-ASR remains available for tests and demos.

### Architecture

The Worker should own ASR execution. The React app should submit jobs and render task progress. Long-running jobs must not run directly inside request handlers.

Preferred boundaries:

- Worker task queue coordinates long-running jobs.
- ASR provider interface hides faster-whisper-specific details.
- API endpoints start, inspect, cancel, and retry jobs.
- Web app subscribes to progress through polling first; streaming can be added later if needed.

### Worker Job Model

Introduce task records:

- `taskId`
- `projectId`
- `type`
- `status`
- `progress`
- `message`
- `startedAt`
- `updatedAt`
- `completedAt`
- `errorCode`
- `errorMessage`
- `diagnosticLogPath`

Required statuses:

- `queued`
- `running`
- `canceling`
- `canceled`
- `failed`
- `completed`

Required task endpoints:

- `POST /projects/{project_id}/analysis-jobs`
- `GET /tasks/{task_id}`
- `POST /tasks/{task_id}/cancel`
- `POST /tasks/{task_id}/retry`

Keep `POST /projects/{project_id}/analyze` as a compatibility shortcut only if useful; it should either call the new job system or be clearly documented as a test-only synchronous endpoint.

### ASR Provider Work

Define provider interface:

- `transcribe(audio_path, language, progress_callback, cancel_token)`
- returns normalized segments with start/end/text/confidence when available.

Provider implementations:

- `FakeTranscriber` for tests.
- `FasterWhisperTranscriber` for local development.

Model configuration:

- model name or local model path.
- compute type.
- device preference.
- source language.
- optional initial prompt.

Model storage:

- Do not commit model weights.
- Store user-selected model paths in local config.
- Document third-party model licenses and user responsibility.

### Audio Pipeline Work

M3 should make the current audio extraction path robust:

- Verify FFmpeg exists before job starts.
- Extract audio to project workspace.
- Store derived audio paths under the project directory.
- Clean or reuse intermediate audio according to a clear policy.
- Log FFmpeg command failures.

Chunking should be explicit:

- Use fixed-size chunks for large media.
- Preserve original timeline offsets.
- Merge adjacent ASR segments only when safe.
- Keep word timings when provider returns them.

### Web Workbench Work

Add analysis job UI:

- Model configuration panel.
- Analyze button starts a job.
- Progress bar and current message.
- Cancel button while running.
- Retry button on failure.
- Diagnostic path on failure.
- Disable subtitle editing while analysis replaces the document.

The UI should make fake/real mode visible in development builds so reviewers know what path they are testing.

### Shared Schema Work

Add schemas for:

- Analysis job creation request.
- Task response.
- Cancel response.
- Retry response.
- ASR model config.

Update task schemas if existing task types are too generic.

### Testing

Required Python tests:

- Job creation stores queued/running/completed status.
- Fake ASR job writes subtitle document.
- Cancel requested before job starts results in `canceled`.
- Failed ASR returns `failed` with diagnostic path.
- Retry creates or reuses a job according to documented behavior.
- FFmpeg missing returns actionable error.
- Faster-whisper provider is covered through unit tests with provider mocked if real model execution is too heavy for CI.

Required TypeScript tests:

- Shared task/job schemas.
- Web API client job helpers.
- React analysis progress UI with mocked task responses.
- Cancel and retry UI paths.

Manual real-ASR test:

1. Configure a local faster-whisper model.
2. Select a short video with speech.
3. Start analysis.
4. Observe progress.
5. Confirm generated subtitle lines match speech approximately.
6. Cancel a second run and confirm status changes.
7. Retry a failed run with a corrected model path.

### Acceptance Criteria

M3 is complete when:

- A user can run real local transcription on a short video.
- The UI shows progress and completion.
- Generated subtitles are editable and saveable through the M2a editor.
- Fake-ASR remains available for deterministic tests.
- Long-running work is represented by task state.
- Cancel and failure paths are test-covered.
- Full repository verification passes.

### Stage Gate

Do not start M4 until:

- Real ASR is stable on short videos.
- Long-running task state is reliable.
- The UI can handle failed and canceled analysis.
- Model weights remain outside the repository.

---

## M4: Translation and Bilingual Subtitles

### Goal

Add translation generation so Diplomat can produce bilingual subtitles from source speech to a target language.

M4 should support Chinese-to-English and English-to-Chinese as first-class workflows, while keeping the provider abstraction open for future local or remote translation engines.

### Non-Goals

M4 must not implement full glossary management, team review workflow, professional timeline editing, or burned-in export. It should not require a paid remote API to run the default test suite.

### Product Deliverables

- Translation provider interface.
- Deterministic fake translation provider for tests.
- Configurable real translation provider path.
- Batch translation job.
- Per-line translation status.
- Editable translated text.
- Source-only, target-only, and bilingual export behavior verified end-to-end.
- UI controls for source and target language workflow.

### Architecture

Translation should be a Worker-owned job, like ASR. The React app should request translation, show progress, and edit resulting target text.

Preferred boundaries:

- Worker owns provider execution and subtitle document mutation.
- Shared schemas define translation job and line status.
- Web app provides commands and review surfaces.
- Export code consumes the same `translated_text` field that editing uses.

### Subtitle Schema Evolution

The current subtitle line shape already includes:

- `sourceLanguage`
- `targetLanguage`
- `sourceText`
- `translatedText`
- `reviewStatus`
- `notes`

M4 may need additional metadata:

- `translationStatus`: `not_requested`, `queued`, `translated`, `edited`, `failed`
- `translationOrigin`: provider/model metadata.
- `translationError`: nullable short error code or message.

If added, schema migration must be explicit for existing M2a/M3 subtitle documents.

### Worker Translation API

Add endpoints:

- `POST /projects/{project_id}/translation-jobs`
- `GET /projects/{project_id}/translation-settings`
- `PUT /projects/{project_id}/translation-settings`

Translation job request:

- `sourceLanguage`
- `targetLanguage`
- `provider`
- `mode`: `missing_only` or `overwrite_all`
- optional provider settings reference.

Translation job response should use the same task model introduced in M3.

### Provider Strategy

Providers:

- `FakeTranslationProvider` for tests.
- Real provider adapter selected after an explicit technical decision.

Provider selection criteria:

- Works on Windows development environments.
- Can be disabled in CI.
- Does not force secrets into the repository.
- Has clear licensing.
- Can translate one line at a time and batches of lines.

If using a remote provider:

- API keys must live in local environment variables or config.
- Tests must mock provider calls.
- UI must make remote processing explicit.

If using a local provider:

- Model weights must not be committed.
- Model license must be documented.
- Hardware requirements must be documented.

### Web Workbench Work

Add translation controls:

- Translate button.
- Source language and target language fields.
- Mode selector: translate missing lines or overwrite all translations.
- Progress status.
- Failure summary.

Update editor:

- Make translated text a primary field, not a secondary afterthought.
- Show whether translation is generated or manually edited.
- Allow clearing target text for source-only workflows.

Update line list:

- Show source and translated snippets.
- Show translation status.
- Filter lines with missing translations.

### Export Work

Verify:

- Source SRT writes source text.
- Target SRT writes translated text or falls back to source if empty.
- Bilingual SRT writes both when different.
- Exports after translation include saved translation edits.
- Unsaved edits still block export.

### Testing

Required Python tests:

- Fake translation provider maps source text deterministically.
- Translation job updates `translated_text`.
- Missing-only mode does not overwrite manual translations.
- Overwrite-all mode replaces existing translations.
- Failed provider marks task failed and preserves source text.
- Export after translation contains target text.

Required TypeScript tests:

- Translation schemas.
- Web API translation helpers.
- React translate button and progress UI.
- Missing translation filter.
- Save translated text and export bilingual flow.

Manual test:

1. Run real or fake ASR on a short video.
2. Set source language and target language.
3. Start translation.
4. Confirm translated text appears line by line.
5. Edit one translation.
6. Save.
7. Export bilingual SRT.
8. Confirm source and target lines appear in the exported file.

### Acceptance Criteria

M4 is complete when:

- A project can move from source transcription to translated subtitles.
- Users can review and edit translated text.
- Bilingual export uses saved translated text.
- Translation jobs have progress, failure, and retry behavior.
- Tests do not require real paid translation services.
- Full repository verification passes.

### Stage Gate

Do not start M5 until:

- Translation state is represented clearly in the subtitle document.
- The editor can distinguish generated text from edited text.
- Bilingual export is reliable after save/reopen.

---

## M5: Professional Subtitle Editor

### Goal

Turn the workbench into a professional subtitle editing surface with video context, timing tools, keyboard-first workflows, and scalable editing behavior.

M5 should make Diplomat feel like an editing tool rather than a form-based demo.

### Non-Goals

M5 must not implement burned-in video export. It may preview styles, but final FFmpeg burn-in belongs to M6.

### Product Deliverables

- Video preview.
- Playback controls.
- Current time tracking.
- Click subtitle line to seek.
- Waveform display.
- Timeline subtitle track.
- Drag or numeric timing edits.
- Keyboard shortcuts.
- Split and merge subtitle lines.
- Batch time offset.
- Validation for overlapping or invalid subtitle timings.
- Autosave or explicit dirty-state handling that is safer than M2a.

### Architecture

The browser UI should own interactive editing state. The Worker should remain the durable store and media processing service. Performance-sensitive UI state should not be round-tripped to the Worker on every keystroke or drag.

Preferred boundaries:

- Web app owns playback state, selection, timeline viewport, and dirty edits.
- Worker provides media metadata and optional waveform data.
- Shared schemas represent persisted subtitle documents and validation results.
- Export continues to use saved documents only.

### Video Preview

Add a preview panel:

- Load local video safely through Tauri or a local media URL mechanism.
- Show current playback time.
- Play/pause.
- Seek.
- Playback rate.
- Mute/volume.

Security and file access must be explicit:

- Browser-only dev mode may use a typed path and Worker-served media endpoint.
- Tauri desktop should use secure local file permissions.
- Do not expose arbitrary filesystem browsing through unauthenticated HTTP endpoints.

### Waveform

Worker should generate waveform data:

- Use FFmpeg or a small audio analysis helper.
- Store waveform JSON under project derived assets.
- Include duration, sample rate, and amplitude buckets.

Waveform API:

- `GET /projects/{project_id}/waveform`
- `POST /projects/{project_id}/waveform-jobs` if waveform generation is long-running.

UI waveform behavior:

- Render amplitude over time.
- Highlight current playback time.
- Highlight selected subtitle line range.
- Support zoom.
- Support horizontal scroll for long media.

### Timeline Editing

Timeline should show:

- Subtitle segments on a track.
- Current playhead.
- Selected segment.
- Overlap warning.

Editing behavior:

- Drag segment edges to adjust start/end.
- Drag whole segment to move timing.
- Snap to playhead optionally.
- Numeric inputs remain available for precise edits.

Validation:

- `endMs > startMs`
- no negative timings.
- warn on overlap.
- warn on very short duration.
- warn on long text for short duration.

### Keyboard Shortcuts

Initial shortcuts:

- Space: play/pause when not typing.
- J/K/L or arrow shortcuts for seek.
- Enter: save selected line.
- Ctrl+S: save document.
- Ctrl+Enter: split line at playhead or cursor when safe.
- Delete: clear selected line only after confirmation or undo support exists.

Shortcut handling must not fire inside text inputs unless explicitly intended.

### Editing Commands

Add commands:

- Split subtitle line.
- Merge with previous.
- Merge with next.
- Duplicate line.
- Shift selected line timing.
- Shift all lines after cursor.
- Batch offset all lines.

Each command must update dirty state and clear stale export results.

### Undo and Autosave Decision

M5 should make an explicit decision:

Option A: explicit save with undo stack.

- Easier to reason about.
- Matches current architecture.
- Requires clear unsaved state.

Option B: autosave after debounce.

- Feels modern.
- Requires conflict protection, task cancellation, and save status.

Recommended for M5: explicit save plus undo stack. Autosave can come after professional editing basics are stable.

### Testing

Required unit tests:

- Timing validation.
- Split line.
- Merge lines.
- Batch offset.
- Overlap detection.
- Shortcut gating inside text inputs.

Required React tests:

- Video preview renders with mocked media.
- Selecting a subtitle seeks preview.
- Editing timing marks document dirty.
- Drag simulation can be tested at helper level if DOM drag is too brittle.
- Save clears dirty state.

Required Worker tests:

- Waveform generation with a short test audio fixture or mocked FFmpeg output.
- Waveform endpoint returns stable schema.

Manual test:

1. Open a real project with subtitle lines.
2. Play video.
3. Select a subtitle line and confirm preview seeks.
4. Adjust timing.
5. Split a line.
6. Merge two lines.
7. Apply a batch offset.
8. Save.
9. Reopen project and confirm edits persist.

### Acceptance Criteria

M5 is complete when:

- Users can edit subtitles while seeing video context.
- Timing edits are practical and validated.
- Keyboard shortcuts cover the core editing loop.
- Waveform or timeline context is present for timing work.
- Saved edits persist and export remains protected from stale state.
- Full repository verification passes.

### Stage Gate

Do not start M6 until:

- The subtitle editor can handle real documents comfortably.
- Timing validation catches common mistakes.
- The app can save and reopen timeline edits reliably.

---

## M6: Export and Burn-In

### Goal

Complete the output workflow: users can export standard subtitle files and render a new video with burned-in subtitles.

M6 turns Diplomat from an editor into a tool that produces final deliverables.

### Non-Goals

M6 does not require cloud publishing, collaboration, team review, or full template marketplace behavior.

### Product Deliverables

- VTT export.
- ASS export.
- Styled subtitle templates.
- Burned-in video export through FFmpeg.
- Export presets.
- Export job progress.
- Output validation.
- Export diagnostics.
- Open output folder action.

### Export Formats

Keep existing SRT export.

Add VTT:

- `WEBVTT` header.
- timestamp format `HH:MM:SS.mmm`.
- source, target, bilingual modes.
- no ASS styling.

Add ASS:

- Script info section.
- Styles section.
- Events section.
- text escaping.
- alignment, margins, font, color, outline.
- bilingual layout support.

Add burned-in video:

- Generate ASS as intermediate subtitle script.
- Run FFmpeg with subtitle filter.
- Write output video under project exports.
- Track progress.
- Preserve source video by writing to a new output path.

### Style Model

M6 should formalize style templates:

- `styleId`
- font family.
- font size.
- primary color.
- secondary color.
- outline color.
- outline width.
- shadow.
- alignment.
- vertical margin.
- bilingual layout.

Store project-level default style and line-level overrides.

Style UI:

- Template selector.
- Font size.
- Position.
- Primary/secondary color.
- Outline width.
- Preview text over video frame.

Do not overbuild a full design system in M6. Implement enough style control for usable burned-in output.

### Worker Export API

Add endpoints:

- `POST /projects/{project_id}/exports/vtt`
- `POST /projects/{project_id}/exports/ass`
- `POST /projects/{project_id}/exports/video`
- `GET /exports/{export_task_id}`
- `POST /exports/{export_task_id}/cancel`

Export request fields:

- `mode`: `source`, `target`, `bilingual`
- `styleId`
- `outputName`
- `overwrite`: false by default
- video export preset.

Video preset fields:

- container.
- video codec.
- audio copy/transcode behavior.
- resolution policy.
- quality setting.

M6 should start with a small preset set:

- `source-quality-mp4`
- `fast-preview-mp4`

### FFmpeg Burn-In

Burn-in pipeline:

1. Validate project and subtitle document.
2. Generate ASS subtitle file.
3. Choose output path.
4. Run FFmpeg.
5. Parse progress.
6. Mark export task completed or failed.
7. Expose output path.

Safety rules:

- Never overwrite source video.
- Never write outside the project export directory unless the user explicitly chooses an output path through desktop UI.
- Escape paths correctly on Windows.
- Log FFmpeg command and stderr to diagnostics.
- Display actionable errors for missing FFmpeg, invalid fonts, invalid output path, or codec failure.

### Web Workbench Work

Update export panel:

- Format selector: SRT, VTT, ASS, Burned-in Video.
- Mode selector.
- Style preset selector for ASS/video.
- Export preset selector for video.
- Progress status.
- Cancel export.
- Open output folder.

Export state must be tied to saved subtitle state:

- Unsaved subtitle edits disable export.
- Changing style or format clears previous export result.
- Export result must show format, mode, and path.

### Desktop Work

Add desktop helpers:

- choose output folder if needed.
- open output folder.
- check FFmpeg path.

Do not make desktop required for SRT/VTT/ASS file export in browser-only development mode. Burned-in video can require Worker access to FFmpeg.

### Testing

Required Python tests:

- VTT timestamp formatting.
- VTT source/target/bilingual rendering.
- ASS escaping.
- ASS style rendering.
- ASS bilingual layout.
- video export path safety.
- FFmpeg command construction.
- FFmpeg missing error.
- export task progress parsing with mocked FFmpeg output.
- no overwrite of source video.

Required TypeScript tests:

- Shared export schemas for SRT/VTT/ASS/video.
- Web API export helpers.
- Export panel format switching.
- Dirty subtitle disables all export formats.
- Export progress UI.

Manual test:

1. Open a project with saved subtitles.
2. Export SRT.
3. Export VTT.
4. Export ASS with a visible style.
5. Run burned-in video export on a short video.
6. Open output folder.
7. Play output video and confirm subtitles are visible.

### Acceptance Criteria

M6 is complete when:

- Users can export SRT, VTT, ASS, and burned-in video.
- Video export writes a new playable video file.
- Output paths are safe.
- Export progress and failure states are visible.
- Export does not proceed with unsaved subtitle edits.
- Full repository verification passes.

### Stage Gate

M6 is complete when the final export workflow can produce actual deliverables from a real local video and saved subtitle document. After M6, future planning can move toward packaging, performance, model management, and product polish.

---

## Cross-Cutting Requirements

### Privacy

Diplomat should remain local-first. A feature that sends media, transcripts, or subtitles to a remote service must be explicit in UI and documentation.

### Licensing

The repository remains MIT licensed. Third-party model weights, translation models, FFmpeg binaries, and provider SDKs may have separate licenses. Do not commit model weights or proprietary binaries unless their licenses are explicitly compatible and documented.

### Diagnostics

Every long-running job should have:

- user-facing status.
- stable error code.
- short error message.
- diagnostic log path.
- command/provider context in logs.

### Testing Policy

CI and default verification must not require:

- model downloads.
- paid API keys.
- network translation services.
- GPU availability.
- long media fixtures.

Use deterministic fakes and short fixtures for default tests. Real-model tests should be opt-in integration tests.

### Documentation Policy

Every stage must update:

- a development document.
- README links if a new document is added.
- manual test steps.
- known limitations.

### Product UX Policy

Diplomat should behave like a professional editing tool:

- Dense but readable layouts.
- Clear disabled states.
- No marketing-style first screen.
- No decorative UI that competes with editing.
- Keyboard-friendly controls.
- Errors that tell the user what action to take next.

## Post-M6 Backlog

These are intentionally outside M2b-M6:

- Installer and release signing.
- Automatic updates.
- Plugin marketplace.
- Team collaboration.
- Cloud sync.
- Full glossary management.
- Advanced diarization workflow.
- Multi-track subtitle editing.
- Batch processing multiple videos.
- Accessibility caption quality scoring.

They should be planned after M6 based on what the real editing/export workflow reveals.

## Recommended Next Action

Start with M2b. It reduces friction and operational risk before real ASR makes every failure more expensive to debug.

Suggested next document:

`docs/superpowers/plans/YYYY-MM-DD-diplomat-m2b-usability-foundation.md`

Suggested M2b implementation order:

1. Project list and reopen endpoints.
2. SQLite migration support.
3. Shared project list schemas and web API helpers.
4. React project list/reopen UI.
5. Tauri file picker.
6. Worker lifecycle commands.
7. Error and diagnostics polish.
8. M2b documentation and full verification.
