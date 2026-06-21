# Diplomat 0.41 Workbench Professionalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional video/subtitle workbench by removing redundant top UI, integrating the preview viewer, upgrading the timeline, and producing sentence-level final subtitle cues.

**Architecture:** The frontend keeps the existing React/Mantine workbench but consolidates persistent UI into preview, right inspector, and timeline zones. The worker adds a small subtitle cue segmentation module between merged ASR results and `SubtitleDocument` creation so internal processing chunks stop leaking into user-facing subtitle rows.

**Tech Stack:** React, Mantine, Vitest, TypeScript, Python, Pydantic, pytest.

---

## File Structure

- `docs/development/0-41-workbench-professionalization.md`: product and technical development spec.
- `apps/web/src/pages/WorkbenchPage.tsx`: remove redundant workbench band and conditionally render compact task/recovery state.
- `apps/web/src/pages/WorkbenchPage.test.tsx`: regression coverage for the removed band, preview placement, and inspector ownership of media/export controls.
- `apps/web/src/components/VideoPreviewPanel.tsx`: app-native preview viewer controls and timecode.
- `apps/web/src/components/TimelineEditor.tsx`: professional ruler, track header, playhead, readable subtitle clip labels.
- `apps/web/src/i18n/en.ts`: English labels for viewer and timeline controls.
- `apps/web/src/i18n/zh.ts`: Chinese labels for viewer and timeline controls.
- `worker/diplomat_worker/pipeline/subtitle_cues.py`: cue segmentation rules and ASR segment conversion.
- `worker/diplomat_worker/pipeline/core.py`: use cue segmentation when building subtitle documents.
- `worker/tests/pipeline/test_subtitle_cues.py`: focused cue segmentation tests.

## Task 1: Remove the Redundant Workbench Context Band

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`

- [ ] **Step 1: Write the failing test**

Add a test in `apps/web/src/pages/WorkbenchPage.test.tsx`:

```tsx
it("does not render the redundant project context band above the preview", async () => {
  stubActiveProjectFetch();
  renderWorkbench();

  expect(await screen.findByTestId("workbench-preview-inspector-grid")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Project context" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Project media" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/pages/WorkbenchPage.test.tsx -t "redundant project context band" --reporter=dot
```

Expected: FAIL because `Project context` still exists.

- [ ] **Step 3: Implement**

Remove the `projectContextTitle`, `projectContextSource`, and persistent project context `<Box component="section" aria-label={t("workbench.labels.projectContext")}>` row from `WorkbenchPage.tsx`. Change the workbench grid rows from:

```tsx
gridTemplateRows: recoveryPanelVisible
  ? "auto auto auto auto minmax(0, 1fr)"
  : "auto auto auto minmax(0, 1fr)",
```

to:

```tsx
gridTemplateRows: [
  "auto",
  taskStatusVisible ? "auto" : null,
  recoveryPanelVisible ? "auto" : null,
  "minmax(0, 1fr)"
].filter(Boolean).join(" "),
```

- [ ] **Step 4: Run test to verify it passes**

Run the same targeted Vitest command. Expected: PASS.

## Task 2: Integrated Preview Viewer

**Files:**
- Modify: `apps/web/src/components/VideoPreviewPanel.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write the failing test**

Add or update a workbench test:

```tsx
it("uses app-native preview controls instead of browser video chrome", async () => {
  stubActiveProjectFetch();
  renderWorkbench();

  const media = await screen.findByLabelText("Video preview media");
  expect(media).not.toHaveAttribute("controls");
  expect(screen.getByRole("button", { name: "Play preview" })).toBeVisible();
  expect(screen.getByRole("slider", { name: "Preview scrubber" })).toBeVisible();
  expect(screen.getByText(/00:00\.000 \/ 10:03\.927/)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/pages/WorkbenchPage.test.tsx -t "app-native preview controls" --reporter=dot
```

Expected: FAIL because the `<video>` still has native `controls` and no app-native transport controls.

- [ ] **Step 3: Implement**

Update `VideoPreviewPanel.tsx` to remove `controls`, track `durationMs`, `currentMs`, and `playing`, and render:

- a play/pause `ActionIcon`
- a range input labelled `Preview scrubber`
- a monospace timecode
- a fit button group

Keep `onTimeUpdate` emitting milliseconds and keep `seekRequestMs` support.

- [ ] **Step 4: Run test to verify it passes**

Run the targeted test. Expected: PASS.

## Task 3: Professional Timeline Surface

**Files:**
- Modify: `apps/web/src/components/TimelineEditor.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write the failing test**

Add a test:

```tsx
it("renders a professional timeline ruler, track header, and readable subtitle clips", async () => {
  stubActiveProjectFetch();
  renderWorkbench();

  expect(await screen.findByRole("region", { name: "Timeline editor" })).toBeVisible();
  expect(screen.getByTestId("timeline-ruler")).toBeVisible();
  expect(screen.getByText("Subtitles")).toBeVisible();
  expect(screen.getByTestId("timeline-playhead")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByTestId("timeline-block-line-1")).toHaveTextContent("First subtitle text");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/pages/WorkbenchPage.test.tsx -t "professional timeline" --reporter=dot
```

Expected: FAIL because the ruler and text labels are incomplete.

- [ ] **Step 3: Implement**

Update `TimelineEditor.tsx` to:

- render `data-testid="timeline-ruler"` with 6-10 time ticks based on duration.
- render a fixed-width track header column with localized `Subtitles`.
- render clip labels from `line.sourceText || line.id`.
- add playhead handle styling.
- keep existing drag/trim callbacks.

- [ ] **Step 4: Run test to verify it passes**

Run the targeted test. Expected: PASS.

## Task 4: Sentence-Level Subtitle Cue Segmentation

**Files:**
- Create: `worker/diplomat_worker/pipeline/subtitle_cues.py`
- Create: `worker/tests/pipeline/test_subtitle_cues.py`
- Modify: `worker/diplomat_worker/pipeline/core.py`

- [ ] **Step 1: Write the failing tests**

Create `worker/tests/pipeline/test_subtitle_cues.py`:

```python
from diplomat_worker.asr.base import AsrSegment, AsrWord
from diplomat_worker.pipeline.subtitle_cues import segment_asr_segments_to_cues


def test_splits_multisentence_asr_segment_into_sentence_cues() -> None:
    segment = AsrSegment(
        id="segment-1",
        start_ms=0,
        end_ms=6000,
        text="Hello world. This is the second sentence.",
        words=[
            AsrWord("Hello", 0, 700, 0.9),
            AsrWord("world.", 700, 1400, 0.9),
            AsrWord("This", 3000, 3400, 0.9),
            AsrWord("is", 3400, 3700, 0.9),
            AsrWord("the", 3700, 4000, 0.9),
            AsrWord("second", 4000, 4800, 0.9),
            AsrWord("sentence.", 4800, 5600, 0.9),
        ],
    )

    cues = segment_asr_segments_to_cues([segment])

    assert [cue.text for cue in cues] == ["Hello world.", "This is the second sentence."]
    assert [(cue.start_ms, cue.end_ms) for cue in cues] == [(0, 1400), (3000, 5600)]


def test_uses_proportional_timing_when_word_timing_is_missing() -> None:
    segment = AsrSegment(
        id="segment-1",
        start_ms=1000,
        end_ms=5000,
        text="第一句话。第二句话。",
        words=[],
    )

    cues = segment_asr_segments_to_cues([segment])

    assert [cue.text for cue in cues] == ["第一句话。", "第二句话。"]
    assert cues[0].start_ms == 1000
    assert cues[0].end_ms == 3000
    assert cues[1].start_ms == 3000
    assert cues[1].end_ms == 5000
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m pytest worker/tests/pipeline/test_subtitle_cues.py
```

Expected: FAIL because `subtitle_cues.py` does not exist.

- [ ] **Step 3: Implement**

Create `worker/diplomat_worker/pipeline/subtitle_cues.py` with a `SubtitleCue` dataclass and `segment_asr_segments_to_cues(segments)` function. Split on sentence punctuation, map words by character offsets where possible, and use proportional timing otherwise.

Modify `worker/diplomat_worker/pipeline/core.py` to call `segment_asr_segments_to_cues(asr_result.segments)` and build `SubtitleLine` from cues.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
python -m pytest worker/tests/pipeline/test_subtitle_cues.py
```

Expected: PASS.

## Task 5: Regression Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run targeted frontend tests**

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run src/pages/WorkbenchPage.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 2: Run full frontend tests**

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\vitest.CMD' run --reporter=dot
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

```powershell
& 'D:\Software Project\Diplomat\apps\web\node_modules\.bin\tsc.CMD' --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run worker subtitle tests**

```powershell
python -m pytest worker/tests/pipeline/test_subtitle_cues.py
python -m pytest worker/tests/api/test_app.py::test_project_analyze_and_subtitle_round_trip
```

Expected: PASS.

- [ ] **Step 5: Launch dev desktop**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev-desktop.ps1 --timeout-ms=120000
```

Expected: `http://127.0.0.1:8765/health` returns `{"name":"diplomat-worker","status":"ok"}` and a visible `diplomat.exe` starts from `D:\Software Project\Diplomat\.dev\cargo-target`.

## Self-Review

- Spec coverage: UX-006 maps to Task 1; UX-009 maps to Task 2; UX-007 maps to Task 3; UX-008 maps to Task 4.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: Frontend tests use existing labels plus labels introduced by Task 2/3. Worker tests use existing `AsrSegment` and `AsrWord` dataclasses.
