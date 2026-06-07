# Diplomat M3 Real ASR MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake-ASR as the main workbench analysis path with a local background analysis job system that can run fake ASR deterministically or faster-whisper when the developer has configured a local model.

**Architecture:** The Worker owns long-running analysis work, task state, FFmpeg diagnostics, ASR provider creation, and subtitle document mutation. The Web app starts analysis jobs, polls task state, renders progress, and exposes cancel/retry controls. The existing synchronous `/projects/{project_id}/analyze` endpoint remains as a compatibility shortcut for deterministic tests and old callers.

**Tech Stack:** Python 3.12, FastAPI, SQLite, thread-based local job runner, optional `faster-whisper`, React, TypeScript, Zod, Vitest, pytest.

---

## Stage Scope

M3 includes:

- Task records with `queued`, `running`, `canceling`, `canceled`, `failed`, and `completed` states.
- `POST /projects/{project_id}/analysis-jobs`.
- `GET /tasks/{task_id}`.
- `POST /tasks/{task_id}/cancel`.
- `POST /tasks/{task_id}/retry`.
- Worker-side analysis job runner that updates progress and writes a diagnostic log.
- ASR model config for `fake` and `faster-whisper`.
- Fake ASR remains deterministic for tests and demos.
- Web model configuration panel, task progress, cancel, and retry UI.
- Documentation for local faster-whisper setup without committing model weights.

M3 does not include translation, speaker diarization, waveform/timeline editing, VTT/ASS, or burn-in export.

## File Structure

Worker files:

- Modify `worker/diplomat_worker/schemas/task.py`: M3 task response schema and request schema.
- Modify `worker/diplomat_worker/asr/base.py`: progress callback and cancellation-aware protocol.
- Modify `worker/diplomat_worker/asr/fake.py`: deterministic progress-aware fake transcriber.
- Modify `worker/diplomat_worker/asr/faster_whisper.py`: config-friendly faster-whisper adapter.
- Create `worker/diplomat_worker/asr/config.py`: ASR config model and provider factory.
- Modify `worker/diplomat_worker/media/audio.py`: allow configurable FFmpeg path.
- Modify `worker/diplomat_worker/pipeline/core.py`: progress/cancel hooks and configurable FFmpeg path.
- Modify `worker/diplomat_worker/storage/project_store.py`: schema v3 task table and task CRUD.
- Create `worker/diplomat_worker/tasks/analysis.py`: background analysis job manager.
- Modify `worker/diplomat_worker/api/runtime.py`: runtime config for ASR provider and FFmpeg paths.
- Modify `worker/diplomat_worker/api/schemas.py`: API request/response aliases.
- Modify `worker/diplomat_worker/api/app.py`: M3 endpoints.

Worker tests:

- Create `worker/tests/storage/test_task_store.py`.
- Create `worker/tests/tasks/test_analysis_jobs.py`.
- Modify `worker/tests/api/test_app.py`.
- Modify `worker/tests/asr/test_fake.py`.
- Add or modify media/pipeline tests for FFmpeg missing diagnostics.

Shared/Web files:

- Modify `packages/shared/src/task.ts`: M3 schemas.
- Modify `packages/shared/src/project.ts`: analysis job request/response schema exports if kept project-adjacent.
- Modify `packages/shared/tests/task.test.ts`.
- Modify `apps/web/src/api.ts`: job helper functions.
- Create `apps/web/src/components/AnalysisJobPanel.tsx`: model config, progress, cancel, retry.
- Modify `apps/web/src/App.tsx`: replace direct sync analyze with job workflow.
- Modify `apps/web/src/App.css`: compact professional job controls.
- Modify `apps/web/tests/api.test.ts`.
- Modify `apps/web/tests/App.test.tsx`.

Docs:

- Create `docs/development/m3-real-asr-mvp.md`.
- Modify `README.md`.
- Optionally update `docs/development/m2b-usability-foundation.md` with a short "M3 supersedes analysis path" note.

---

## Task 1: Worker Task Schema And SQLite Storage

**Files:**

- Modify `worker/diplomat_worker/schemas/task.py`
- Modify `worker/diplomat_worker/storage/project_store.py`
- Create `worker/tests/storage/test_task_store.py`
- Modify `worker/tests/schemas/test_task.py`

- [ ] **Step 1: Write failing task schema tests**

Add tests that validate M3 task records serialize with camelCase aliases and include task lifecycle fields:

```python
from diplomat_worker.schemas.task import TaskResponse

def test_task_response_serializes_m3_fields() -> None:
    task = TaskResponse(
        task_id="task-1",
        project_id="project-1",
        type="analysis",
        status="running",
        progress=0.4,
        message="Transcribing audio",
        started_at="2026-06-07T00:00:00+00:00",
        updated_at="2026-06-07T00:00:01+00:00",
        completed_at=None,
        error_code=None,
        error_message=None,
        diagnostic_log_path="D:/logs/task-1.log",
    )

    payload = task.model_dump(by_alias=True)

    assert payload["taskId"] == "task-1"
    assert payload["projectId"] == "project-1"
    assert payload["diagnosticLogPath"] == "D:/logs/task-1.log"
    assert payload["errorMessage"] is None
```

Run:

```powershell
python -m pytest worker/tests/schemas/test_task.py -q
```

Expected: FAIL because `TaskResponse` and `analysis` task type do not exist yet.

- [ ] **Step 2: Implement M3 task schemas**

`worker/diplomat_worker/schemas/task.py` should define:

```python
TaskStatus = Literal["queued", "running", "canceling", "canceled", "failed", "completed"]
TaskType = Literal["analysis", "export", "translation"]

class TaskResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    task_id: str = Field(alias="taskId", min_length=1)
    project_id: str = Field(alias="projectId", min_length=1)
    type: TaskType
    status: TaskStatus
    progress: float = Field(ge=0, le=1)
    message: str
    started_at: str | None = Field(default=None, alias="startedAt")
    updated_at: str = Field(alias="updatedAt")
    completed_at: str | None = Field(default=None, alias="completedAt")
    error_code: str | None = Field(default=None, alias="errorCode")
    error_message: str | None = Field(default=None, alias="errorMessage")
    diagnostic_log_path: str | None = Field(default=None, alias="diagnosticLogPath")
```

Keep `TaskEvent` as a compatibility alias or subclass if existing tests still depend on it.

- [ ] **Step 3: Write failing storage tests**

Create `worker/tests/storage/test_task_store.py`:

```python
from pathlib import Path

from diplomat_worker.storage.project_store import ProjectStore

def create_project(store: ProjectStore, tmp_path: Path) -> str:
    return store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=10_000,
        source_language="zh",
        target_language="en",
    ).project_id

def test_task_store_creates_and_updates_analysis_task(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project_id = create_project(store, tmp_path)

    task = store.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    assert task.status == "queued"
    assert task.progress == 0
    assert task.request_payload == {"provider": "fake"}

    updated = store.update_task(
        task.task_id,
        status="running",
        progress=0.25,
        message="Extracting audio",
        started=True,
    )

    assert updated.status == "running"
    assert updated.started_at is not None
    assert store.get_task(task.task_id).progress == 0.25

def test_task_table_is_created_for_existing_m2b_database(tmp_path: Path) -> None:
    database_path = tmp_path / "diplomat.db"
    store = ProjectStore(database_path)
    project_id = create_project(store, tmp_path)

    reopened = ProjectStore(database_path)
    task = reopened.create_task(
        project_id=project_id,
        task_type="analysis",
        message="Queued analysis",
        request_payload={"provider": "fake"},
    )

    assert reopened.get_task(task.task_id).project_id == project_id
```

Run:

```powershell
python -m pytest worker/tests/storage/test_task_store.py -q
```

Expected: FAIL because storage task methods do not exist.

- [ ] **Step 4: Implement task storage**

Update `SCHEMA_VERSION` to `3`, create a `TaskRecord` dataclass, and add a `tasks` table:

```sql
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    progress REAL NOT NULL,
    message TEXT NOT NULL,
    started_at TEXT,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    error_code TEXT,
    error_message TEXT,
    diagnostic_log_path TEXT,
    request_json TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(project_id)
)
```

Add methods:

```python
def create_task(self, project_id: str, task_type: str, message: str, request_payload: dict) -> TaskRecord: ...
def get_task(self, task_id: str) -> TaskRecord: ...
def update_task(..., status: str | None = None, progress: float | None = None, message: str | None = None, started: bool = False, completed: bool = False, error_code: str | None = None, error_message: str | None = None, diagnostic_log_path: str | None = None) -> TaskRecord: ...
```

Make `update_task` clamp no values; validation belongs in schemas/tests. Raise `KeyError` when missing.

- [ ] **Step 5: Run storage/schema tests and commit**

Run:

```powershell
python -m pytest worker/tests/schemas/test_task.py worker/tests/storage/test_task_store.py worker/tests/storage/test_project_store.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/schemas/task.py worker/diplomat_worker/storage/project_store.py worker/tests/schemas/test_task.py worker/tests/storage/test_task_store.py worker/tests/storage/test_project_store.py
git commit -m "feat(worker): add analysis task storage"
```

---

## Task 2: ASR Provider Config And Cancellable Analysis Runner

**Files:**

- Modify `worker/diplomat_worker/asr/base.py`
- Modify `worker/diplomat_worker/asr/fake.py`
- Modify `worker/diplomat_worker/asr/faster_whisper.py`
- Create `worker/diplomat_worker/asr/config.py`
- Modify `worker/diplomat_worker/media/audio.py`
- Modify `worker/diplomat_worker/pipeline/core.py`
- Create `worker/diplomat_worker/tasks/analysis.py`
- Create `worker/tests/tasks/test_analysis_jobs.py`
- Modify `worker/tests/asr/test_fake.py`
- Modify `worker/tests/pipeline/test_core.py`

- [ ] **Step 1: Write failing ASR config and fake progress tests**

Add tests:

```python
from pathlib import Path

from diplomat_worker.asr.config import AsrModelConfig, create_transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.audio import AudioChunk

def test_fake_transcriber_reports_progress(tmp_path: Path) -> None:
    progress = []
    transcriber = FakeTranscriber(language="en")

    result = transcriber.transcribe(
        audio_path=tmp_path / "audio.wav",
        chunks=[
            AudioChunk(index=0, start_ms=0, end_ms=1000),
            AudioChunk(index=1, start_ms=1000, end_ms=2000),
        ],
        progress_callback=lambda value, message: progress.append((value, message)),
    )

    assert result.language == "en"
    assert progress[-1][0] == 1

def test_asr_provider_factory_creates_fake_transcriber() -> None:
    transcriber = create_transcriber(
        AsrModelConfig(provider="fake", source_language="zh"),
        fallback_language="en",
    )

    assert isinstance(transcriber, FakeTranscriber)
    assert transcriber.language == "zh"
```

Run:

```powershell
python -m pytest worker/tests/asr/test_fake.py -q
```

Expected: FAIL because config and progress callback are not implemented.

- [ ] **Step 2: Implement cancellation-aware ASR protocol**

In `asr/base.py` define:

```python
ProgressCallback = Callable[[float, str], None]

class CancelToken(Protocol):
    def is_cancel_requested(self) -> bool: ...

class Transcriber(Protocol):
    def transcribe(
        self,
        audio_path: Path,
        chunks: list[AudioChunk],
        progress_callback: ProgressCallback | None = None,
        cancel_token: CancelToken | None = None,
    ) -> AsrResult: ...
```

In `FakeTranscriber`, check cancellation before each chunk and raise `AnalysisCanceled` from `tasks.analysis` or a local `AsrCanceled` exception if cancellation is requested. Report progress as `completed_chunks / total_chunks`.

- [ ] **Step 3: Implement ASR model config**

Create `asr/config.py`:

```python
from dataclasses import dataclass
from typing import Literal

@dataclass(frozen=True)
class AsrModelConfig:
    provider: Literal["fake", "faster-whisper"] = "fake"
    model_name_or_path: str | None = None
    device: str = "cpu"
    compute_type: str = "int8"
    source_language: str | None = None
    initial_prompt: str | None = None

def create_transcriber(config: AsrModelConfig, fallback_language: str):
    language = config.source_language or fallback_language
    if config.provider == "fake":
        return FakeTranscriber(language=language)
    if config.provider == "faster-whisper":
        return FasterWhisperTranscriber(
            model_name=config.model_name_or_path or "base",
            device=config.device,
            compute_type=config.compute_type,
            language=language,
            initial_prompt=config.initial_prompt,
        )
    raise ValueError(f"Unsupported ASR provider: {config.provider}")
```

- [ ] **Step 4: Write failing analysis job tests**

Create tests for completed, canceled-before-start, failed preflight, and retry:

```python
from pathlib import Path

from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.asr.config import AsrModelConfig
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import FfmpegCheck, VideoProbe
from diplomat_worker.storage.project_store import ProjectStore
from diplomat_worker.tasks.analysis import AnalysisJobManager

def make_runtime(tmp_path: Path, check: FfmpegCheck | None = None) -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
        probe_video_fn=lambda source: VideoProbe(10_000, True, "aac", "h264"),
        extract_audio_fn=lambda source, target: target.write_bytes(b"audio") or target,
        ffmpeg_check_fn=lambda source, ffmpeg, ffprobe: check or FfmpegCheck(True, None, "ok"),
    )

def create_project(runtime: WorkerRuntime, tmp_path: Path) -> str:
    return runtime.store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=10_000,
        source_language="zh",
        target_language="en",
    ).project_id

def test_analysis_job_completes_with_fake_asr(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    completed = runtime.store.get_task(task.task_id)
    assert completed.status == "completed"
    assert completed.progress == 1
    assert runtime.store.load_subtitle_document(project_id).lines

def test_cancel_queued_analysis_job(tmp_path: Path) -> None:
    runtime = make_runtime(tmp_path)
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    canceled = manager.cancel_task(task.task_id)

    assert canceled.status == "canceled"

def test_analysis_job_fails_with_missing_ffmpeg(tmp_path: Path) -> None:
    runtime = make_runtime(
        tmp_path,
        check=FfmpegCheck(False, "FFMPEG_NOT_FOUND", "FFmpeg executable not found: ffmpeg"),
    )
    project_id = create_project(runtime, tmp_path)
    manager = AnalysisJobManager(runtime, auto_start=False)

    task = manager.create_analysis_job(project_id, AsrModelConfig(provider="fake"))
    manager.run_pending_once()

    failed = runtime.store.get_task(task.task_id)
    assert failed.status == "failed"
    assert failed.error_code == "FFMPEG_NOT_FOUND"
    assert failed.diagnostic_log_path is not None
```

Run:

```powershell
python -m pytest worker/tests/tasks/test_analysis_jobs.py -q
```

Expected: FAIL because manager does not exist.

- [ ] **Step 5: Implement analysis job manager**

Create `worker/diplomat_worker/tasks/analysis.py` with:

```python
class AnalysisCanceled(RuntimeError):
    pass

class ThreadCancelToken:
    def request_cancel(self) -> None: ...
    def is_cancel_requested(self) -> bool: ...

class AnalysisJobManager:
    def __init__(self, runtime: WorkerRuntime, auto_start: bool = True, max_workers: int = 1) -> None: ...
    def create_analysis_job(self, project_id: str, config: AsrModelConfig) -> TaskRecord: ...
    def get_task(self, task_id: str) -> TaskRecord: ...
    def cancel_task(self, task_id: str) -> TaskRecord: ...
    def retry_task(self, task_id: str) -> TaskRecord: ...
    def run_pending_once(self) -> None: ...
```

Implementation rules:

- `create_analysis_job` stores request JSON and returns immediately.
- `auto_start=True` submits the job to a `ThreadPoolExecutor(max_workers=1)`.
- `auto_start=False` keeps jobs queued for deterministic tests.
- `_run_task` writes diagnostics to `<project_dir>/logs/task-<task_id>.log`.
- `_run_task` uses `runtime.ffmpeg_check_fn(source, runtime.ffmpeg_path, runtime.ffprobe_path)` before extraction.
- `_run_task` calls `run_core_pipeline(..., ffmpeg_path=runtime.ffmpeg_path, progress_callback=..., cancel_token=...)`.
- Cancellation before start changes `queued` to `canceled`.
- Cancellation while running changes status to `canceling`; the runner changes it to `canceled` at the next cancellation check.
- Failures set `status="failed"`, `error_code`, `error_message`, and `diagnostic_log_path`.
- Retry is allowed for `failed` and `canceled` tasks and creates a new queued analysis task with the same request payload.

- [ ] **Step 6: Run task tests and commit**

Run:

```powershell
python -m pytest worker/tests/asr/test_fake.py worker/tests/pipeline/test_core.py worker/tests/tasks/test_analysis_jobs.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/asr worker/diplomat_worker/media/audio.py worker/diplomat_worker/pipeline/core.py worker/diplomat_worker/tasks worker/tests/asr/test_fake.py worker/tests/pipeline/test_core.py worker/tests/tasks/test_analysis_jobs.py
git commit -m "feat(worker): add cancellable analysis jobs"
```

---

## Task 3: Worker API Endpoints

**Files:**

- Modify `worker/diplomat_worker/api/runtime.py`
- Modify `worker/diplomat_worker/api/schemas.py`
- Modify `worker/diplomat_worker/api/app.py`
- Modify `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing API endpoint tests**

Add route assertions:

```python
("POST", "/projects/{project_id}/analysis-jobs"),
("GET", "/tasks/{task_id}"),
("POST", "/tasks/{task_id}/cancel"),
("POST", "/tasks/{task_id}/retry"),
```

Add tests:

```python
def test_create_analysis_job_returns_accepted_task(app_module, tmp_path: Path) -> None:
    runtime = make_test_runtime(tmp_path)
    manager = app_module.AnalysisJobManager(runtime, auto_start=False)
    client = TestClient(app_module.create_app(runtime, analysis_jobs=manager))
    source_video = tmp_path / "source.mp4"
    source_video.write_bytes(b"fake-video")
    project_id = client.post("/projects", json={...}).json()["projectId"]

    response = client.post(
        f"/projects/{project_id}/analysis-jobs",
        json={"provider": "fake", "sourceLanguage": "zh"},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "queued"
```

Add cancel and retry tests using `auto_start=False`.

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: FAIL because routes do not exist.

- [ ] **Step 2: Implement API schemas**

In `api/schemas.py`:

```python
class AnalysisJobRequest(CamelModel):
    provider: Literal["fake", "faster-whisper"] = "fake"
    model_name_or_path: str | None = Field(default=None, alias="modelNameOrPath")
    device: str = "cpu"
    compute_type: str = Field(default="int8", alias="computeType")
    source_language: str | None = Field(default=None, alias="sourceLanguage")
    initial_prompt: str | None = Field(default=None, alias="initialPrompt")
```

Use `TaskResponse` from `diplomat_worker.schemas.task` as endpoint response model.

- [ ] **Step 3: Implement runtime fields**

`WorkerRuntime` should keep compatibility with current tests and add:

```python
ffmpeg_path: str = "ffmpeg"
ffprobe_path: str = "ffprobe"
ffmpeg_check_fn: FfmpegCheckFn = FfmpegCheck.for_source
transcriber_factory: TranscriberFactory = create_transcriber
```

The existing `transcriber` remains for `/analyze` compatibility.

- [ ] **Step 4: Implement M3 endpoints**

In `api/app.py`:

```python
@app.post("/projects/{project_id}/analysis-jobs", response_model=TaskResponse, status_code=202)
def create_analysis_job(project_id: str, request: AnalysisJobRequest) -> TaskResponse:
    ...

@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str) -> TaskResponse:
    ...

@app.post("/tasks/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(task_id: str) -> TaskResponse:
    ...

@app.post("/tasks/{task_id}/retry", response_model=TaskResponse, status_code=202)
def retry_task(task_id: str) -> TaskResponse:
    ...
```

Map missing projects/tasks to 404 and invalid retry state to 409.

- [ ] **Step 5: Run API tests and commit**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py -q
```

Expected: PASS.

Commit:

```powershell
git add worker/diplomat_worker/api worker/tests/api/test_app.py
git commit -m "feat(worker): expose analysis job api"
```

---

## Task 4: Shared Schemas And Web API Helpers

**Files:**

- Modify `packages/shared/src/task.ts`
- Modify `packages/shared/tests/task.test.ts`
- Modify `apps/web/src/api.ts`
- Modify `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

Update `packages/shared/tests/task.test.ts`:

```typescript
import { AnalysisJobRequestSchema, TaskResponseSchema } from "../src/task";

it("accepts an analysis job request", () => {
  expect(
    AnalysisJobRequestSchema.parse({
      provider: "faster-whisper",
      modelNameOrPath: "small",
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "zh",
      initialPrompt: ""
    })
  ).toMatchObject({ provider: "faster-whisper" });
});

it("accepts an M3 task response", () => {
  const task = TaskResponseSchema.parse({
    taskId: "task-1",
    projectId: "project-1",
    type: "analysis",
    status: "running",
    progress: 0.25,
    message: "Extracting audio",
    startedAt: "2026-06-07T00:00:00+00:00",
    updatedAt: "2026-06-07T00:00:01+00:00",
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    diagnosticLogPath: null
  });

  expect(task.status).toBe("running");
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/shared test
```

Expected: FAIL.

- [ ] **Step 2: Implement shared schemas**

`packages/shared/src/task.ts` should export:

```typescript
export const TaskStatusSchema = z.enum(["queued", "running", "canceling", "canceled", "failed", "completed"]);
export const TaskTypeSchema = z.enum(["analysis", "translation", "export"]);
export const AnalysisJobRequestSchema = z.object({
  provider: z.enum(["fake", "faster-whisper"]).default("fake"),
  modelNameOrPath: z.string().nullable().default(null),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  sourceLanguage: z.string().min(2).max(12).nullable().default(null),
  initialPrompt: z.string().nullable().default(null)
});
export const TaskResponseSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  type: TaskTypeSchema,
  status: TaskStatusSchema,
  progress: z.number().min(0).max(1),
  message: z.string(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().min(1),
  completedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  diagnosticLogPath: z.string().nullable()
});
```

- [ ] **Step 3: Write failing Web API helper tests**

In `apps/web/tests/api.test.ts` add:

```typescript
import { cancelTask, createAnalysisJob, fetchTask, retryTask } from "../src/api";

it("createAnalysisJob posts model config", async () => {
  const fetchMock = stubJsonResponse(taskResponse);

  await expect(
    createAnalysisJob("project-1", { provider: "fake", sourceLanguage: "zh" }, baseUrl)
  ).resolves.toEqual(taskResponse);

  expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/projects/project-1/analysis-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "fake",
      modelNameOrPath: null,
      device: "cpu",
      computeType: "int8",
      sourceLanguage: "zh",
      initialPrompt: null
    })
  });
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- api.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement Web API helpers**

Add:

```typescript
export async function createAnalysisJob(projectId: string, input: AnalysisJobRequest, baseUrl = DEFAULT_WORKER_BASE_URL): Promise<TaskResponse> { ... }
export async function fetchTask(taskId: string, baseUrl = DEFAULT_WORKER_BASE_URL): Promise<TaskResponse> { ... }
export async function cancelTask(taskId: string, baseUrl = DEFAULT_WORKER_BASE_URL): Promise<TaskResponse> { ... }
export async function retryTask(taskId: string, baseUrl = DEFAULT_WORKER_BASE_URL): Promise<TaskResponse> { ... }
```

- [ ] **Step 5: Run schema/API tests and commit**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test
corepack pnpm --filter @diplomat/web test -- api.test.ts
corepack pnpm --filter @diplomat/shared typecheck
corepack pnpm --filter @diplomat/web typecheck
```

Expected: PASS.

Commit:

```powershell
git add packages/shared/src/task.ts packages/shared/tests/task.test.ts apps/web/src/api.ts apps/web/tests/api.test.ts
git commit -m "feat(web): add analysis job client contracts"
```

---

## Task 5: Web Analysis Job UI And Polling

**Files:**

- Create `apps/web/src/components/AnalysisJobPanel.tsx`
- Modify `apps/web/src/App.tsx`
- Modify `apps/web/src/App.css`
- Modify `apps/web/tests/App.test.tsx`

- [ ] **Step 1: Write failing React tests**

Add tests for start/progress/completed, cancel, and retry:

```typescript
it("starts an analysis job and loads subtitles after completion", async () => {
  stubWorkbenchFetch({ analysisJob: "completed" });
  render(<App />);
  await createDemoProjectWithoutAnalyze();

  fireEvent.click(screen.getByRole("button", { name: "Start Analysis" }));

  expect(await screen.findByText("Analysis completed")).toBeInTheDocument();
  expect((await screen.findAllByText("原始字幕文本")).length).toBeGreaterThan(0);
});

it("cancels a running analysis job", async () => {
  stubWorkbenchFetch({ analysisJob: "running" });
  render(<App />);
  await createDemoProjectWithoutAnalyze();

  fireEvent.click(screen.getByRole("button", { name: "Start Analysis" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancel Analysis" }));

  expect(await screen.findByText("Analysis canceled")).toBeInTheDocument();
});

it("retries a failed analysis job", async () => {
  stubWorkbenchFetch({ analysisJob: "failedThenCompleted" });
  render(<App />);
  await createDemoProjectWithoutAnalyze();

  fireEvent.click(screen.getByRole("button", { name: "Start Analysis" }));
  expect(await screen.findByText(/FFmpeg executable not found/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry Analysis" }));

  expect(await screen.findByText("Analysis completed")).toBeInTheDocument();
});
```

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Create AnalysisJobPanel**

Component contract:

```typescript
type AnalysisJobPanelProps = {
  disabled: boolean;
  sourceLanguage: string;
  task: TaskResponse | null;
  config: AnalysisJobRequest;
  onConfigChange: (config: AnalysisJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};
```

Controls:

- Provider select: `fake`, `faster-whisper`.
- Model name/path input.
- Device select/input.
- Compute type input.
- Initial prompt input.
- Progress element with percent.
- `Start Analysis`, `Cancel Analysis`, `Retry Analysis`.
- Diagnostic path displayed only for failed tasks with a path.

- [ ] **Step 3: Update App polling flow**

`App.tsx` should:

- Replace `runProjectAnalysis` for the main Analyze button path.
- Keep the old helper unused or test-only.
- Store `analysisTask` and `analysisConfig`.
- Start a job with `createAnalysisJob`.
- Poll `fetchTask(taskId)` every 500 ms while status is `queued`, `running`, or `canceling`.
- On `completed`, fetch subtitle document, select first line, clear export result, clear dirty state, refresh project list, set message `Analysis completed`.
- On `failed`, set user-visible message from `errorMessage`.
- On `canceled`, set message `Analysis canceled`.
- Disable subtitle editing while analysis is active.

- [ ] **Step 4: Update CSS**

Add compact workbench styling:

```css
.analysis-job-panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  padding: 16px;
}

.analysis-controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
```

Do not create a marketing-style hero or nested cards.

- [ ] **Step 5: Run Web tests and commit**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
corepack pnpm --filter @diplomat/web typecheck
```

Expected: PASS.

Commit:

```powershell
git add apps/web/src/components/AnalysisJobPanel.tsx apps/web/src/App.tsx apps/web/src/App.css apps/web/tests/App.test.tsx
git commit -m "feat(web): add analysis job workflow"
```

---

## Task 6: Documentation, Verification, And Stage Gate

**Files:**

- Create `docs/development/m3-real-asr-mvp.md`
- Modify `README.md`
- Optional modify `docs/development/m2b-usability-foundation.md`

- [ ] **Step 1: Write M3 development document**

Document:

- Browser workbench command.
- Desktop development command.
- Fake-ASR workflow.
- Faster-whisper optional setup:

```powershell
python -m pip install -e .\worker[asr,dev]
```

- Model weights are not committed and may have separate licenses.
- Suggested local model values: `tiny`, `base`, `small`, or a local model directory.
- CPU-friendly default: provider `faster-whisper`, model `tiny`, device `cpu`, compute type `int8`.
- Manual M3 test steps.
- Known limitations: no translation, no diarization, cancel cannot interrupt all faster-whisper internals immediately, no model download UI.

- [ ] **Step 2: Update README link**

Add:

```markdown
- [M3 Real ASR MVP](docs/development/m3-real-asr-mvp.md)
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
.\scripts\check.ps1
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected:

- Desktop Rust tests pass.
- Shared tests pass.
- Web tests pass.
- TypeScript typechecks pass.
- Worker tests pass.
- Desktop Rust check passes.

- [ ] **Step 4: Manual browser verification**

From the M3 worktree, start Worker and Web:

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
corepack pnpm --filter @diplomat/web dev -- --host localhost --port 1420
```

Open `http://localhost:1420`.

Verify:

- `Worker: ok`.
- Project can be created.
- Analysis panel shows fake/faster-whisper provider controls.
- Starting fake analysis shows task progress and completes.
- Generated subtitles load into the M2a editor.

- [ ] **Step 5: Commit docs**

```powershell
git add README.md docs/development/m3-real-asr-mvp.md docs/development/m2b-usability-foundation.md
git commit -m "docs: add m3 real asr workflow guide"
```

- [ ] **Step 6: Stage gate review**

Review against M3 acceptance criteria:

- Real local transcription path exists through faster-whisper provider.
- Fake-ASR remains deterministic and test-covered.
- Analysis work is represented by task state.
- Progress is visible in the UI.
- Cancel and failure paths are test-covered.
- Retry exists for failed/canceled tasks.
- Model weights are outside the repository.
- Full verification passes.
- Worktree is clean.

Only merge to `master` after all checks pass and there are no blocking review findings.

