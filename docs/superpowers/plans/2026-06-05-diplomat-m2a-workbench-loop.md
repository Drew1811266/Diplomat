# Diplomat M2a Workbench Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable project-to-subtitle workbench loop: create a local project, run the existing fake-ASR pipeline through Worker API endpoints, review/edit subtitle lines in React, save edits, and export SRT.

**Architecture:** Keep the Python Worker as the source of truth for project state and subtitle persistence. The React workbench talks to the Worker over local HTTP and uses shared TypeScript schemas to validate request/response payloads. M2a remains synchronous and fake-ASR based so the full editing/export loop is reliable before adding real long-running jobs, translation, waveform, and burn-in.

**Tech Stack:** FastAPI, Pydantic, SQLite, existing fake ASR/core pipeline, React 19, Vite, Vitest, Testing Library, Zod shared schemas, PowerShell verification.

---

## Scope

M2a implements a usable development slice:

- Create a project from a local video path.
- Probe/store media metadata needed by the current pipeline.
- Run the current core pipeline with fake ASR through Worker API.
- Load, edit, and save the internal subtitle document.
- Export SRT in source, target, or bilingual mode.
- Show a dense React workbench with project setup, subtitle list, line editor, and export status.

M2a explicitly does not implement:

- Real faster-whisper model management.
- Translation generation.
- Speaker diarization.
- Waveform rendering.
- Timeline drag editing.
- Tauri file picker integration.
- VTT/ASS export.
- Burned-in video export.
- Background task queue or checkpoint resume UI.

## File Structure

- `worker/diplomat_worker/storage/project_store.py`
  - Store project media metadata required by the workbench and pipeline.
- `worker/diplomat_worker/export/srt.py`
  - Convert `SubtitleDocument` into SRT text and write export files.
- `worker/diplomat_worker/export/__init__.py`
  - Export SRT helpers.
- `worker/diplomat_worker/api/runtime.py`
  - Hold injectable Worker runtime dependencies for tests and app startup.
- `worker/diplomat_worker/api/schemas.py`
  - Pydantic request/response models for M2a API endpoints.
- `worker/diplomat_worker/api/app.py`
  - Add M2a project, analyze, subtitle, and export routes.
- `worker/tests/storage/test_project_store.py`
  - Expand storage tests for M2a metadata.
- `worker/tests/export/test_srt.py`
  - Test SRT formatting and export modes.
- `worker/tests/api/test_app.py`
  - Test project/analyze/subtitle/export endpoints and route surface.
- `packages/shared/src/project.ts`
  - Zod schemas and types for project metadata and M2a API payloads.
- `packages/shared/src/export.ts`
  - Zod schemas and types for SRT export options/results.
- `packages/shared/src/index.ts`
  - Export new shared modules.
- `packages/shared/tests/project.test.ts`
  - Validate project/API schemas.
- `packages/shared/tests/export.test.ts`
  - Validate export schemas.
- `apps/web/src/api.ts`
  - Expand Worker API client functions with runtime validation.
- `apps/web/src/App.tsx`
  - Orchestrate the M2a workbench state.
- `apps/web/src/App.css`
  - Workbench layout and professional editing density.
- `apps/web/src/components/ProjectImportPanel.tsx`
  - Project setup and analyze controls.
- `apps/web/src/components/SubtitleLineList.tsx`
  - Subtitle row list.
- `apps/web/src/components/SubtitleEditor.tsx`
  - Selected line editor and save command.
- `apps/web/src/components/ExportPanel.tsx`
  - SRT export controls and result.
- `apps/web/src/components/TaskStatusBar.tsx`
  - Worker/project status and ARIA live updates.
- `apps/web/tests/api.test.ts`
  - Test API client request/response handling.
- `apps/web/tests/App.test.tsx`
  - Test the visible workbench loop with mocked Worker responses.
- `docs/development/m2a-workbench-loop.md`
  - Document the M2a dev workflow and API boundary.
- `README.md`
  - Link the M2a development doc.

---

### Task 1: Store M2a Project Metadata

**Files:**
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Modify: `worker/tests/storage/test_project_store.py`

- [ ] **Step 1: Write storage metadata tests**

Update `worker/tests/storage/test_project_store.py` so the existing creation test passes explicit M2a metadata and asserts round-trip persistence:

```python
def test_project_store_creates_project_and_saves_subtitle_document(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    project = store.create_project(
        name="Demo",
        source_video_path=tmp_path / "demo.mp4",
        duration_ms=65_000,
        source_language="zh",
        target_language="en",
    )

    assert project.duration_ms == 65_000
    assert project.source_language == "zh"
    assert project.target_language == "en"
```

Add a focused metadata lookup test:

```python
def test_project_store_round_trips_project_metadata(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "diplomat.db")
    created = store.create_project(
        name="Course Clip",
        source_video_path=tmp_path / "course.mp4",
        duration_ms=90_000,
        source_language="en",
        target_language="zh",
    )

    loaded = store.get_project(created.project_id)

    assert loaded.name == "Course Clip"
    assert loaded.source_video_path == tmp_path / "course.mp4"
    assert loaded.project_dir == created.project_dir
    assert loaded.duration_ms == 90_000
    assert loaded.source_language == "en"
    assert loaded.target_language == "zh"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: fails because `create_project()` and `ProjectRecord` do not yet support `duration_ms`, `source_language`, or `target_language`.

- [ ] **Step 3: Implement metadata persistence**

Update `ProjectRecord` in `worker/diplomat_worker/storage/project_store.py`:

```python
@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    name: str
    source_video_path: Path
    project_dir: Path
    duration_ms: int
    source_language: str
    target_language: str | None
```

Update the `projects` table creation SQL to include:

```sql
duration_ms INTEGER NOT NULL,
source_language TEXT NOT NULL,
target_language TEXT
```

Update `create_project()` signature:

```python
def create_project(
    self,
    name: str,
    source_video_path: Path,
    duration_ms: int,
    source_language: str,
    target_language: str | None,
) -> ProjectRecord:
```

Before generating the project id, validate:

```python
if duration_ms < 0:
    raise ValueError("duration_ms must be greater than or equal to 0")
if len(source_language) < 2:
    raise ValueError("source_language must be at least 2 characters")
if target_language is not None and len(target_language) < 2:
    raise ValueError("target_language must be at least 2 characters")
```

Insert and select the new fields in `create_project()` and `get_project()`.

- [ ] **Step 4: Run storage tests**

Run:

```powershell
python -m pytest worker/tests/storage/test_project_store.py -q
```

Expected: all storage tests pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/storage/project_store.py worker/tests/storage/test_project_store.py
git commit -m "feat: store m2a project metadata"
```

---

### Task 2: SRT Export Core

**Files:**
- Create: `worker/diplomat_worker/export/__init__.py`
- Create: `worker/diplomat_worker/export/srt.py`
- Create: `worker/tests/export/test_srt.py`

- [ ] **Step 1: Write SRT exporter tests**

Create `worker/tests/export/test_srt.py`:

```python
from pathlib import Path

from diplomat_worker.export.srt import format_srt_timestamp, subtitle_document_to_srt, write_srt_export
from diplomat_worker.schemas.subtitle import AiOrigin, SubtitleDocument, SubtitleLine


def make_document() -> SubtitleDocument:
    return SubtitleDocument(
        project_id="project-1",
        media_id="media-1",
        duration_ms=4_000,
        lines=[
            SubtitleLine(
                id="line-2",
                start_ms=2_500,
                end_ms=4_000,
                speaker_id=None,
                source_language="zh",
                target_language="en",
                source_text="第二句",
                translated_text="Second line",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            ),
            SubtitleLine(
                id="line-1",
                start_ms=0,
                end_ms=1_250,
                speaker_id=None,
                source_language="zh",
                target_language="en",
                source_text="第一句",
                translated_text="First line",
                words=[],
                style_overrides={},
                review_status="draft",
                ai_origin=AiOrigin(engine="fake-asr", model="fake-v1"),
                notes="",
            ),
        ],
    )


def test_format_srt_timestamp() -> None:
    assert format_srt_timestamp(3_723_045) == "01:02:03,045"


def test_subtitle_document_to_srt_sorts_lines_and_exports_bilingual_text() -> None:
    text = subtitle_document_to_srt(make_document(), mode="bilingual")

    assert text.splitlines()[0] == "1"
    assert "00:00:00,000 --> 00:00:01,250" in text
    assert "第一句" in text
    assert "First line" in text
    assert text.index("第一句") < text.index("第二句")


def test_subtitle_document_to_srt_can_export_target_only() -> None:
    text = subtitle_document_to_srt(make_document(), mode="target")

    assert "First line" in text
    assert "第一句" not in text


def test_write_srt_export_creates_parent_directory(tmp_path: Path) -> None:
    output = write_srt_export(make_document(), tmp_path / "exports" / "subtitle.srt", mode="source")

    assert output.exists()
    assert "第一句" in output.read_text(encoding="utf-8")
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
python -m pytest worker/tests/export/test_srt.py -q
```

Expected: fails because the export package does not exist.

- [ ] **Step 3: Implement SRT exporter**

Create `worker/diplomat_worker/export/__init__.py`:

```python
from diplomat_worker.export.srt import format_srt_timestamp, subtitle_document_to_srt, write_srt_export

__all__ = ["format_srt_timestamp", "subtitle_document_to_srt", "write_srt_export"]
```

Create `worker/diplomat_worker/export/srt.py`:

```python
from pathlib import Path
from typing import Literal

from diplomat_worker.schemas.subtitle import SubtitleDocument, SubtitleLine

SrtMode = Literal["source", "target", "bilingual"]


def format_srt_timestamp(milliseconds: int) -> str:
    if milliseconds < 0:
        raise ValueError("milliseconds must be greater than or equal to 0")
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1_000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{millis:03}"


def _line_text(line: SubtitleLine, mode: SrtMode) -> str:
    source = line.source_text.strip()
    target = line.translated_text.strip()
    if mode == "source":
        return source
    if mode == "target":
        return target or source
    if target and target != source:
        return f"{source}\n{target}"
    return source


def subtitle_document_to_srt(document: SubtitleDocument, mode: SrtMode = "bilingual") -> str:
    blocks: list[str] = []
    sorted_lines = sorted(document.lines, key=lambda line: (line.start_ms, line.end_ms, line.id))
    for index, line in enumerate(sorted_lines, start=1):
        text = _line_text(line, mode)
        if not text:
            continue
        blocks.append(
            "\n".join(
                [
                    str(index),
                    f"{format_srt_timestamp(line.start_ms)} --> {format_srt_timestamp(line.end_ms)}",
                    text,
                ]
            )
        )
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def write_srt_export(document: SubtitleDocument, output_path: Path, mode: SrtMode = "bilingual") -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(subtitle_document_to_srt(document, mode), encoding="utf-8")
    return output_path
```

- [ ] **Step 4: Run SRT tests**

Run:

```powershell
python -m pytest worker/tests/export/test_srt.py -q
```

Expected: `4 passed`.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/export worker/tests/export/test_srt.py
git commit -m "feat: add srt export core"
```

---

### Task 3: Worker Runtime And API Schemas

**Files:**
- Create: `worker/diplomat_worker/api/runtime.py`
- Create: `worker/diplomat_worker/api/schemas.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write runtime/schema import test**

Append to `worker/tests/api/test_app.py`:

```python
def test_m2a_api_schemas_validate_project_payload(tmp_path: Path) -> None:
    from diplomat_worker.api.schemas import CreateProjectRequest

    request = CreateProjectRequest(
        name="Demo",
        sourceVideoPath=str(tmp_path / "demo.mp4"),
        sourceLanguage="zh",
        targetLanguage="en",
    )

    assert request.source_video_path == tmp_path / "demo.mp4"
    assert request.source_language == "zh"
    assert request.target_language == "en"
```

Add `Path` import at the top of the file:

```python
from pathlib import Path
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py::test_m2a_api_schemas_validate_project_payload -q
```

Expected: fails because `worker/diplomat_worker/api/schemas.py` does not exist.

- [ ] **Step 3: Create runtime dependencies**

Create `worker/diplomat_worker/api/runtime.py`:

```python
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from diplomat_worker.asr.base import Transcriber
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import VideoProbe, probe_video
from diplomat_worker.storage.project_store import ProjectStore


ProbeVideoFn = Callable[[Path], VideoProbe]
ExtractAudioFn = Callable[[Path, Path], Path]


def default_data_dir() -> Path:
    configured = os.environ.get("DIPLOMAT_DATA_DIR")
    if configured:
        return Path(configured)
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "Diplomat"
    return Path.home() / ".diplomat"


@dataclass(frozen=True)
class WorkerRuntime:
    store: ProjectStore
    transcriber: Transcriber
    probe_video_fn: ProbeVideoFn = probe_video
    extract_audio_fn: ExtractAudioFn | None = None


def create_default_runtime() -> WorkerRuntime:
    data_dir = default_data_dir()
    return WorkerRuntime(
        store=ProjectStore(data_dir / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
    )
```

- [ ] **Step 4: Create API schemas**

Create `worker/diplomat_worker/api/schemas.py`:

```python
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from diplomat_worker.schemas.subtitle import SubtitleDocument


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CreateProjectRequest(CamelModel):
    name: str = Field(min_length=1)
    source_video_path: Path = Field(alias="sourceVideoPath")
    source_language: str = Field(alias="sourceLanguage", min_length=2, max_length=12)
    target_language: str | None = Field(default=None, alias="targetLanguage", min_length=2, max_length=12)


class ProjectResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    name: str
    source_video_path: str = Field(alias="sourceVideoPath")
    project_dir: str = Field(alias="projectDir")
    duration_ms: int = Field(alias="durationMs", ge=0)
    source_language: str = Field(alias="sourceLanguage")
    target_language: str | None = Field(default=None, alias="targetLanguage")


class AnalyzeProjectResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    status: Literal["completed"]
    subtitle_path: str = Field(alias="subtitlePath")
    line_count: int = Field(alias="lineCount", ge=0)
    document: SubtitleDocument


class SubtitleDocumentRequest(CamelModel):
    document: SubtitleDocument


class SrtExportRequest(CamelModel):
    mode: Literal["source", "target", "bilingual"] = "bilingual"


class SrtExportResponse(CamelModel):
    project_id: str = Field(alias="projectId")
    export_path: str = Field(alias="exportPath")
    mode: Literal["source", "target", "bilingual"]
```

- [ ] **Step 5: Run API schema test**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py::test_m2a_api_schemas_validate_project_payload -q
```

Expected: test passes.

- [ ] **Step 6: Commit**

```powershell
git add worker/diplomat_worker/api/runtime.py worker/diplomat_worker/api/schemas.py worker/tests/api/test_app.py
git commit -m "feat: add worker m2a api schemas"
```

---

### Task 4: Worker Project, Analyze, And Subtitle Endpoints

**Files:**
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write API endpoint tests**

Replace the old route-surface test in `worker/tests/api/test_app.py` with:

```python
def test_app_exposes_m2a_route_surface() -> None:
    app = create_app()
    routes = {
        (",".join(sorted(route.methods or [])), route.path)
        for route in app.routes
        if isinstance(getattr(route, "path", None), str)
    }

    assert routes == {
        ("GET", "/health"),
        ("POST", "/projects"),
        ("GET", "/projects/{project_id}"),
        ("POST", "/projects/{project_id}/analyze"),
        ("GET", "/projects/{project_id}/subtitle"),
        ("PUT", "/projects/{project_id}/subtitle"),
        ("POST", "/projects/{project_id}/exports/srt"),
    }
```

Add a test runtime helper in the same test file:

```python
from diplomat_worker.api.runtime import WorkerRuntime
from diplomat_worker.asr.fake import FakeTranscriber
from diplomat_worker.media.ffmpeg import VideoProbe
from diplomat_worker.storage.project_store import ProjectStore


def make_test_runtime(tmp_path: Path) -> WorkerRuntime:
    return WorkerRuntime(
        store=ProjectStore(tmp_path / "diplomat.db"),
        transcriber=FakeTranscriber(language="zh"),
        probe_video_fn=lambda source: VideoProbe(
            duration_ms=65_000,
            has_audio=True,
            audio_codec="aac",
            video_codec="h264",
        ),
        extract_audio_fn=lambda source, target: target.write_bytes(b"fake-audio") or target,
    )
```

Add the full project/analyze/subtitle test:

```python
def test_project_analyze_and_subtitle_round_trip(tmp_path: Path) -> None:
    source = tmp_path / "demo.mp4"
    source.write_bytes(b"fake-video")
    client = TestClient(create_app(make_test_runtime(tmp_path)))

    create_response = client.post(
        "/projects",
        json={
            "name": "Demo",
            "sourceVideoPath": str(source),
            "sourceLanguage": "zh",
            "targetLanguage": "en",
        },
    )
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["durationMs"] == 65_000

    analyze_response = client.post(f"/projects/{project['projectId']}/analyze")
    assert analyze_response.status_code == 200
    analyzed = analyze_response.json()
    assert analyzed["status"] == "completed"
    assert analyzed["lineCount"] == 3

    subtitle_response = client.get(f"/projects/{project['projectId']}/subtitle")
    assert subtitle_response.status_code == 200
    document = subtitle_response.json()
    document["lines"][0]["sourceText"] = "Edited text"

    save_response = client.put(
        f"/projects/{project['projectId']}/subtitle",
        json={"document": document},
    )
    assert save_response.status_code == 200

    reloaded = client.get(f"/projects/{project['projectId']}/subtitle").json()
    assert reloaded["lines"][0]["sourceText"] == "Edited text"
```

- [ ] **Step 2: Run endpoint tests to verify failure**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: route and endpoint tests fail because the endpoints are not implemented.

- [ ] **Step 3: Implement CORS and runtime injection**

Update `worker/diplomat_worker/api/app.py` imports:

```python
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from diplomat_worker.api.runtime import WorkerRuntime, create_default_runtime
from diplomat_worker.api.schemas import (
    AnalyzeProjectResponse,
    CreateProjectRequest,
    ProjectResponse,
    SubtitleDocumentRequest,
)
from diplomat_worker.pipeline.core import CorePipelineInput, run_core_pipeline
from diplomat_worker.schemas.subtitle import SubtitleDocument
```

Change `create_app()` signature:

```python
def create_app(runtime: WorkerRuntime | None = None) -> FastAPI:
    active_runtime = runtime or create_default_runtime()
```

After creating the app, add CORS:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://127.0.0.1:1420"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 4: Add response mapper**

Add this helper inside `app.py`:

```python
def project_response(project) -> ProjectResponse:
    return ProjectResponse(
        project_id=project.project_id,
        name=project.name,
        source_video_path=str(project.source_video_path),
        project_dir=str(project.project_dir),
        duration_ms=project.duration_ms,
        source_language=project.source_language,
        target_language=project.target_language,
    )
```

- [ ] **Step 5: Add project and subtitle endpoints**

Inside `create_app()`, add:

```python
@app.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(request: CreateProjectRequest) -> ProjectResponse:
    try:
        probe = active_runtime.probe_video_fn(request.source_video_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to probe source video: {exc}") from exc
    if not probe.has_audio:
        raise HTTPException(status_code=400, detail="Source video does not contain an audio stream")
    project = active_runtime.store.create_project(
        name=request.name,
        source_video_path=request.source_video_path,
        duration_ms=probe.duration_ms,
        source_language=request.source_language,
        target_language=request.target_language,
    )
    return project_response(project)


@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str) -> ProjectResponse:
    try:
        return project_response(active_runtime.store.get_project(project_id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc


@app.post("/projects/{project_id}/analyze", response_model=AnalyzeProjectResponse)
def analyze_project(project_id: str) -> AnalyzeProjectResponse:
    try:
        project = active_runtime.store.get_project(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    result = run_core_pipeline(
        CorePipelineInput(
            project_id=project.project_id,
            media_id="media-1",
            source_video=project.source_video_path,
            project_dir=project.project_dir,
            duration_ms=project.duration_ms,
            source_language=project.source_language,
            target_language=project.target_language,
        ),
        transcriber=active_runtime.transcriber,
        extract_audio_fn=active_runtime.extract_audio_fn,
    )
    active_runtime.store.save_subtitle_document(project_id, result.subtitle_document)
    return AnalyzeProjectResponse(
        project_id=project_id,
        status="completed",
        subtitle_path=str(result.subtitle_path),
        line_count=len(result.subtitle_document.lines),
        document=result.subtitle_document,
    )


@app.get("/projects/{project_id}/subtitle", response_model=SubtitleDocument)
def get_subtitle_document(project_id: str) -> SubtitleDocument:
    try:
        return active_runtime.store.load_subtitle_document(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subtitle document not found") from exc


@app.put("/projects/{project_id}/subtitle", response_model=SubtitleDocument)
def save_subtitle_document(project_id: str, request: SubtitleDocumentRequest) -> SubtitleDocument:
    try:
        active_runtime.store.save_subtitle_document(project_id, request.document)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return request.document
```

- [ ] **Step 6: Run endpoint tests**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: project/analyze/subtitle tests pass except export route if Task 5 has not been implemented. If the route-surface test includes export now, add a temporary skipped assertion is not allowed; proceed directly to Task 5 before committing if this test is failing only for export route.

---

### Task 5: Worker SRT Export Endpoint

**Files:**
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add export endpoint test**

Append to the full API test after saving/reloading the edited subtitle:

```python
    export_response = client.post(
        f"/projects/{project['projectId']}/exports/srt",
        json={"mode": "bilingual"},
    )
    assert export_response.status_code == 200
    export_payload = export_response.json()
    assert export_payload["mode"] == "bilingual"
    assert export_payload["exportPath"].endswith("subtitle-bilingual.srt")
    assert Path(export_payload["exportPath"]).exists()
    assert "Edited text" in Path(export_payload["exportPath"]).read_text(encoding="utf-8")
```

- [ ] **Step 2: Run API tests to verify failure**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: export endpoint test fails because the endpoint is not implemented.

- [ ] **Step 3: Implement export endpoint**

Update `worker/diplomat_worker/api/app.py` imports:

```python
from diplomat_worker.api.schemas import SrtExportRequest, SrtExportResponse
from diplomat_worker.export.srt import write_srt_export
```

Inside `create_app()`, add:

```python
@app.post("/projects/{project_id}/exports/srt", response_model=SrtExportResponse)
def export_srt(project_id: str, request: SrtExportRequest) -> SrtExportResponse:
    try:
        project = active_runtime.store.get_project(project_id)
        document = active_runtime.store.load_subtitle_document(project_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Project not found") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Subtitle document not found") from exc
    export_path = project.project_dir / "exports" / f"subtitle-{request.mode}.srt"
    write_srt_export(document, export_path, mode=request.mode)
    return SrtExportResponse(project_id=project_id, export_path=str(export_path), mode=request.mode)
```

- [ ] **Step 4: Run Worker API and export tests**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py worker/tests/export/test_srt.py -q
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit Tasks 4 and 5 together**

Task 4 and Task 5 change the same API route surface, so commit them together after all endpoint tests pass:

```powershell
git add worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat: add m2a worker project endpoints"
```

---

### Task 6: Shared M2a API Schemas

**Files:**
- Create: `packages/shared/src/project.ts`
- Create: `packages/shared/src/export.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/tests/project.test.ts`
- Create: `packages/shared/tests/export.test.ts`

- [ ] **Step 1: Write shared schema tests**

Create `packages/shared/tests/project.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  AnalyzeProjectResponseSchema,
  CreateProjectRequestSchema,
  ProjectResponseSchema
} from "../src/project";

describe("M2a project schemas", () => {
  it("validates create project requests", () => {
    const parsed = CreateProjectRequestSchema.parse({
      name: "Demo",
      sourceVideoPath: "D:/Videos/demo.mp4",
      sourceLanguage: "zh",
      targetLanguage: "en"
    });

    expect(parsed.sourceLanguage).toBe("zh");
  });

  it("validates project responses", () => {
    const parsed = ProjectResponseSchema.parse({
      projectId: "project-1",
      name: "Demo",
      sourceVideoPath: "D:/Videos/demo.mp4",
      projectDir: "D:/Diplomat/project-1",
      durationMs: 65000,
      sourceLanguage: "zh",
      targetLanguage: "en"
    });

    expect(parsed.durationMs).toBe(65000);
  });

  it("validates analyze responses with subtitle documents", () => {
    const parsed = AnalyzeProjectResponseSchema.parse({
      projectId: "project-1",
      status: "completed",
      subtitlePath: "D:/Diplomat/project-1/subtitle.diplomat.json",
      lineCount: 0,
      document: {
        schemaVersion: "diplomat.subtitle.v1",
        projectId: "project-1",
        mediaId: "media-1",
        durationMs: 65000,
        speakers: [],
        styles: [],
        lines: []
      }
    });

    expect(parsed.lineCount).toBe(0);
  });
});
```

Create `packages/shared/tests/export.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { SrtExportRequestSchema, SrtExportResponseSchema } from "../src/export";

describe("M2a export schemas", () => {
  it("defaults SRT export mode to bilingual", () => {
    const parsed = SrtExportRequestSchema.parse({});
    expect(parsed.mode).toBe("bilingual");
  });

  it("validates SRT export responses", () => {
    const parsed = SrtExportResponseSchema.parse({
      projectId: "project-1",
      exportPath: "D:/Diplomat/project-1/exports/subtitle-bilingual.srt",
      mode: "bilingual"
    });

    expect(parsed.mode).toBe("bilingual");
  });
});
```

- [ ] **Step 2: Run shared tests to verify failure**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test
```

Expected: fails because `project.ts` and `export.ts` do not exist.

- [ ] **Step 3: Implement project schemas**

Create `packages/shared/src/project.ts`:

```typescript
import { z } from "zod";
import { SubtitleDocumentSchema } from "./subtitle";

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  sourceLanguage: z.string().min(2).max(12),
  targetLanguage: z.string().min(2).max(12).nullable()
});

export const ProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  sourceVideoPath: z.string().min(1),
  projectDir: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  sourceLanguage: z.string().min(2).max(12),
  targetLanguage: z.string().min(2).max(12).nullable()
});

export const AnalyzeProjectResponseSchema = z.object({
  projectId: z.string().min(1),
  status: z.literal("completed"),
  subtitlePath: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  document: SubtitleDocumentSchema
});

export const SubtitleDocumentRequestSchema = z.object({
  document: SubtitleDocumentSchema
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type AnalyzeProjectResponse = z.infer<typeof AnalyzeProjectResponseSchema>;
export type SubtitleDocumentRequest = z.infer<typeof SubtitleDocumentRequestSchema>;
```

- [ ] **Step 4: Implement export schemas**

Create `packages/shared/src/export.ts`:

```typescript
import { z } from "zod";

export const SrtExportModeSchema = z.enum(["source", "target", "bilingual"]);

export const SrtExportRequestSchema = z.object({
  mode: SrtExportModeSchema.default("bilingual")
});

export const SrtExportResponseSchema = z.object({
  projectId: z.string().min(1),
  exportPath: z.string().min(1),
  mode: SrtExportModeSchema
});

export type SrtExportMode = z.infer<typeof SrtExportModeSchema>;
export type SrtExportRequest = z.infer<typeof SrtExportRequestSchema>;
export type SrtExportResponse = z.infer<typeof SrtExportResponseSchema>;
```

Update `packages/shared/src/index.ts`:

```typescript
export * from "./subtitle";
export * from "./task";
export * from "./project";
export * from "./export";
```

- [ ] **Step 5: Run shared tests and typecheck**

Run:

```powershell
corepack pnpm --filter @diplomat/shared test
corepack pnpm --filter @diplomat/shared typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 6: Commit**

```powershell
git add packages/shared/src/project.ts packages/shared/src/export.ts packages/shared/src/index.ts packages/shared/tests/project.test.ts packages/shared/tests/export.test.ts
git commit -m "feat: add shared m2a api schemas"
```

---

### Task 7: Web Worker API Client

**Files:**
- Modify: `apps/web/src/api.ts`
- Create: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write API client tests**

Create `apps/web/tests/api.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProject,
  exportSrt,
  fetchSubtitleDocument,
  runProjectAnalysis,
  saveSubtitleDocument
} from "../src/api";

const baseUrl = "http://worker.test";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Worker API client", () => {
  it("creates projects with JSON payloads", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        projectId: "project-1",
        name: "Demo",
        sourceVideoPath: "D:/Videos/demo.mp4",
        projectDir: "D:/Diplomat/project-1",
        durationMs: 65000,
        sourceLanguage: "zh",
        targetLanguage: "en"
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const project = await createProject(
      {
        name: "Demo",
        sourceVideoPath: "D:/Videos/demo.mp4",
        sourceLanguage: "zh",
        targetLanguage: "en"
      },
      baseUrl
    );

    expect(project.projectId).toBe("project-1");
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/projects`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("loads, saves, analyzes, and exports through typed helpers", async () => {
    const document = {
      schemaVersion: "diplomat.subtitle.v1",
      projectId: "project-1",
      mediaId: "media-1",
      durationMs: 65000,
      speakers: [],
      styles: [],
      lines: []
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/analyze")) {
        return {
          ok: true,
          json: async () => ({
            projectId: "project-1",
            status: "completed",
            subtitlePath: "D:/Diplomat/project-1/subtitle.diplomat.json",
            lineCount: 0,
            document
          })
        };
      }
      if (url.endsWith("/subtitle") && init?.method === "PUT") {
        return { ok: true, json: async () => document };
      }
      if (url.endsWith("/subtitle")) {
        return { ok: true, json: async () => document };
      }
      return {
        ok: true,
        json: async () => ({
          projectId: "project-1",
          exportPath: "D:/Diplomat/project-1/exports/subtitle-bilingual.srt",
          mode: "bilingual"
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runProjectAnalysis("project-1", baseUrl)).resolves.toMatchObject({ status: "completed" });
    await expect(fetchSubtitleDocument("project-1", baseUrl)).resolves.toMatchObject({ projectId: "project-1" });
    await expect(saveSubtitleDocument("project-1", document, baseUrl)).resolves.toMatchObject({ projectId: "project-1" });
    await expect(exportSrt("project-1", "bilingual", baseUrl)).resolves.toMatchObject({ mode: "bilingual" });
  });
});
```

- [ ] **Step 2: Run web API tests to verify failure**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- api.test.ts
```

Expected: fails because the new API helpers do not exist.

- [ ] **Step 3: Implement API helpers**

Replace `apps/web/src/api.ts` with:

```typescript
import {
  AnalyzeProjectResponseSchema,
  CreateProjectRequest,
  ProjectResponseSchema,
  SrtExportMode,
  SrtExportResponseSchema,
  SubtitleDocument,
  SubtitleDocumentSchema
} from "@diplomat/shared";

export type WorkerHealth = {
  name: string;
  status: string;
  version: string;
};

const defaultBaseUrl = "http://127.0.0.1:8765";

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  parse: (payload: unknown) => T
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Worker request failed: ${response.status}`);
  }
  return parse(await response.json());
}

export async function fetchWorkerHealth(baseUrl = defaultBaseUrl): Promise<WorkerHealth> {
  return requestJson(`${baseUrl}/health`, undefined, (payload) => payload as WorkerHealth);
}

export async function createProject(input: CreateProjectRequest, baseUrl = defaultBaseUrl) {
  return requestJson(
    `${baseUrl}/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    },
    (payload) => ProjectResponseSchema.parse(payload)
  );
}

export async function runProjectAnalysis(projectId: string, baseUrl = defaultBaseUrl) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/analyze`,
    { method: "POST" },
    (payload) => AnalyzeProjectResponseSchema.parse(payload)
  );
}

export async function fetchSubtitleDocument(projectId: string, baseUrl = defaultBaseUrl): Promise<SubtitleDocument> {
  return requestJson(
    `${baseUrl}/projects/${projectId}/subtitle`,
    undefined,
    (payload) => SubtitleDocumentSchema.parse(payload)
  );
}

export async function saveSubtitleDocument(projectId: string, document: SubtitleDocument, baseUrl = defaultBaseUrl) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/subtitle`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document })
    },
    (payload) => SubtitleDocumentSchema.parse(payload)
  );
}

export async function exportSrt(projectId: string, mode: SrtExportMode, baseUrl = defaultBaseUrl) {
  return requestJson(
    `${baseUrl}/projects/${projectId}/exports/srt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    },
    (payload) => SrtExportResponseSchema.parse(payload)
  );
}
```

- [ ] **Step 4: Run web API tests and typecheck**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- api.test.ts
corepack pnpm --filter @diplomat/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/api.ts apps/web/tests/api.test.ts
git commit -m "feat: add web worker api client"
```

---

### Task 8: React Workbench Components

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.css`
- Create: `apps/web/src/components/ProjectImportPanel.tsx`
- Create: `apps/web/src/components/SubtitleLineList.tsx`
- Create: `apps/web/src/components/SubtitleEditor.tsx`
- Create: `apps/web/src/components/ExportPanel.tsx`
- Create: `apps/web/src/components/TaskStatusBar.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/tests/App.test.tsx`

- [ ] **Step 1: Write workbench UI test**

Replace `apps/web/tests/App.test.tsx` with:

```typescript
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

const documentWithLine = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-1",
  mediaId: "media-1",
  durationMs: 65000,
  speakers: [],
  styles: [],
  lines: [
    {
      id: "line-1",
      startMs: 0,
      endMs: 2500,
      speakerId: null,
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "Fake transcript chunk 0",
      translatedText: "",
      words: [],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    }
  ]
};

describe("App", () => {
  it("runs the M2a workbench loop", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/health")) {
        return { ok: true, json: async () => ({ name: "diplomat-worker", status: "ok", version: "0.1.0" }) };
      }
      if (url.endsWith("/projects")) {
        return {
          ok: true,
          json: async () => ({
            projectId: "project-1",
            name: "Demo",
            sourceVideoPath: "D:/Videos/demo.mp4",
            projectDir: "D:/Diplomat/project-1",
            durationMs: 65000,
            sourceLanguage: "zh",
            targetLanguage: "en"
          })
        };
      }
      if (url.endsWith("/analyze")) {
        return {
          ok: true,
          json: async () => ({
            projectId: "project-1",
            status: "completed",
            subtitlePath: "D:/Diplomat/project-1/subtitle.diplomat.json",
            lineCount: 1,
            document: documentWithLine
          })
        };
      }
      if (url.endsWith("/subtitle") && init?.method === "PUT") {
        return { ok: true, json: async () => JSON.parse(String(init.body)).document };
      }
      if (url.endsWith("/exports/srt")) {
        return {
          ok: true,
          json: async () => ({
            projectId: "project-1",
            exportPath: "D:/Diplomat/project-1/exports/subtitle-bilingual.srt",
            mode: "bilingual"
          })
        };
      }
      return { ok: true, json: async () => documentWithLine };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Worker: ok")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Demo" } });
    fireEvent.change(screen.getByLabelText("Source video path"), { target: { value: "D:/Videos/demo.mp4" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    expect(await screen.findByText(/Project: Demo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByText("Fake transcript chunk 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /line-1/ }));
    fireEvent.change(screen.getByLabelText("Source text"), { target: { value: "Edited subtitle" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Subtitle" }));
    await waitFor(() => expect(screen.getByText("Saved subtitle edits")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Export SRT" }));
    expect(await screen.findByText("SRT exported: D:/Diplomat/project-1/exports/subtitle-bilingual.srt")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
```

Expected: fails because the M2a workbench UI is not implemented.

- [ ] **Step 3: Create status component**

Create `apps/web/src/components/TaskStatusBar.tsx`:

```tsx
type TaskStatusBarProps = {
  workerStatus: string;
  message: string;
  error: string | null;
};

export function TaskStatusBar({ workerStatus, message, error }: TaskStatusBarProps) {
  return (
    <section className="statusBar" aria-live="polite">
      <strong>Worker: {workerStatus}</strong>
      <span>{message}</span>
      {error ? <span role="alert">Error: {error}</span> : null}
    </section>
  );
}
```

- [ ] **Step 4: Create project import component**

Create `apps/web/src/components/ProjectImportPanel.tsx`:

```tsx
import type { ProjectResponse } from "@diplomat/shared";

type ProjectImportPanelProps = {
  project: ProjectResponse | null;
  projectName: string;
  sourceVideoPath: string;
  sourceLanguage: string;
  targetLanguage: string;
  busy: boolean;
  onProjectNameChange: (value: string) => void;
  onSourceVideoPathChange: (value: string) => void;
  onSourceLanguageChange: (value: string) => void;
  onTargetLanguageChange: (value: string) => void;
  onCreateProject: () => void;
  onAnalyze: () => void;
};

export function ProjectImportPanel(props: ProjectImportPanelProps) {
  return (
    <section className="panel">
      <h2>Project</h2>
      <label>
        Project name
        <input value={props.projectName} onChange={(event) => props.onProjectNameChange(event.target.value)} />
      </label>
      <label>
        Source video path
        <input value={props.sourceVideoPath} onChange={(event) => props.onSourceVideoPathChange(event.target.value)} />
      </label>
      <div className="inlineFields">
        <label>
          Source language
          <input value={props.sourceLanguage} onChange={(event) => props.onSourceLanguageChange(event.target.value)} />
        </label>
        <label>
          Target language
          <input value={props.targetLanguage} onChange={(event) => props.onTargetLanguageChange(event.target.value)} />
        </label>
      </div>
      <button type="button" onClick={props.onCreateProject} disabled={props.busy}>
        Create Project
      </button>
      <button type="button" onClick={props.onAnalyze} disabled={props.busy || !props.project}>
        Analyze
      </button>
      {props.project ? (
        <p>
          Project: {props.project.name} · {Math.round(props.project.durationMs / 1000)}s
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Create subtitle list component**

Create `apps/web/src/components/SubtitleLineList.tsx`:

```tsx
import type { SubtitleLine } from "@diplomat/shared";

type SubtitleLineListProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
  onSelectLine: (lineId: string) => void;
};

function formatMs(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function SubtitleLineList({ lines, selectedLineId, onSelectLine }: SubtitleLineListProps) {
  return (
    <section className="panel subtitleList">
      <h2>Subtitles</h2>
      {lines.length === 0 ? <p>No subtitles generated.</p> : null}
      <div className="lineRows">
        {lines.map((line) => (
          <button
            type="button"
            key={line.id}
            className={line.id === selectedLineId ? "lineRow selected" : "lineRow"}
            onClick={() => onSelectLine(line.id)}
          >
            <span>{line.id}</span>
            <span>{formatMs(line.startMs)} - {formatMs(line.endMs)}</span>
            <strong>{line.sourceText || "(empty)"}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create subtitle editor component**

Create `apps/web/src/components/SubtitleEditor.tsx`:

```tsx
import type { SubtitleLine } from "@diplomat/shared";

type SubtitleEditorProps = {
  line: SubtitleLine | null;
  onChange: (line: SubtitleLine) => void;
  onSave: () => void;
  busy: boolean;
};

export function SubtitleEditor({ line, onChange, onSave, busy }: SubtitleEditorProps) {
  if (!line) {
    return (
      <section className="panel">
        <h2>Line Editor</h2>
        <p>Select a subtitle line.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Line Editor</h2>
      <div className="inlineFields">
        <label>
          Start ms
          <input
            type="number"
            value={line.startMs}
            onChange={(event) => onChange({ ...line, startMs: Number(event.target.value) })}
          />
        </label>
        <label>
          End ms
          <input
            type="number"
            value={line.endMs}
            onChange={(event) => onChange({ ...line, endMs: Number(event.target.value) })}
          />
        </label>
      </div>
      <label>
        Source text
        <textarea value={line.sourceText} onChange={(event) => onChange({ ...line, sourceText: event.target.value })} />
      </label>
      <label>
        Translated text
        <textarea
          value={line.translatedText}
          onChange={(event) => onChange({ ...line, translatedText: event.target.value })}
        />
      </label>
      <button type="button" onClick={onSave} disabled={busy}>
        Save Subtitle
      </button>
    </section>
  );
}
```

- [ ] **Step 7: Create export component**

Create `apps/web/src/components/ExportPanel.tsx`:

```tsx
import type { SrtExportMode, SrtExportResponse } from "@diplomat/shared";

type ExportPanelProps = {
  mode: SrtExportMode;
  result: SrtExportResponse | null;
  disabled: boolean;
  onModeChange: (mode: SrtExportMode) => void;
  onExport: () => void;
};

export function ExportPanel({ mode, result, disabled, onModeChange, onExport }: ExportPanelProps) {
  return (
    <section className="panel">
      <h2>Export</h2>
      <label>
        SRT mode
        <select value={mode} onChange={(event) => onModeChange(event.target.value as SrtExportMode)}>
          <option value="bilingual">Bilingual</option>
          <option value="source">Source</option>
          <option value="target">Target</option>
        </select>
      </label>
      <button type="button" onClick={onExport} disabled={disabled}>
        Export SRT
      </button>
      {result ? <p>SRT exported: {result.exportPath}</p> : null}
    </section>
  );
}
```

- [ ] **Step 8: Implement App orchestration**

Replace `apps/web/src/App.tsx` with an orchestrator that imports the components and API functions:

```tsx
import { useEffect, useMemo, useState } from "react";
import type { ProjectResponse, SrtExportMode, SrtExportResponse, SubtitleDocument, SubtitleLine } from "@diplomat/shared";
import {
  createProject,
  exportSrt,
  fetchWorkerHealth,
  runProjectAnalysis,
  saveSubtitleDocument,
  type WorkerHealth
} from "./api";
import { ExportPanel } from "./components/ExportPanel";
import { ProjectImportPanel } from "./components/ProjectImportPanel";
import { SubtitleEditor } from "./components/SubtitleEditor";
import { SubtitleLineList } from "./components/SubtitleLineList";
import { TaskStatusBar } from "./components/TaskStatusBar";
import "./App.css";

export function App() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [sourceVideoPath, setSourceVideoPath] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("zh");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [document, setDocument] = useState<SubtitleDocument | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [message, setMessage] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);

  useEffect(() => {
    let canceled = false;
    fetchWorkerHealth()
      .then((result) => {
        if (!canceled) {
          setHealth(result);
        }
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Unknown worker error");
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const selectedLine = useMemo(
    () => document?.lines.find((line) => line.id === selectedLineId) ?? null,
    [document, selectedLineId]
  );

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function updateLine(nextLine: SubtitleLine) {
    setDocument((current) =>
      current
        ? {
            ...current,
            lines: current.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
          }
        : current
    );
  }

  return (
    <main className="workbench">
      <header className="topBar">
        <h1>Diplomat</h1>
        <TaskStatusBar workerStatus={health?.status ?? "checking"} message={message} error={error} />
      </header>
      <ProjectImportPanel
        project={project}
        projectName={projectName}
        sourceVideoPath={sourceVideoPath}
        sourceLanguage={sourceLanguage}
        targetLanguage={targetLanguage}
        busy={busy}
        onProjectNameChange={setProjectName}
        onSourceVideoPathChange={setSourceVideoPath}
        onSourceLanguageChange={setSourceLanguage}
        onTargetLanguageChange={setTargetLanguage}
        onCreateProject={() =>
          runAction(async () => {
            const created = await createProject({
              name: projectName,
              sourceVideoPath,
              sourceLanguage,
              targetLanguage
            });
            setProject(created);
            setDocument(null);
            setSelectedLineId(null);
          }, "Project created")
        }
        onAnalyze={() =>
          project
            ? runAction(async () => {
                const analyzed = await runProjectAnalysis(project.projectId);
                setDocument(analyzed.document);
                setSelectedLineId(analyzed.document.lines[0]?.id ?? null);
              }, "Analysis completed")
            : undefined
        }
      />
      <section className="mainGrid">
        <SubtitleLineList
          lines={document?.lines ?? []}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
        />
        <SubtitleEditor
          line={selectedLine}
          busy={busy}
          onChange={updateLine}
          onSave={() =>
            project && document
              ? runAction(async () => {
                  const saved = await saveSubtitleDocument(project.projectId, document);
                  setDocument(saved);
                }, "Saved subtitle edits")
              : undefined
          }
        />
        <ExportPanel
          mode={exportMode}
          result={exportResult}
          disabled={busy || !project || !document}
          onModeChange={setExportMode}
          onExport={() =>
            project
              ? runAction(async () => {
                  setExportResult(await exportSrt(project.projectId, exportMode));
                }, "SRT export completed")
              : undefined
          }
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 9: Add workbench styling**

Create `apps/web/src/App.css` with compact, tool-oriented styles:

```css
:root {
  color: #172026;
  background: #f6f7f8;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.workbench {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr;
}

.topBar,
.statusBar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topBar {
  justify-content: space-between;
  padding: 12px 20px;
  color: #f7fafc;
  background: #18222b;
}

.topBar h1 {
  margin: 0;
  font-size: 20px;
}

.statusBar {
  font-size: 13px;
}

.panel {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid #d8dee4;
  background: #ffffff;
}

.panel h2 {
  margin: 0;
  font-size: 15px;
}

label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}

input,
select,
textarea {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #b9c2ca;
  border-radius: 6px;
  padding: 8px;
  background: #ffffff;
}

textarea {
  min-height: 96px;
  resize: vertical;
}

button {
  border: 1px solid #8aa0b4;
  border-radius: 6px;
  padding: 8px 10px;
  color: #102030;
  background: #eef3f7;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.inlineFields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mainGrid {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(360px, 1fr) minmax(260px, 340px);
  min-height: 0;
}

.subtitleList {
  align-content: start;
}

.lineRows {
  display: grid;
  gap: 6px;
}

.lineRow {
  display: grid;
  grid-template-columns: 80px 130px 1fr;
  gap: 8px;
  text-align: left;
  align-items: center;
}

.lineRow.selected {
  border-color: #167c80;
  background: #e8f6f5;
}
```

Update `apps/web/src/main.tsx` only if it still imports no CSS from `App.tsx`; `App.tsx` imports `./App.css`, so no main change is required unless tests reveal setup issues.

- [ ] **Step 10: Run UI tests and typecheck**

Run:

```powershell
corepack pnpm --filter @diplomat/web test -- App.test.tsx
corepack pnpm --filter @diplomat/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 11: Commit**

```powershell
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/components apps/web/tests/App.test.tsx
git commit -m "feat: add m2a workbench UI"
```

---

### Task 9: M2a Documentation

**Files:**
- Create: `docs/development/m2a-workbench-loop.md`
- Modify: `README.md`

- [ ] **Step 1: Create M2a development documentation**

Create `docs/development/m2a-workbench-loop.md`:

```markdown
# M2a Workbench Loop

M2a is the first usable Diplomat editing loop.

## Included

- Worker API project creation from a local video path.
- Fake-ASR analysis through the existing core pipeline.
- Subtitle document load, edit, and save.
- SRT export in source, target, or bilingual mode.
- React workbench for project setup, subtitle review, line editing, and export status.

## Not Included

- Real faster-whisper execution.
- Translation generation.
- Speaker diarization.
- Waveform and timeline editing.
- Tauri file picker integration.
- VTT, ASS, or burned-in video export.

## Running The Worker

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

The Worker stores development projects under `%LOCALAPPDATA%\Diplomat` by default. Set `DIPLOMAT_DATA_DIR` to override this path.

## Running The Web Workbench

```powershell
corepack pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

## M2a Manual Test

1. Start the Worker.
2. Start the web workbench.
3. Enter a project name and a local video path.
4. Create the project.
5. Run Analyze.
6. Select a subtitle line.
7. Edit source or translated text.
8. Save subtitle edits.
9. Export SRT.

## Verification

```powershell
.\scripts\check.ps1
```
```

- [ ] **Step 2: Update README links**

Append one link under the existing `## Development Docs` list in `README.md`:

```markdown
- [M2a Workbench Loop](docs/development/m2a-workbench-loop.md)
```

- [ ] **Step 3: Run documentation path checks**

Run:

```powershell
Test-Path docs/development/m2a-workbench-loop.md
Test-Path docs/development/m0-m1-core-pipeline.md
```

Expected: both commands print `True`.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/development/m2a-workbench-loop.md
git commit -m "docs: document m2a workbench loop"
```

---

### Task 10: Final Verification

**Files:**
- Modify only if verification exposes a concrete issue.

- [ ] **Step 1: Run full verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected:

- `@diplomat/shared` tests pass, including M2a project/export schemas.
- `@diplomat/web` tests pass, including API client and workbench loop.
- `@diplomat/desktop` metadata command passes.
- TypeScript typechecks pass.
- Python Worker tests pass, including storage, SRT export, and API endpoints.
- Script prints `All M0/M1 checks completed`. The message is older than M2a but acceptable for this plan unless the implementer chooses to rename it to `All checks completed` in the same verification task.

- [ ] **Step 2: Inspect route behavior**

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: API route surface test passes and confirms docs/OpenAPI routes remain disabled.

- [ ] **Step 3: Inspect git history**

Run:

```powershell
git log --oneline -10
```

Expected recent commits include:

```text
docs: document m2a workbench loop
feat: add m2a workbench UI
feat: add web worker api client
feat: add shared m2a api schemas
feat: add m2a worker project endpoints
feat: add worker m2a api schemas
feat: add srt export core
feat: store m2a project metadata
```

- [ ] **Step 4: Confirm clean working tree**

Run:

```powershell
git status --short
```

Expected: no tracked file changes. Generated `worker/*.egg-info/` directories are ignored.

## Plan Self-Review

- M2a storage metadata is covered by Task 1.
- SRT export is covered by Task 2 and Task 5.
- Worker API runtime, schemas, project creation, analysis, subtitle save/load, and export are covered by Tasks 3-5.
- Shared TypeScript contracts are covered by Task 6.
- Web API client and React workbench loop are covered by Tasks 7-8.
- Documentation and final verification are covered by Tasks 9-10.
- Real ASR, translation, waveform, timeline drag editing, Tauri file picker, VTT/ASS, and burn-in are intentionally out of scope for M2a and remain later milestones.
