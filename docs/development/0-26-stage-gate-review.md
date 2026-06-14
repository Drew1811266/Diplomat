# Diplomat 0.26 Stage Gate Review

Review date: 2026-06-14

Branch: `codex/0.26-professional-editing-core`

## Scope Accepted

0.26 establishes the first professional subtitle timing editor inside the Workbench:

- Shared contracts now include the `waveform` task type and typed waveform response payloads.
- Worker can serve project source media through a project-scoped media endpoint.
- Worker can generate waveform peaks from source media, cache them under the project cache directory, expose cached waveform data, and run waveform generation as a first-class task.
- Waveform tasks support queued, running, completed, failed, canceled, canceling, and retry paths through the existing task lifecycle.
- Web API helpers and React Query hooks now fetch Worker media URLs, cached waveform data, and waveform task creation.
- Video preview is controlled by the Workbench and reports playback time back to the editor.
- Subtitle grid supports row seek selection, active playback-line highlighting, and timing issue indicators.
- Timing validation flags negative timing, invalid ranges, too-short lines, overlapping neighbors, and likely overlong text.
- Timeline editor renders waveform peaks, subtitle blocks, selected/active states, playhead, zoom controls, and drag/resize timing edits.
- Workbench integrates media playback state, waveform cache/task state, draft timeline edits, timing validation, and explicit Save persistence.
- Browser smoke identified a 720p layout issue where the subtitle grid body could collapse below usable height; the Workbench layout was adjusted and covered by a regression test.

## Commits

- `748901c docs: plan 0.26 professional editing core`
- `c7ce217 feat(shared): add waveform contract`
- `ee4fc59 feat(worker): generate waveform peaks`
- `5b68bdc feat(worker): add waveform tasks and endpoints`
- `a723593 feat(web): serve project media through worker`
- `2740d00 feat(web): validate subtitle timing`
- `f8164f2 feat(web): add timeline editor`
- `fae63f8 feat(web): integrate professional editor timeline`
- `0fbf0b9 fix(web): keep subtitle grid usable with timeline`

## Verification

Focused verification passed:

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/media/test_waveform.py worker/tests/tasks/test_waveform_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/timingValidation.test.ts src/components/TimelineEditor.test.tsx src/components/SubtitleGrid.test.tsx src/components/VideoPreviewPanel.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Results:

- Shared: 5 files, 35 tests passed.
- Worker focused pytest set: passed with quiet output.
- Web focused: 6 files, 65 tests passed.
- Web typecheck: passed.

Full repository verification passed:

```powershell
.\scripts\check.ps1
```

Results:

- Desktop Rust tests: 13 passed.
- Shared tests: 5 files, 35 tests passed.
- Web tests: 23 files, 127 tests passed.
- Shared/Web/Desktop typechecks: passed.
- Worker tests: 175 passed.

Non-blocking command output:

- `pnpm` reported ignored `esbuild` build scripts, matching prior environment behavior.
- Node reported a `url.parse()` deprecation warning during checks; no test failed.
- `pip` reported an available upgrade notice; no test failed.

## Browser Smoke

Manual Browser smoke passed.

Environment:

- Worker: `http://127.0.0.1:8765`
- Web: `http://127.0.0.1:1420`
- Temporary project id: `project-c335afa7fd694ff4b19b2f7dc72a94e7`
- Temporary data directory: `.dev/smoke-0.26`

Steps and observations:

1. Started Worker with an isolated `DIPLOMAT_DATA_DIR`.
2. Started Web with `VITE_DIPLOMAT_WORKER_BASE_URL=http://127.0.0.1:8765`.
3. Seeded a project with source media metadata, subtitle document, and a cached waveform response.
4. Opened the app in the in-app Browser.
5. Opened the seeded project from Project Center.
6. Confirmed the video `src` points to `http://127.0.0.1:8765/projects/project-c335afa7fd694ff4b19b2f7dc72a94e7/media/source`.
7. Confirmed Timeline editor, waveform SVG, subtitle block, playhead, and zoom control are visible.
8. Clicked a subtitle row and confirmed selected/active row state updates and the video seek target becomes `1s`.
9. Dragged the first timeline block and confirmed the grid timing changed from `00:01.000` / `00:02.200` to `00:01.150` / `00:02.350`.
10. Confirmed Save became enabled after the timeline edit.
11. Clicked Save and confirmed Save returned to disabled state.
12. Confirmed browser console error log count was 0.
13. Stopped Worker and Web smoke processes.
14. Confirmed ports `8765` and `1420` had no remaining listening process after cleanup.

Browser smoke note:

- `ffmpeg` and `ffprobe` were not available on PATH in this workspace, so the Browser smoke used a pre-seeded waveform cache.
- Worker automated tests cover waveform aggregation, cache read/write, task creation/completion/failure/cancel/retry, and API task endpoints.
- A real waveform generation smoke should be repeated on a machine with `ffmpeg` and `ffprobe` available through the formal runtime path.

## Review Findings

### Specification Compliance

- Passed for Worker media serving: the Workbench now uses the Worker media endpoint instead of raw project source paths.
- Passed for waveform task lifecycle: generation, cache access, failure diagnostics, cancel, and retry paths are covered.
- Passed for draft timing edits: timeline drag/resize updates draft state and uses the existing explicit Save action for persistence.
- Passed for playback-linked editing: row selection, timeline selection, video seek requests, active line highlighting, and playhead rendering are integrated.
- Passed for validation visibility: timing issues are visible before save/export.
- Partial for real media acceptance: Browser smoke validated the interaction path with a placeholder source file and cached waveform, but real codec playback and end-to-end FFmpeg extraction require a machine with the media toolchain installed.

### Code Quality

- Waveform domain logic is isolated in `worker/diplomat_worker/media/waveform.py`.
- Waveform task lifecycle is isolated in `worker/diplomat_worker/tasks/waveform.py` and follows the existing Worker task model.
- Frontend timing validation is pure and independently tested.
- Timeline editing is encapsulated in `TimelineEditor` and integrated through Workbench draft state.
- The layout regression found during Browser smoke is covered by a Workbench test that checks media/timeline/grid proportions remain usable.

### Product Workflow

- Users can now open a project, load media through the Worker, inspect subtitle timing against waveform peaks, seek by row or timeline, and adjust timing directly in the editor.
- Timing problems are visible while editing rather than being discovered only during export or later review.
- Save remains explicit, preserving the existing project editing mental model.
- 0.26 is a meaningful production editing foundation, but it still needs the 0.27 workflow safety layer before daily heavy editing is considered complete.

### Privacy And Packaging

- No media files or model weights were committed.
- No tests download external media or models.
- Project media is served from the local Worker against the stored project source path.
- Waveform cache data is derived locally and stored in the project cache directory.

## Remaining Limitations

- `ffmpeg` and `ffprobe` were not available in this workspace, so real media waveform extraction was not manually smoke-tested outside automated injected-generator coverage.
- Browser smoke used a placeholder media file; it verified Worker media URL wiring and seek state but did not prove playback quality for a real codec/container.
- Timeline edits do not yet have undo/redo, recovery snapshots, split/merge, batch offsets, or autosave protection; these are 0.27 scope.
- 0.28 still needs export validation gates so invalid subtitle timing cannot silently pass into release exports.
- Final 0.30 release acceptance must include an end-to-end real project run with local ASR, local translation, timeline editing, export, and packaged desktop runtime checks.

## Decision

0.26 is accepted for merge into `main` with two explicit carry-forward items:

- Before 0.27 is accepted, Diplomat needs undo/redo, recovery snapshots, and safer editing workflow controls around timeline changes.
- Before 0.30 is accepted, Diplomat must pass a real-media waveform and playback smoke on a machine where the formal media runtime includes `ffmpeg` and `ffprobe`.
