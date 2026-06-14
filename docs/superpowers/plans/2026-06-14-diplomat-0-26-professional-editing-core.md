# Diplomat 0.26 Professional Editing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first professional subtitle timing editor: Worker-served video media, waveform generation, shared playback state, active line highlighting, timeline blocks, drag/resize timing edits, and visible timing validation.

**Architecture:** Add a Worker waveform task and media endpoint, expose typed waveform contracts through `@diplomat/shared`, then integrate a React timeline editor into the existing Workbench draft flow. Timing edits stay in draft state until the existing Save action persists the subtitle document.

**Tech Stack:** Python 3.12/FastAPI/pytest, TypeScript/Zod/Vitest/React 19/Mantine, existing Worker task store and React Query patterns.

---

## File Structure

- Modify `packages/shared/src/task.ts`: add `waveform` to task type.
- Modify `packages/shared/src/project.ts`: export waveform schemas and types.
- Modify `packages/shared/src/index.ts`: re-export new waveform types.
- Modify `packages/shared/tests/task.test.ts`: task type coverage.
- Modify `packages/shared/tests/project.test.ts`: waveform schema coverage.
- Create `worker/diplomat_worker/media/waveform.py`: waveform peak model, FFmpeg extraction, aggregation, cache read/write.
- Create `worker/diplomat_worker/tasks/waveform.py`: waveform job manager using existing task records.
- Modify `worker/diplomat_worker/api/runtime.py`: add waveform generator factory.
- Modify `worker/diplomat_worker/api/schemas.py`: add waveform API response schemas.
- Modify `worker/diplomat_worker/api/app.py`: media endpoint, waveform endpoint, waveform job endpoint, task cancel/retry dispatch.
- Create `worker/tests/media/test_waveform.py`: waveform aggregation and cache tests.
- Create `worker/tests/tasks/test_waveform_jobs.py`: waveform task lifecycle tests.
- Modify `worker/tests/api/test_app.py`: media/waveform endpoint tests.
- Modify `apps/web/src/api.ts`: media URL helper, waveform fetch, waveform job mutation.
- Create `apps/web/src/queries/waveformQueries.ts`: React Query hooks for waveform data and waveform jobs.
- Create `apps/web/src/lib/timingValidation.ts`: pure timing validation helpers.
- Create `apps/web/src/lib/timingValidation.test.ts`: validation test coverage.
- Modify `apps/web/src/components/VideoPreviewPanel.tsx`: controlled media URL, current time callback, seek requests.
- Create `apps/web/src/components/VideoPreviewPanel.test.tsx`: video URL and seek tests.
- Modify `apps/web/src/components/SubtitleGrid.tsx`: active line and timing issue indicators.
- Modify `apps/web/src/components/SubtitleGrid.test.tsx`: active/issue coverage.
- Create `apps/web/src/components/TimelineEditor.tsx`: waveform, playhead, zoom, subtitle blocks, drag/resize.
- Create `apps/web/src/components/TimelineEditor.test.tsx`: render, seek, drag, resize tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: own playback state, waveform task state, active line calculation, timeline integration.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: integrated behavior coverage.
- Modify `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`: new editor copy.

---

### Task 1: Shared Waveform Contract

**Files:**
- Modify: `packages/shared/src/task.ts`
- Modify: `packages/shared/src/project.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/task.test.ts`
- Test: `packages/shared/tests/project.test.ts`

- [ ] **Step 1: Write failing shared tests**

Add tests that assert:

```ts
expect(TaskTypeSchema.parse("waveform")).toBe("waveform");
expect(
  WaveformResponseSchema.parse({
    projectId: "project-demo",
    durationMs: 12000,
    sampleRate: 8000,
    peakCount: 2,
    peaks: [
      { index: 0, startMs: 0, endMs: 500, min: -0.25, max: 0.8 },
      { index: 1, startMs: 500, endMs: 1000, min: -0.5, max: 0.4 }
    ]
  }).peakCount
).toBe(2);
expect(() =>
  WaveformResponseSchema.parse({
    projectId: "project-demo",
    durationMs: 1000,
    sampleRate: 8000,
    peakCount: 1,
    peaks: [{ index: 0, startMs: 0, endMs: 1000, min: -2, max: 0.5 }]
  })
).toThrow();
```

- [ ] **Step 2: Run shared tests and verify failure**

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fails because `waveform` and `WaveformResponseSchema` do not exist yet.

- [ ] **Step 3: Implement shared contract**

In `packages/shared/src/task.ts`, change:

```ts
export const TaskTypeSchema = z.enum(["analysis", "translation", "export"]);
```

to:

```ts
export const TaskTypeSchema = z.enum(["analysis", "translation", "waveform", "export"]);
```

In `packages/shared/src/project.ts`, add:

```ts
export const WaveformPeakSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  min: z.number().min(-1).max(1),
  max: z.number().min(-1).max(1)
}).refine((peak) => peak.endMs >= peak.startMs, {
  message: "waveform peak endMs must be greater than or equal to startMs"
});

export const WaveformResponseSchema = z.object({
  projectId: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  sampleRate: z.number().int().positive(),
  peakCount: z.number().int().nonnegative(),
  peaks: z.array(WaveformPeakSchema)
}).refine((payload) => payload.peakCount === payload.peaks.length, {
  message: "waveform peakCount must match peaks length"
});

export type WaveformPeak = z.infer<typeof WaveformPeakSchema>;
export type WaveformResponse = z.infer<typeof WaveformResponseSchema>;
```

In `packages/shared/src/index.ts`, ensure these exports are included by the existing export surface.

- [ ] **Step 4: Run shared tests and commit**

```powershell
corepack pnpm --dir packages/shared test
git add packages/shared/src/task.ts packages/shared/src/project.ts packages/shared/src/index.ts packages/shared/tests/task.test.ts packages/shared/tests/project.test.ts
git commit -m "feat(shared): add waveform contract"
```

---

### Task 2: Worker Waveform Generation

**Files:**
- Create: `worker/diplomat_worker/media/waveform.py`
- Test: `worker/tests/media/test_waveform.py`

- [ ] **Step 1: Write failing waveform tests**

Create tests for:

```python
def test_build_waveform_peaks_normalizes_deterministic_samples() -> None:
    peaks = build_waveform_peaks(
        samples=[-0.5, 0.25, 0.75, -1.0],
        duration_ms=400,
        peak_count=2,
        sample_rate=8000,
    )
    assert [peak.index for peak in peaks] == [0, 1]
    assert peaks[0].start_ms == 0
    assert peaks[0].end_ms == 200
    assert peaks[0].min == -0.5
    assert peaks[0].max == 0.25
    assert peaks[1].min == -1.0
    assert peaks[1].max == 0.75


def test_waveform_cache_round_trips(tmp_path: Path) -> None:
    data = WaveformData(
        project_id="project-demo",
        duration_ms=400,
        sample_rate=8000,
        peaks=build_waveform_peaks([-0.5, 0.25], 400, 1, 8000),
    )
    path = write_waveform_cache(tmp_path / "waveform.json", data)
    assert read_waveform_cache(path) == data
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
python -m pytest worker/tests/media/test_waveform.py -q
```

Expected: fails because `diplomat_worker.media.waveform` does not exist.

- [ ] **Step 3: Implement waveform module**

Create:

```python
@dataclass(frozen=True)
class WaveformPeak:
    index: int
    start_ms: int
    end_ms: int
    min: float
    max: float


@dataclass(frozen=True)
class WaveformData:
    project_id: str
    duration_ms: int
    sample_rate: int
    peaks: list[WaveformPeak]
```

Implement:

- `build_waveform_peaks(samples, duration_ms, peak_count, sample_rate)`.
- `extract_waveform_samples(source_video, ffmpeg_path, sample_rate)`.
- `generate_waveform_data(project_id, source_video, duration_ms, ffmpeg_path="ffmpeg", sample_rate=8000, peak_count=1024)`.
- `write_waveform_cache(path, data)`.
- `read_waveform_cache(path)`.

Use Python `array("f")` for raw `f32le` bytes. Clamp peak values to `[-1, 1]`, and use deterministic rounding to six decimals.

- [ ] **Step 4: Run tests and commit**

```powershell
python -m pytest worker/tests/media/test_waveform.py -q
git add worker/diplomat_worker/media/waveform.py worker/tests/media/test_waveform.py
git commit -m "feat(worker): generate waveform peaks"
```

---

### Task 3: Worker Waveform Task And API

**Files:**
- Create: `worker/diplomat_worker/tasks/waveform.py`
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/tasks/test_waveform_jobs.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing task tests**

Cover:

```python
def test_waveform_job_completes_and_writes_cache(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path, generator=lambda project: fixture_waveform(project.project_id))
    project_id = create_project(runtime, tmp_path)
    manager = WaveformJobManager(runtime, auto_start=False)
    task = manager.create_waveform_job(project_id)
    manager.run_pending_once()
    completed = runtime.store.get_task(task.task_id)
    assert completed.type == "waveform"
    assert completed.status == "completed"
    assert runtime.store.get_project(project_id).project_id == project_id
    assert (runtime.store.get_project(project_id).project_dir / "cache" / "waveform.json").exists()
```

Also cover queued cancel, retry, and FFmpeg preflight failure.

- [ ] **Step 2: Write failing API tests**

Add API assertions:

```python
media = client.get(f"/projects/{project_id}/media/source")
assert media.status_code == 200
assert media.content == b"video-bytes"

missing = client.get(f"/projects/{project_id}/waveform")
assert missing.status_code == 404

job = client.post(f"/projects/{project_id}/waveform-jobs")
assert job.status_code == 202
assert job.json()["type"] == "waveform"
```

- [ ] **Step 3: Run worker tests and verify failure**

```powershell
python -m pytest worker/tests/tasks/test_waveform_jobs.py worker/tests/api/test_app.py -q
```

Expected: fails because waveform manager and endpoints do not exist.

- [ ] **Step 4: Implement manager and endpoints**

Implementation requirements:

- `WaveformJobManager` mirrors `AnalysisJobManager` status behavior.
- Runtime gets `waveform_generator: Callable`.
- API factory creates one manager lazily next to analysis and translation managers.
- `GET /projects/{project_id}/media/source` uses `FileResponse`.
- `GET /projects/{project_id}/waveform` reads `project_dir/cache/waveform.json`.
- `POST /projects/{project_id}/waveform-jobs` creates a waveform task.
- `cancel_task` dispatches `waveform`.
- `retry_task` dispatches `waveform`.

- [ ] **Step 5: Run worker tests and commit**

```powershell
python -m pytest worker/tests/media/test_waveform.py worker/tests/tasks/test_waveform_jobs.py worker/tests/api/test_app.py -q
git add worker/diplomat_worker/tasks/waveform.py worker/diplomat_worker/api/runtime.py worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/tasks/test_waveform_jobs.py worker/tests/api/test_app.py
git commit -m "feat(worker): add waveform tasks and endpoints"
```

---

### Task 4: Web API, Queries, And Video Playback State

**Files:**
- Modify: `apps/web/src/api.ts`
- Create: `apps/web/src/queries/waveformQueries.ts`
- Modify: `apps/web/src/components/VideoPreviewPanel.tsx`
- Create: `apps/web/src/components/VideoPreviewPanel.test.tsx`
- Modify: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write failing web API and video tests**

Test:

```ts
expect(projectMediaUrl("project-demo", "http://worker")).toBe(
  "http://worker/projects/project-demo/media/source"
);
```

Test `fetchWaveform` parses a valid response and `createWaveformJob` posts to `/waveform-jobs`.

Test `VideoPreviewPanel`:

```tsx
render(<VideoPreviewPanel mediaUrl="http://worker/media" selectedLine={null} onTimeUpdate={vi.fn()} />);
expect(screen.getByLabelText("Video preview media")).toHaveAttribute("src", "http://worker/media");
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/components/VideoPreviewPanel.test.tsx
```

Expected: fails because API helpers and new props do not exist.

- [ ] **Step 3: Implement API helpers and video props**

Add:

- `projectMediaUrl(projectId, baseUrl)`.
- `fetchWaveform(projectId, baseUrl)`.
- `createWaveformJob(projectId, baseUrl)`.
- `useWaveformQuery(projectId)`.
- `useCreateWaveformJobMutation(projectId)`.

Update `VideoPreviewPanel` props to:

```ts
type VideoPreviewPanelProps = {
  mediaUrl: string | null;
  selectedLine: SubtitleLine | null;
  seekRequestMs?: number | null;
  onTimeUpdate?: (timeMs: number) => void;
};
```

The `<video>` element must have `aria-label={t("workbench.labels.videoPreviewMedia")}` and call `onTimeUpdate(Math.round(event.currentTarget.currentTime * 1000))`.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/components/VideoPreviewPanel.test.tsx
git add apps/web/src/api.ts apps/web/src/queries/waveformQueries.ts apps/web/src/components/VideoPreviewPanel.tsx apps/web/src/components/VideoPreviewPanel.test.tsx apps/web/tests/api.test.ts
git commit -m "feat(web): serve project media through worker"
```

---

### Task 5: Timing Validation And Grid Indicators

**Files:**
- Create: `apps/web/src/lib/timingValidation.ts`
- Create: `apps/web/src/lib/timingValidation.test.ts`
- Modify: `apps/web/src/components/SubtitleGrid.tsx`
- Modify: `apps/web/src/components/SubtitleGrid.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing validation tests**

Test:

```ts
const issues = validateSubtitleTiming([
  { ...lineA, id: "a", startMs: 1000, endMs: 1200, sourceText: "A very long line that cannot be read comfortably" },
  { ...lineB, id: "b", startMs: 1100, endMs: 1300 }
]);
expect(issues.byLineId.a.map((issue) => issue.code)).toContain("too_short");
expect(issues.byLineId.a.map((issue) => issue.code)).toContain("overlap_next");
expect(issues.byLineId.b.map((issue) => issue.code)).toContain("overlap_previous");
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/lib/timingValidation.test.ts src/components/SubtitleGrid.test.tsx
```

Expected: fails because validation and grid props do not exist.

- [ ] **Step 3: Implement validation and grid display**

`validateSubtitleTiming(lines, options)` returns:

```ts
type TimingIssueCode =
  | "negative_time"
  | "end_before_start"
  | "too_short"
  | "overlap_previous"
  | "overlap_next"
  | "overlong_text";

type TimingValidationResult = {
  issues: TimingIssue[];
  byLineId: Record<string, TimingIssue[]>;
};
```

Update `SubtitleGrid` props:

```ts
activeLineId?: string | null;
timingIssuesByLineId?: Record<string, TimingIssue[]>;
```

Rows show selected and active styling separately. Rows with issues show a warning badge using localized copy.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/lib/timingValidation.test.ts src/components/SubtitleGrid.test.tsx
git add apps/web/src/lib/timingValidation.ts apps/web/src/lib/timingValidation.test.ts apps/web/src/components/SubtitleGrid.tsx apps/web/src/components/SubtitleGrid.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): validate subtitle timing"
```

---

### Task 6: Timeline Editor

**Files:**
- Create: `apps/web/src/components/TimelineEditor.tsx`
- Create: `apps/web/src/components/TimelineEditor.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing timeline tests**

Cover:

```tsx
render(
  <TimelineEditor
    durationMs={5000}
    currentTimeMs={1000}
    lines={[lineA]}
    waveform={waveformFixture}
    selectedLineId="line-1"
    activeLineId="line-1"
    timingIssuesByLineId={{}}
    onSelectLine={onSelectLine}
    onSeek={onSeek}
    onChangeLine={onChangeLine}
  />
);
expect(screen.getByRole("region", { name: "Timeline editor" })).toBeVisible();
expect(screen.getByLabelText("Zoom timeline")).toBeInTheDocument();
```

Use pointer events to test:

- background click calls `onSeek`.
- block drag calls `onChangeLine` with moved start/end.
- left resize changes start only.
- right resize changes end only.

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/TimelineEditor.test.tsx
```

Expected: fails because `TimelineEditor` does not exist.

- [ ] **Step 3: Implement timeline editor**

Implementation requirements:

- Use a `section` with `aria-label={t("timelineEditor.region")}`.
- Use SVG for waveform peaks.
- Use absolute-positioned buttons for subtitle blocks.
- Use small edge handles with accessible labels:
  - `Resize start for {{id}}`
  - `Resize end for {{id}}`
- Use pointer capture when available.
- Compute time from pointer position with scroll offset.
- Snap to `50ms`.
- Clamp duration to `300ms` minimum.
- Keep fixed row/block heights to prevent layout shift.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/TimelineEditor.test.tsx
git add apps/web/src/components/TimelineEditor.tsx apps/web/src/components/TimelineEditor.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add timeline editor"
```

---

### Task 7: Workbench Integration

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`

- [ ] **Step 1: Write failing Workbench tests**

Cover:

- video `src` is `/projects/project-demo/media/source`.
- clicking a subtitle row selects the row and creates a seek request.
- playback time highlights active row.
- waveform job button posts to `/waveform-jobs`.
- timeline drag updates draft timing and enables Save.

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected: fails because Workbench does not yet wire the new behavior.

- [ ] **Step 3: Integrate Workbench state**

Add state:

```ts
const [currentTimeMs, setCurrentTimeMs] = useState(0);
const [seekRequestMs, setSeekRequestMs] = useState<number | null>(null);
```

Derived values:

- `mediaUrl = activeProjectId ? projectMediaUrl(activeProjectId) : null`.
- `activeLineId` from `subtitleLines.find(line => currentTimeMs >= line.startMs && currentTimeMs < line.endMs)`.
- `timingValidation = validateSubtitleTiming(subtitleLines)`.

Row selection:

- `handleSelectLine(lineId)` sets selected line and seek request to that line's start.

Timeline changes:

- call existing `updateLine`.

Waveform:

- query cached waveform.
- show generate button when missing.
- show task status through existing task surface where possible.

- [ ] **Step 4: Run focused web tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/VideoPreviewPanel.test.tsx src/lib/timingValidation.test.ts src/components/SubtitleGrid.test.tsx src/components/TimelineEditor.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx
git commit -m "feat(web): integrate professional editor timeline"
```

---

### Task 8: Stage Verification And Review

**Files:**
- Create: `docs/development/0-26-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/media/test_waveform.py worker/tests/tasks/test_waveform_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/timingValidation.test.ts src/components/TimelineEditor.test.tsx src/components/SubtitleGrid.test.tsx src/components/VideoPreviewPanel.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Manual smoke:

1. Start Worker on `127.0.0.1:8765` with isolated `DIPLOMAT_DATA_DIR`.
2. Start Web app on `127.0.0.1:1420`.
3. Seed a project with a source media file and subtitle document.
4. Open the project in the in-app Browser.
5. Confirm video uses Worker media URL.
6. Open/generate waveform.
7. Confirm timeline editor, waveform region, subtitle blocks, playhead, zoom control, and validation badges are visible.
8. Click a row and confirm a seek request updates the video current time when media allows it.
9. Drag or resize a block and confirm the grid timing changes and Save becomes enabled.
10. Confirm browser console error log count is 0.

- [ ] **Step 4: Write stage gate review**

Document:

- commits reviewed.
- focused verification results.
- full verification results.
- Browser smoke result.
- known limitations around browser media codec behavior and 0.27 undo/snapshot carry-forward.

- [ ] **Step 5: Commit stage gate**

```powershell
git add docs/development/0-26-stage-gate-review.md
git commit -m "docs: accept 0.26 stage gate"
```

---

## Self-Review

- Spec coverage: the plan covers Worker media, waveform task/API, video playback state, active line highlighting, timing validation, timeline rendering, drag/resize editing, tests, Browser smoke, and stage gate review.
- Completeness scan: no deferred implementation markers are present.
- Type consistency: `WaveformResponse`, `TaskTypeSchema`, `TimelineEditor`, `TimingIssue`, and Workbench state names are consistent across tasks.
