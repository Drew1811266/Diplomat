# M2a Workbench Loop Implementation Document

This document turns the M2a development plan into an implementation guide for engineers working on Diplomat.

The detailed task checklist remains in:

`docs/superpowers/plans/2026-06-05-diplomat-m2a-workbench-loop.md`

## Objective

M2a creates the first usable Diplomat editing loop:

1. Create a local project from a video path.
2. Probe the video and store project metadata.
3. Run the existing fake-ASR core pipeline through the Worker API.
4. Load the generated internal subtitle document.
5. Edit subtitle line text and timing in the React workbench.
6. Save edits back to the Worker.
7. Export an SRT file.

The goal is not production AI quality. The goal is a reliable end-to-end product slice that can be tested, demonstrated, and extended.

## Current Baseline

M0/M1 already provides:

- Monorepo foundation.
- MIT license and development scripts.
- Shared TypeScript subtitle/task schemas.
- Python Pydantic subtitle/task schemas.
- SQLite `ProjectStore`.
- FFmpeg probing and audio extraction helpers.
- Fixed-size chunk planning.
- Fake ASR and optional faster-whisper adapter.
- Core pipeline that writes `subtitle.diplomat.json`.
- Minimal FastAPI `/health` endpoint.
- Minimal React/Tauri shells.

M2a builds on this baseline without replacing it.

## Non-Goals

M2a must not expand into later milestones:

- No real model manager.
- No real faster-whisper setup UI.
- No translation generation.
- No speaker diarization.
- No waveform view.
- No timeline drag editing.
- No Tauri file picker.
- No VTT/ASS export.
- No subtitle burn-in.
- No background job queue.

These are separate M2b/M3/M4 work items.

## Implementation Order

Implement in this order:

1. Storage metadata.
2. SRT export core.
3. Worker runtime and API schemas.
4. Worker project/analyze/subtitle endpoints.
5. Worker SRT export endpoint.
6. Shared TypeScript M2a schemas.
7. Web Worker API client.
8. React workbench UI.
9. M2a docs.
10. Full verification.

Each step must land as a focused commit after its tests pass.

## Module Responsibilities

### Python Worker

The Worker owns durable state and all file-producing operations.

Responsibilities:

- Create projects.
- Probe media.
- Run the fake-ASR core pipeline.
- Read and write `subtitle.diplomat.json`.
- Export SRT files.
- Return typed JSON responses to the UI.

The Worker must remain testable without real FFmpeg or real AI models. Runtime dependencies are injected through `WorkerRuntime`.

### Shared TypeScript Package

`packages/shared` owns frontend contracts:

- Project request/response schemas.
- Analyze response schema.
- Subtitle document request schema.
- SRT export request/response schemas.

The web app must parse Worker responses through Zod before trusting them.

### React Workbench

The React app owns the editing experience:

- Project setup controls.
- Analyze command.
- Subtitle line list.
- Selected line editor.
- Save command.
- SRT export controls.
- Status and error messages.

The M2a UI should be dense and tool-oriented. It should not become a marketing screen or decorative landing page.

## Worker Data Model

Extend `ProjectRecord` with:

```python
duration_ms: int
source_language: str
target_language: str | None
```

Persist the same fields in SQLite:

```sql
duration_ms INTEGER NOT NULL
source_language TEXT NOT NULL
target_language TEXT
```

Validation rules:

- `duration_ms >= 0`
- `source_language` length is at least 2
- `target_language` is null or length is at least 2

Existing subtitle save behavior must keep rejecting mismatched `project_id` values.

## Worker API Contract

### Health

`GET /health`

Returns:

```json
{
  "name": "diplomat-worker",
  "status": "ok",
  "version": "0.1.0"
}
```

### Create Project

`POST /projects`

Request:

```json
{
  "name": "Demo",
  "sourceVideoPath": "D:/Videos/demo.mp4",
  "sourceLanguage": "zh",
  "targetLanguage": "en"
}
```

Behavior:

- Probe video.
- Reject sources with no audio stream.
- Create a project in `ProjectStore`.
- Return project metadata.

Response:

```json
{
  "projectId": "project-...",
  "name": "Demo",
  "sourceVideoPath": "D:/Videos/demo.mp4",
  "projectDir": "D:/.../projects/project-...",
  "durationMs": 65000,
  "sourceLanguage": "zh",
  "targetLanguage": "en"
}
```

### Get Project

`GET /projects/{project_id}`

Returns the same project metadata shape as project creation.

### Analyze Project

`POST /projects/{project_id}/analyze`

Behavior:

- Load project metadata.
- Run `run_core_pipeline()` with `FakeTranscriber`.
- Write `subtitle.diplomat.json`.
- Return the generated document.

Response:

```json
{
  "projectId": "project-...",
  "status": "completed",
  "subtitlePath": "D:/.../subtitle.diplomat.json",
  "lineCount": 3,
  "document": {
    "schemaVersion": "diplomat.subtitle.v1",
    "projectId": "project-...",
    "mediaId": "media-1",
    "durationMs": 65000,
    "speakers": [],
    "styles": [],
    "lines": []
  }
}
```

### Load Subtitle Document

`GET /projects/{project_id}/subtitle`

Returns the internal subtitle document.

Expected errors:

- `404` if project does not exist.
- `404` if subtitle document has not been generated yet.

### Save Subtitle Document

`PUT /projects/{project_id}/subtitle`

Request:

```json
{
  "document": {
    "schemaVersion": "diplomat.subtitle.v1",
    "projectId": "project-...",
    "mediaId": "media-1",
    "durationMs": 65000,
    "speakers": [],
    "styles": [],
    "lines": []
  }
}
```

Behavior:

- Validate with Pydantic.
- Reject mismatched `document.projectId`.
- Persist to `subtitle.diplomat.json`.
- Return the saved document.

### Export SRT

`POST /projects/{project_id}/exports/srt`

Request:

```json
{
  "mode": "bilingual"
}
```

Allowed modes:

- `source`
- `target`
- `bilingual`

Response:

```json
{
  "projectId": "project-...",
  "exportPath": "D:/.../exports/subtitle-bilingual.srt",
  "mode": "bilingual"
}
```

## SRT Export Rules

Implement `worker/diplomat_worker/export/srt.py`.

Rules:

- Sort lines by `(start_ms, end_ms, id)`.
- Format timestamps as `HH:MM:SS,mmm`.
- Skip empty rendered lines.
- `source` mode writes `source_text`.
- `target` mode writes `translated_text` if present, otherwise `source_text`.
- `bilingual` mode writes `source_text` and `translated_text` on separate lines when both exist and differ.
- Write exports to `project_dir/exports/subtitle-{mode}.srt`.
- Never overwrite source video files.

## React Workbench Behavior

The M2a workbench has one screen.

Required areas:

- Top status bar.
- Project setup panel.
- Subtitle line list.
- Selected subtitle editor.
- SRT export panel.

Required user flow:

1. User enters project name.
2. User enters source video path.
3. User chooses source and target language codes.
4. User clicks `Create Project`.
5. User clicks `Analyze`.
6. UI renders generated fake-ASR subtitle lines.
7. User selects a subtitle line.
8. User edits source text, translated text, start time, or end time.
9. User clicks `Save Subtitle`.
10. User clicks `Export SRT`.
11. UI shows the exported SRT path.

UI requirements:

- All form controls have visible labels.
- Busy states disable commands that would duplicate requests.
- Errors render with `role="alert"`.
- Status updates use an ARIA live region.
- Layout is compact and workbench-like.

## Testing Strategy

Follow TDD for every task.

Required Python tests:

- Project metadata persistence.
- SRT timestamp formatting.
- SRT line ordering.
- SRT source/target/bilingual modes.
- SRT parent directory creation.
- Worker route surface.
- Create project endpoint.
- Analyze endpoint.
- Subtitle load/save round trip.
- SRT export endpoint.

Required TypeScript tests:

- Shared project schemas.
- Shared export schemas.
- Worker API client helpers.
- React workbench loop with mocked Worker responses.

Required full verification:

```powershell
.\scripts\check.ps1
```

Expected:

- shared tests pass.
- web tests pass.
- desktop metadata/typecheck commands pass.
- Python tests pass.
- TypeScript typechecks pass.

## Error Handling

M2a should keep errors simple and actionable:

- Missing project: `404 Project not found`.
- Missing subtitle document: `404 Subtitle document not found`.
- Video probe failure: `400 Unable to probe source video`.
- No audio stream: `400 Source video does not contain an audio stream`.
- Subtitle project mismatch: `400 document.project_id must match project_id`.

The React app displays these messages through the status bar error area.

## Execution Checklist

Before implementation:

- Start from a clean `master`.
- Create an isolated feature worktree or branch.
- Confirm `.\scripts\check.ps1` passes on the starting point.

During implementation:

- Keep one commit per task.
- Run focused tests before committing.
- Do not introduce real model dependencies.
- Do not expand the UI beyond the M2a loop.
- Preserve existing M0/M1 behavior.

Before merge:

- Run `.\scripts\check.ps1`.
- Review `git log --oneline -10`.
- Confirm `git status --short` is clean.
- Perform final code review against this document and the detailed plan.

## Acceptance Criteria

M2a is complete when:

- A developer can start the Worker and web workbench.
- A project can be created from a local video path.
- Analyze generates fake-ASR subtitle lines through the Worker API.
- Subtitle lines are visible in React.
- A selected line can be edited and saved.
- Saved edits persist in `subtitle.diplomat.json`.
- SRT export writes a real `.srt` file under the project exports folder.
- All tests and typechecks pass through `.\scripts\check.ps1`.
