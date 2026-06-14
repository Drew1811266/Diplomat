# Diplomat 0.29 Burn-In Video Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add burned-in video export as a background Worker task with safe FFmpeg rendering, progress, cancel, retry, diagnostics, and Workbench controls.

**Architecture:** Reuse the existing task table and task polling API. Add a focused Worker burn-in engine for path safety, ASS intermediate generation, FFmpeg command construction, progress parsing, and output validation; expose it through an `export` task manager and wire the Web Export inspector to start and monitor the task.

**Tech Stack:** TypeScript/Zod/Vitest/React 19/Mantine/React Query, Python 3.12/FastAPI/Pydantic/pytest, FFmpeg/FFprobe, existing Worker project store, 0.28 ASS export engine, and desktop path-opening bridge.

---

## File Structure

- Modify `packages/shared/src/export.ts`: add `BurnInExportRequestSchema` and types.
- Modify `packages/shared/tests/export.test.ts`: shared contract tests for burn-in requests.
- Create `worker/diplomat_worker/export/burn_in.py`: path safety, ASS intermediate, FFmpeg command building, progress parsing, render execution, and output validation.
- Create `worker/tests/export/test_burn_in.py`: burn-in engine tests.
- Create `worker/diplomat_worker/tasks/export.py`: `BurnInExportJobManager`.
- Create `worker/tests/tasks/test_export.py`: task lifecycle tests.
- Modify `worker/diplomat_worker/api/schemas.py`: add `BurnInExportRequest`.
- Modify `worker/diplomat_worker/api/app.py`: wire export manager, route, cancel, and retry.
- Modify `worker/tests/api/test_app.py`: route and dispatch coverage.
- Modify `apps/web/src/api.ts`: add `createBurnInExportJob`.
- Modify `apps/web/tests/api.test.ts`: helper coverage.
- Modify `apps/web/src/queries/taskQueries.ts`: add `useCreateBurnInExportJobMutation` and allow export retry.
- Modify `apps/web/src/components/TaskStatusSurface.tsx`: ensure export copy remains readable through existing fields.
- Modify `apps/web/src/components/inspectors/ExportInspector.tsx`: add burn-in video action, export task status controls, and open exports folder action.
- Modify `apps/web/src/components/inspectors/ExportInspector.test.tsx`: component behavior tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: connect burn-in export mutation, latest export task, cancel, retry, and folder opening.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: Workbench integration tests.
- Modify `apps/web/e2e/fixtures.ts`: burn-in export task fixture routes.
- Modify `apps/web/e2e/workbench.spec.ts`: e2e coverage for starting burn-in export.
- Modify `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`: UI labels.
- Create `docs/development/0-29-stage-gate-review.md`: after verification.

---

### Task 1: Shared Burn-In Export Contract

**Files:**
- Modify: `packages/shared/src/export.ts`
- Test: `packages/shared/tests/export.test.ts`

- [ ] **Step 1: Write failing shared tests**

Add tests to `packages/shared/tests/export.test.ts`:

```ts
import { BurnInExportRequestSchema } from "../src";

it("parses burn-in export requests with defaults", () => {
  const request = BurnInExportRequestSchema.parse({});

  expect(request.mode).toBe("bilingual");
  expect(request.stylePresetId).toBeNull();
  expect(request.outputPath).toBeNull();
  expect(request.videoCodec).toBe("libx264");
  expect(request.crf).toBe(18);
  expect(request.preset).toBe("medium");
});

it("parses burn-in export requests with an inline style", () => {
  const request = BurnInExportRequestSchema.parse({
    mode: "target",
    stylePresetId: "preset-broadcast",
    outputPath: "D:/Diplomat/exports/custom.mp4",
    style,
    videoCodec: "libx264",
    crf: 20,
    preset: "fast"
  });

  expect(request.mode).toBe("target");
  expect(request.style?.fontFamily).toBe(style.fontFamily);
});
```

- [ ] **Step 2: Run shared tests and verify failure**

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fails because `BurnInExportRequestSchema` does not exist.

- [ ] **Step 3: Implement shared contract**

Add to `packages/shared/src/export.ts`:

```ts
export const BurnInExportRequestSchema = z.object({
  mode: SubtitleExportModeSchema.default("bilingual"),
  stylePresetId: z.string().min(1).nullable().default(null),
  style: SubtitleStyleSchema.nullable().default(null),
  outputPath: z.string().min(1).nullable().default(null),
  videoCodec: z.literal("libx264").default("libx264"),
  crf: z.number().int().min(0).max(51).default(18),
  preset: z.enum(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"]).default("medium")
});

export type BurnInExportRequestInput = z.input<typeof BurnInExportRequestSchema>;
export type BurnInExportRequest = z.infer<typeof BurnInExportRequestSchema>;
```

- [ ] **Step 4: Run shared tests and commit**

```powershell
corepack pnpm --dir packages/shared test
git add packages/shared/src/export.ts packages/shared/tests/export.test.ts
git commit -m "feat(shared): add burn-in export contract"
```

---

### Task 2: Worker Burn-In Engine

**Files:**
- Create: `worker/diplomat_worker/export/burn_in.py`
- Test: `worker/tests/export/test_burn_in.py`

- [ ] **Step 1: Write failing burn-in engine tests**

Create `worker/tests/export/test_burn_in.py`:

```python
from pathlib import Path

import pytest

from diplomat_worker.export.burn_in import (
    BurnInExportCanceled,
    BurnInExportSettings,
    build_burn_in_command,
    escape_subtitles_filter_path,
    parse_ffmpeg_progress_line,
    resolve_burn_in_output_path,
    validate_burn_in_output,
)


def test_resolve_burn_in_output_path_defaults_inside_exports(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"

    output = resolve_burn_in_output_path(project_dir, source, None, "bilingual", "task-1")

    assert output == project_dir / "exports" / "burn-in-bilingual-task-1.mp4"


def test_resolve_burn_in_output_path_rejects_source_overwrite(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"

    with pytest.raises(ValueError, match="source video"):
        resolve_burn_in_output_path(project_dir, source, source, "bilingual", "task-1")


def test_resolve_burn_in_output_path_rejects_external_path(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    source = tmp_path / "source.mp4"
    external = tmp_path / "outside.mp4"

    with pytest.raises(ValueError, match="exports directory"):
        resolve_burn_in_output_path(project_dir, source, external, "bilingual", "task-1")


def test_escape_subtitles_filter_path_handles_windows_path() -> None:
    escaped = escape_subtitles_filter_path(Path("D:/Diplomat Project/cache/burn'in.ass"))

    assert "D\\:" in escaped
    assert "\\'" in escaped
    assert "Diplomat Project" in escaped


def test_build_burn_in_command_uses_list_args_and_progress(tmp_path: Path) -> None:
    command = build_burn_in_command(
        ffmpeg_path="ffmpeg",
        source_video=tmp_path / "source.mp4",
        ass_path=tmp_path / "cache" / "burn-in.ass",
        output_path=tmp_path / "project" / "exports" / "out.mp4",
        settings=BurnInExportSettings(),
    )

    assert command[0] == "ffmpeg"
    assert "-progress" in command
    assert "pipe:1" in command
    assert command[-1].endswith("out.mp4")


def test_parse_ffmpeg_progress_line_bounds_output_time() -> None:
    assert parse_ffmpeg_progress_line("out_time_ms=500000", 1000) == 0.5
    assert parse_ffmpeg_progress_line("out_time_ms=1500000", 1000) == 1
    assert parse_ffmpeg_progress_line("progress=continue", 1000) is None


def test_validate_burn_in_output_rejects_empty_file(tmp_path: Path) -> None:
    output = tmp_path / "empty.mp4"
    output.parent.mkdir(parents=True)
    output.write_bytes(b"")

    with pytest.raises(ValueError, match="empty"):
        validate_burn_in_output(output)
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
python -m pytest worker/tests/export/test_burn_in.py -q
```

Expected: fails because `diplomat_worker.export.burn_in` does not exist.

- [ ] **Step 3: Implement burn-in engine**

Create `worker/diplomat_worker/export/burn_in.py` with:

```python
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from diplomat_worker.export.text_subtitles import SubtitleExportMode, subtitle_document_to_ass
from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleStyle
from diplomat_worker.tasks.analysis import ThreadCancelToken


class BurnInExportCanceled(RuntimeError):
    pass


@dataclass(frozen=True)
class BurnInExportSettings:
    video_codec: str = "libx264"
    crf: int = 18
    preset: str = "medium"


ProgressCallback = Callable[[float, str], None]
```

Implement:

- `resolve_burn_in_output_path(project_dir, source_video, requested_output_path, mode, task_id)`.
- `escape_subtitles_filter_path(path)`.
- `build_burn_in_command(ffmpeg_path, source_video, ass_path, output_path, settings)`.
- `parse_ffmpeg_progress_line(line, duration_ms)`.
- `write_burn_in_ass(document, ass_path, mode, style)`.
- `validate_burn_in_output(output_path)`.
- `run_burn_in_export(...)` using `subprocess.Popen`, `-progress pipe:1`, cancellation checks, and progress callbacks.

Path safety must use `Path.resolve()` and `Path.relative_to()`. FFmpeg commands must be list arguments, never a shell string.

- [ ] **Step 4: Run engine tests and commit**

```powershell
python -m pytest worker/tests/export/test_burn_in.py -q
git add worker/diplomat_worker/export/burn_in.py worker/tests/export/test_burn_in.py
git commit -m "feat(worker): add burn-in export engine"
```

---

### Task 3: Worker Export Task Manager

**Files:**
- Create: `worker/diplomat_worker/tasks/export.py`
- Test: `worker/tests/tasks/test_export.py`

- [ ] **Step 1: Write failing task tests**

Create `worker/tests/tasks/test_export.py`:

```python
from pathlib import Path

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.export.burn_in import BurnInExportSettings
from diplomat_worker.media.ffmpeg import FfmpegCheck
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.export import BurnInExportJobManager


def ok_check(source_video: Path, ffmpeg_path: str, ffprobe_path: str) -> FfmpegCheck:
    return FfmpegCheck(True, None, "ok")


def test_create_export_job_queues_export_task(tmp_path: Path) -> None:
    runtime, project_id = make_runtime_with_subtitles(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)

    task = manager.create_export_job(project_id, {"mode": "bilingual"})

    assert task.type == "export"
    assert task.status == "queued"
    assert task.request_payload["mode"] == "bilingual"


def test_cancel_queued_export_task_marks_canceled(tmp_path: Path) -> None:
    runtime, project_id = make_runtime_with_subtitles(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    task = manager.create_export_job(project_id, {"mode": "bilingual"})

    canceled = manager.cancel_task(task.task_id)

    assert canceled.status == "canceled"


def test_retry_export_task_creates_fresh_task_from_payload(tmp_path: Path) -> None:
    runtime, project_id = make_runtime_with_subtitles(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    task = manager.create_export_job(project_id, {"mode": "target"})
    manager.cancel_task(task.task_id)

    retry = manager.retry_task(task.task_id)

    assert retry.task_id != task.task_id
    assert retry.request_payload["mode"] == "target"


def test_run_pending_export_task_completes_with_fake_runner(tmp_path: Path) -> None:
    runtime, project_id = make_runtime_with_subtitles(tmp_path)

    def fake_runner(**kwargs):
        kwargs["output_path"].parent.mkdir(parents=True, exist_ok=True)
        kwargs["output_path"].write_bytes(b"video")
        kwargs["progress_callback"](0.5, "Rendering video")

    manager = BurnInExportJobManager(runtime, auto_start=False, runner=fake_runner)
    task = manager.create_export_job(project_id, {"mode": "bilingual"})

    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    assert completed.status == "completed"
    assert completed.progress == 1
```

Use existing subtitle test fixtures or define a small `make_runtime_with_subtitles` helper that creates a project, writes a fake source file, saves a one-line subtitle document, and returns `WorkerRuntime(store=store, transcriber=None, ffmpeg_check_fn=ok_check)`.

- [ ] **Step 2: Run tests and verify failure**

```powershell
python -m pytest worker/tests/tasks/test_export.py -q
```

Expected: fails because `BurnInExportJobManager` does not exist.

- [ ] **Step 3: Implement task manager**

Create `worker/diplomat_worker/tasks/export.py`:

- `BurnInExportJobManager.__init__(runtime, auto_start=True, max_workers=1, runner=run_burn_in_export)`.
- `create_export_job(project_id, request_payload)`.
- `get_task(task_id)`.
- `cancel_task(task_id)`.
- `retry_task(task_id)`.
- `run_pending_once()`.
- `_run_task(task_id)`.
- `_mark_canceled(task_id, diagnostic_path)`.

`_run_task` must:

- mark task running with diagnostic log path.
- run `runtime.ffmpeg_check_fn`.
- load project and stable subtitle document.
- resolve inline style, preset style, or document default.
- create `burn_in_export_preparation` snapshot.
- resolve output path.
- write ASS intermediate in cache.
- call the runner with a `ThreadCancelToken`.
- validate output through the runner or engine.
- mark completed with output path in the message.
- map known `ValueError` unsafe-path and validation failures into user-visible error codes.

- [ ] **Step 4: Run task tests and commit**

```powershell
python -m pytest worker/tests/export/test_burn_in.py worker/tests/tasks/test_export.py -q
git add worker/diplomat_worker/tasks/export.py worker/tests/tasks/test_export.py
git commit -m "feat(worker): add burn-in export task manager"
```

---

### Task 4: Worker API Route And Dispatch

**Files:**
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing API tests**

Add tests to `worker/tests/api/test_app.py`:

```python
def test_create_burn_in_export_job_returns_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, export_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)

    response = client.post(
        f"/projects/{project_id}/exports/video",
        json={"mode": "bilingual", "videoCodec": "libx264", "crf": 18, "preset": "medium"},
    )

    assert response.status_code == 202
    assert response.json()["type"] == "export"
    assert response.json()["status"] == "queued"


def test_cancel_and_retry_export_task_dispatch_to_export_manager(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = BurnInExportJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, export_jobs=manager))
    project_id = create_project_with_saved_subtitle(client, tmp_path)
    task = client.post(f"/projects/{project_id}/exports/video", json={"mode": "target"}).json()

    canceled = client.post(f"/tasks/{task['taskId']}/cancel")
    retry = client.post(f"/tasks/{task['taskId']}/retry")

    assert canceled.json()["status"] == "canceled"
    assert retry.status_code == 202
    assert retry.json()["taskId"] != task["taskId"]
```

- [ ] **Step 2: Run API tests and verify failure**

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: fails because `create_app` does not accept `export_jobs` and the route does not exist.

- [ ] **Step 3: Implement API route and task dispatch**

In `worker/diplomat_worker/api/schemas.py`, add:

```python
BurnInPreset = Literal["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow"]

class BurnInExportRequest(CamelModel):
    mode: ExportMode = "bilingual"
    style_preset_id: str | None = Field(default=None, alias="stylePresetId")
    style: SubtitleStyle | None = None
    output_path: Path | None = Field(default=None, alias="outputPath")
    video_codec: Literal["libx264"] = Field(default="libx264", alias="videoCodec")
    crf: int = Field(default=18, ge=0, le=51)
    preset: BurnInPreset = "medium"
```

In `worker/diplomat_worker/api/app.py`:

- import `BurnInExportRequest` and `BurnInExportJobManager`.
- add `export_jobs` parameter to `create_app`.
- store `app.state.export_jobs`.
- add `get_export_jobs()`.
- add route `POST /projects/{project_id}/exports/video` returning `TaskResponse` and status `202`.
- route request payload through `request.model_dump(by_alias=True)`.
- dispatch `task.type == "export"` in cancel and retry routes.

- [ ] **Step 4: Run API tests and commit**

```powershell
python -m pytest worker/tests/export/test_burn_in.py worker/tests/tasks/test_export.py worker/tests/api/test_app.py -q
git add worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose burn-in export task api"
```

---

### Task 5: Web API And Query Wiring

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`
- Modify: `apps/web/src/queries/taskQueries.ts`

- [ ] **Step 1: Write failing web API tests**

Add to `apps/web/tests/api.test.ts`:

```ts
it("createBurnInExportJob posts video export request and parses task response", async () => {
  const task = taskFixture({ type: "export", status: "queued", message: "Queued burn-in export" });
  fetchMock.mockResolvedValueOnce(jsonResponse(task));

  await expect(
    createBurnInExportJob("project-demo", { mode: "bilingual", style: styleFixture }, baseUrl)
  ).resolves.toEqual(task);

  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-demo/exports/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "bilingual",
      stylePresetId: null,
      style: styleFixture,
      outputPath: null,
      videoCodec: "libx264",
      crf: 18,
      preset: "medium"
    })
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts
```

Expected: fails because `createBurnInExportJob` does not exist.

- [ ] **Step 3: Implement web helper and query hook**

In `apps/web/src/api.ts`:

- import `BurnInExportRequestSchema`.
- import `BurnInExportRequestInput`.
- add `createBurnInExportJob(projectId, input, baseUrl)`.
- widen retry request typing to permit burn-in config or no config.

In `apps/web/src/queries/taskQueries.ts`:

- import `BurnInExportRequestInput`.
- import `createBurnInExportJob`.
- add `useCreateBurnInExportJobMutation(projectId)`.
- widen retry mutation config type to include `BurnInExportRequestInput`.

- [ ] **Step 4: Run tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts
corepack pnpm --dir apps/web typecheck
git add apps/web/src/api.ts apps/web/tests/api.test.ts apps/web/src/queries/taskQueries.ts
git commit -m "feat(web): add burn-in export api helper"
```

---

### Task 6: Export Inspector Burn-In Controls

**Files:**
- Modify: `apps/web/src/components/inspectors/ExportInspector.tsx`
- Modify: `apps/web/src/components/inspectors/ExportInspector.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing inspector tests**

Add to `apps/web/src/components/inspectors/ExportInspector.test.tsx`:

```tsx
it("starts burn-in export and exposes cancel and retry for export tasks", async () => {
  const user = userEvent.setup();
  const onBurnInExport = vi.fn();
  const onCancelTask = vi.fn();
  const onRetryTask = vi.fn();

  render(
    <ExportInspector
      {...baseProps}
      latestTask={{
        taskId: "task-export",
        projectId: "project-demo",
        type: "export",
        status: "running",
        progress: 0.42,
        message: "Rendering video",
        startedAt: null,
        updatedAt: "2026-06-14T00:00:00+00:00",
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        diagnosticLogPath: null
      }}
      canCancelTask
      canRetryTask={false}
      onBurnInExport={onBurnInExport}
      onCancelTask={onCancelTask}
      onRetryTask={onRetryTask}
    />
  );

  await user.click(screen.getByRole("button", { name: "Render video" }));
  await user.click(screen.getByRole("button", { name: "Cancel render" }));

  expect(onBurnInExport).toHaveBeenCalled();
  expect(onCancelTask).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run inspector tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/ExportInspector.test.tsx
```

Expected: fails because burn-in props and controls do not exist.

- [ ] **Step 3: Implement inspector controls**

Add props:

- `latestTask?: TaskResponse | null`.
- `canCancelTask?: boolean`.
- `canRetryTask?: boolean`.
- `exportsDir?: string | null`.
- `onBurnInExport?: () => void`.
- `onCancelTask?: () => void`.
- `onRetryTask?: () => void`.
- `onOpenExportsFolder?: () => void`.

UI requirements:

- Preserve text subtitle export button and result.
- Add a "Render video" button disabled by `busy || !canExport`.
- Show export task status when `latestTask?.type === "export"`.
- Show progress percent from `latestTask.progress`.
- Show cancel button for active export tasks.
- Show retry button for failed or canceled export tasks.
- Show open exports folder button when `exportsDir` and handler exist.

- [ ] **Step 4: Run inspector tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/ExportInspector.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/components/inspectors/ExportInspector.tsx apps/web/src/components/inspectors/ExportInspector.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add burn-in export controls"
```

---

### Task 7: Workbench Burn-In Integration And E2E Fixtures

**Files:**
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/e2e/fixtures.ts`
- Modify: `apps/web/e2e/workbench.spec.ts`

- [ ] **Step 1: Write failing Workbench tests**

Add to `apps/web/src/pages/WorkbenchPage.test.tsx`:

```tsx
it("starts burn-in video export with the active mode and style", async () => {
  const user = userEvent.setup();
  renderWorkbench();

  await openProject(user);
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.click(screen.getByRole("button", { name: "Render video" }));

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/projects\/project-demo\/exports\/video$/),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"mode":"bilingual"')
    })
  );
});

it("blocks burn-in video export when timing has blocking errors", async () => {
  const user = userEvent.setup();
  renderWorkbench({ document: documentWithOverlap });

  await openProject(user);
  await user.click(screen.getByRole("button", { name: "Export" }));

  expect(screen.getByRole("button", { name: "Render video" })).toBeDisabled();
});
```

- [ ] **Step 2: Run Workbench tests and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected: fails because Workbench does not call the burn-in export mutation.

- [ ] **Step 3: Implement Workbench integration**

Implementation requirements:

- Add `useCreateBurnInExportJobMutation(activeProjectId)`.
- Reuse current `exportMode`, `styleDraft`, and `activePresetId`.
- On burn-in start, send:

```ts
{
  mode: exportMode,
  stylePresetId: activePresetId,
  style: styleDraft,
  outputPath: null,
  videoCodec: "libx264",
  crf: 18,
  preset: "medium"
}
```

- Set latest task id from the response.
- Reuse existing `useTaskQuery` polling.
- Pass latest task, cancel, retry, and open exports folder handlers into `ExportInspector`.
- Invalidate projects when export task completes.
- Extend e2e fixtures to handle `/exports/video`, `/tasks/task-export`, `/tasks/task-export/cancel`, and `/tasks/task-export/retry`.

- [ ] **Step 4: Run focused web tests and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web e2e
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/e2e/fixtures.ts apps/web/e2e/workbench.spec.ts
git commit -m "feat(web): integrate burn-in video export"
```

---

### Task 8: Verification, Browser Smoke, Stage Gate, Merge, Push

**Files:**
- Create: `docs/development/0-29-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/export/test_burn_in.py worker/tests/tasks/test_export.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web e2e
```

- [ ] **Step 2: Run full verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Manual smoke:

1. Start Worker on `127.0.0.1:8765` with an isolated `.tmp/smoke-0.29/data` directory.
2. Start Web on `127.0.0.1:1420`.
3. Generate a short MP4 source using FFmpeg.
4. Seed a project with stable bilingual subtitles.
5. Open the project in the in-app Browser.
6. Open the Export inspector.
7. Start burned-in video export.
8. Confirm progress appears in the UI.
9. Confirm the task completes.
10. Confirm an MP4 appears under the project exports directory and has non-zero bytes.
11. Start a second export and cancel it.
12. Retry the canceled export.
13. Confirm browser console error log count is 0.

- [ ] **Step 4: Write stage gate review**

Create `docs/development/0-29-stage-gate-review.md` recording:

- stage version and branch.
- commits reviewed.
- focused verification output.
- full verification output.
- Browser smoke result.
- rendered output path and validation evidence.
- known limitations.
- acceptance decision.

- [ ] **Step 5: Commit stage gate, merge, and push**

```powershell
git add docs/development/0-29-stage-gate-review.md
git commit -m "docs: accept 0.29 stage gate"
git checkout main
git merge --no-ff codex/0.29-burn-in-video-export -m "merge: complete 0.29 burn-in video export"
git push origin main
```

---

## Self-Review

- Spec coverage: this plan covers request schema, FFmpeg command construction, safe paths, ASS intermediate generation, task state, progress, cancel, retry, diagnostics, output validation, open exports folder, and failure messages.
- Placeholder scan: each task has concrete files, tests, commands, and implementation requirements. No deferred feature is listed as a stage deliverable.
- Type consistency: shared `BurnInExportRequest`, Worker `BurnInExportRequest`, API helper input, and task retry payload use the same field names: `mode`, `stylePresetId`, `style`, `outputPath`, `videoCodec`, `crf`, and `preset`.
