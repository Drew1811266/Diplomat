# Diplomat 0.41 Workbench Professionalization

## Goal

Make the active project workbench feel like a mature desktop video/subtitle productivity tool instead of a collection of web panels. This stage implements the four user-observed P0 issues from `docs/development/ux-observation-log.md`: remove the redundant context/status band, upgrade the timeline, fix subtitle cue granularity, and integrate the video preview as an app-native editing viewer.

## Product Principles

- Keep Diplomat primarily light and white, with dark surfaces only where video editing conventions require contrast: preview canvas and timeline tracks.
- Preserve the three-zone workbench model: preview viewer, right-side inspector tabs, bottom timeline.
- Treat media chunks and ASR chunks as internal processing details. The user-facing subtitle unit is a readable timed cue.
- Make video, timeline, subtitle list, and inspector feel synchronized. Selecting or seeking in one surface must make the others understandable.
- Avoid duplicating the same project/media/export information in multiple persistent bands.

## Scope

### 1. Remove Redundant Workbench Context Band

The large horizontal band above the preview currently repeats project name, source video path, workspace, subtitle count, saved state, task status, draft recovery, snapshots, and export affordances. After the right inspector tabs were introduced, this band became redundant.

Changes:

- Remove the project context row from the main workbench grid.
- Keep `TopToolbar` as the compact app-native command row.
- Keep task progress only when a task is active, failed, cancellable, or retryable.
- Keep recovery controls only when a draft or snapshot state needs user action.
- Ensure the preview starts much closer to the header.

Acceptance:

- No large persistent project metadata band appears between toolbar and preview.
- Active media remains visible in the Media tab.
- Export actions remain visible in the Export tab.
- Saved/unsaved state remains available in compact shell/status affordances.

### 2. Professional Timeline Upgrade

The current timeline has basic clip blocks and dragging, but it still reads as a simplified placeholder. The timeline should use Jianying/CapCut as the first benchmark and adopt professional editing conventions.

Changes:

- Add a ruler row with time ticks across the scrollable track.
- Add a track header column so users know what the lane represents.
- Add a playhead with a visible handle and timecode affordance.
- Show subtitle clips using source text labels, not only line IDs.
- Show clip duration and issue markers with polished hover/selected states.
- Keep zoom and horizontal scrolling.
- Keep click-to-seek, select-to-open subtitle, move, and trim behaviors.
- Use a dark timeline surface that contrasts with the light app frame.

Acceptance:

- The timeline includes ruler, track header, playhead, subtitle clips, zoom, scroll, and issue markers.
- Selected clip and active playback clip are visually distinct.
- Timeline click/scrub updates preview time.
- Timeline clip selection updates the subtitle inspector/list state.

### 3. Sentence-Level Final Subtitle Cues

The ASR pipeline currently maps merged ASR segments directly to `SubtitleLine`. That leaks internal processing chunk/segment boundaries into the final subtitle document. Processing chunks are for model pressure reduction; final subtitles should be sentence/readability cues.

Changes:

- Add a cue segmentation stage after merged ASR results and before `SubtitleDocument` creation.
- Split long ASR segments by sentence punctuation first.
- Use word timings when available to assign cue timing.
- Fall back to proportional timing when word timings are unavailable.
- Keep cue durations valid and avoid zero-length lines.
- Preserve ASR origin and word timing metadata per cue.

Initial segmentation rules:

- Split on English and Chinese sentence punctuation: `.`, `?`, `!`, `。`, `？`, `！`, and equivalent closing quotes when present.
- For text without punctuation, split by readable length thresholds.
- Minimum cue duration: 500 ms where the source segment has enough time.
- Keep one line when the segment is already short and sentence-like.

Acceptance:

- One ASR segment containing multiple sentences becomes multiple `SubtitleLine` rows.
- Each generated cue has its own `startMs` and `endMs`.
- Cue text is shorter and readable.
- Exported SRT/VTT uses final cue boundaries.

### 4. Integrated Editing Viewer

The current preview exposes native browser video controls, making it feel like an external player. It should become a Diplomat-native viewer similar to a professional editing Program Monitor.

Changes:

- Remove visible native browser controls from the main UI.
- Add app-native transport controls: play/pause, timecode, fit mode, and native seek slider.
- Keep subtitle overlay and safe-area overlay integrated in the viewer.
- Keep video time updates synchronized with the workbench state.
- Keep the underlying `<video>` element accessible through an explicit aria label.

Acceptance:

- Preview frame has app-native controls and no default browser control chrome.
- Timecode shows current time and duration.
- Play/pause and seek update the same `currentTimeMs` state used by the timeline.
- Viewer styling matches the workbench instead of appearing embedded from outside.

## Files

Frontend:

- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/pages/WorkbenchPage.test.tsx`
- `apps/web/src/components/VideoPreviewPanel.tsx`
- `apps/web/src/components/TimelineEditor.tsx`
- `apps/web/src/components/TimelineStrip.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh.ts`

Worker:

- `worker/diplomat_worker/pipeline/core.py`
- `worker/diplomat_worker/pipeline/subtitle_cues.py`
- `worker/tests/pipeline/test_subtitle_cues.py`
- `worker/tests/pipeline/test_core.py` if existing coverage needs pipeline-level assertions

Docs:

- `docs/development/0-41-workbench-professionalization.md`
- `docs/superpowers/plans/2026-06-21-diplomat-0-41-workbench-professionalization.md`

## Verification

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/pages/WorkbenchPage.test.tsx --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/components --reporter=dot
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\tsc.CMD' --noEmit
python -m pytest worker/tests/pipeline/test_subtitle_cues.py
python -m pytest worker/tests/api/test_app.py::test_project_analyze_and_subtitle_round_trip
```

Then start the dev desktop app with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-desktop.ps1 --timeout-ms=120000
```

## Stage Exit Criteria

- All new and affected tests pass.
- Desktop dev app starts from `D:\Software Project\Diplomat`.
- In a sample project, the preview begins near the top of the workbench, uses native Diplomat controls, and the timeline looks like a real editing surface.
- A multi-sentence ASR segment produces multiple final subtitle rows.
