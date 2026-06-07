# M3 Real ASR MVP

M3 moves Diplomat from a synchronous fake-ASR demo path to a background analysis job workflow. The Worker now owns long-running transcription work, task state, diagnostics, cancellation, retry, and subtitle document updates. The Web workbench starts jobs, polls task state, shows progress, and keeps fake ASR available for deterministic tests and demos.

## Included

- Task records stored in SQLite schema version `3`.
- Analysis task statuses: `queued`, `running`, `canceling`, `canceled`, `failed`, and `completed`.
- Analysis job endpoints:
  - `POST /projects/{project_id}/analysis-jobs`
  - `GET /tasks/{task_id}`
  - `POST /tasks/{task_id}/cancel`
  - `POST /tasks/{task_id}/retry`
- Cancellable Worker-side analysis manager backed by a local thread executor.
- Diagnostic log files under each project directory at `logs/task-<task_id>.log`.
- ASR provider configuration for `fake` and `faster-whisper`.
- Progress and cancellation hooks through audio extraction and ASR.
- Web model configuration panel, progress bar, cancel button, retry button, and failure diagnostics.
- Compatibility `POST /projects/{project_id}/analyze` endpoint for deterministic synchronous callers.

## Not Included

- Translation generation.
- Speaker diarization.
- Waveform or timeline editing.
- VTT, ASS, styled subtitle export, or burned-in video export.
- Model download UI.
- Bundled third-party ASR model weights.
- Production packaging or signed installer behavior.

## Repository And Model Licensing

Diplomat source code is MIT licensed. Third-party AI model weights are not committed to this repository and keep their upstream licenses. Developers are responsible for selecting, downloading, caching, and licensing local ASR models.

For repeatable local development, prefer a local model directory in the workbench `Model name or path` field. A model name such as `tiny` may use the provider library's download/cache behavior depending on the local `faster-whisper` installation.

## Install Optional ASR Dependencies

The default Worker development install keeps only fake ASR and test dependencies:

```powershell
python -m pip install -e ".\worker[dev]"
```

Install real ASR support with the optional `asr` extra:

```powershell
python -m pip install -e ".\worker[dev,asr]"
```

M3 defaults are conservative for a Windows development machine:

- Provider: `fake` for deterministic tests, `faster-whisper` for real local transcription.
- Model: `tiny`, `base`, `small`, or a local faster-whisper/CTranslate2 model directory.
- Device: `cpu`.
- Compute type: `int8`.
- Source language: `zh`, `en`, or another provider-supported language code.

## Running The Browser Workbench

Start the Worker:

```powershell
$env:DIPLOMAT_DATA_DIR = Join-Path (Get-Location) ".dev\data"
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

Start the Web workbench:

```powershell
corepack pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

Browser mode cannot use native desktop file selection. Enter an absolute source video path manually. The file must exist and FFmpeg/FFprobe must be available on `PATH` because the Worker still probes the video and extracts audio before either fake or real ASR runs.

## Running The Desktop Development App

```powershell
corepack pnpm --filter @diplomat/desktop dev
```

The desktop shell can start the Worker and pick a local video path. M3 uses the same Worker endpoint, so the browser and desktop workbenches share the same analysis job behavior.

## Analysis Job API

Create an analysis job:

```http
POST /projects/{project_id}/analysis-jobs
```

Request body:

```json
{
  "provider": "faster-whisper",
  "modelNameOrPath": "tiny",
  "device": "cpu",
  "computeType": "int8",
  "sourceLanguage": "zh",
  "initialPrompt": null
}
```

Response body:

```json
{
  "taskId": "task-...",
  "projectId": "project-...",
  "type": "analysis",
  "status": "queued",
  "progress": 0,
  "message": "Queued analysis",
  "startedAt": null,
  "updatedAt": "2026-06-07T00:00:00+00:00",
  "completedAt": null,
  "errorCode": null,
  "errorMessage": null,
  "diagnosticLogPath": null
}
```

Poll a task:

```http
GET /tasks/{task_id}
```

Cancel a task:

```http
POST /tasks/{task_id}/cancel
```

Retry a failed or canceled task:

```http
POST /tasks/{task_id}/retry
```

The retry endpoint creates a new task. Without a request body, it reuses the original request payload. With a request body, it uses the replacement ASR configuration so the user can correct a failed model path or provider setting before retrying. The Web workbench follows the returned task ID.

## Worker Task Behavior

The analysis manager runs at most one queued analysis task at a time in the default development runtime. A task moves through this shape:

1. `queued`: stored before background execution begins.
2. `running`: FFmpeg preflight, audio extraction, and ASR are active.
3. `canceling`: cancellation has been requested for an active task.
4. `canceled`: execution observed the cancellation token and stopped.
5. `failed`: FFmpeg, ASR, storage, or provider setup failed.
6. `completed`: a subtitle document was written and can be opened by the editor.

The Worker writes diagnostic log entries to the project log path. Failure responses include `diagnosticLogPath` when the path is known.

## Web Workbench Workflow

1. Create or reopen a project.
2. Choose an ASR provider.
3. Enter a model name or local model path.
4. Keep `cpu` and `int8` for the safest first run.
5. Start analysis.
6. Watch the task message and progress bar.
7. Cancel while a task is active, or retry after `failed`/`canceled`.
8. When the task completes, edit and save generated subtitle lines through the existing editor.
9. Export SRT through the existing export panel.

Subtitle editing and export are disabled while an analysis task is active because completion replaces the current subtitle document.

## Manual M3 Test

Fake ASR path:

1. Start the Worker and Web workbench.
2. Create a project from a short local video that FFmpeg can probe.
3. Keep provider `fake`.
4. Start analysis.
5. Confirm progress appears and the task completes.
6. Confirm generated subtitle lines load in the editor.
7. Save one subtitle edit and export SRT.

Real faster-whisper path:

1. Install Worker ASR dependencies with `python -m pip install -e ".\worker[dev,asr]"`.
2. Make sure FFmpeg and FFprobe are available on `PATH`.
3. Create a project from a short local video with speech.
4. Set provider to `faster-whisper`.
5. Enter a small model name or a local model directory.
6. Use `cpu` and `int8` for the first run.
7. Start analysis and wait for completion.
8. Confirm generated subtitle text roughly matches the speech.
9. Start another run and cancel it to confirm the task reaches `canceled`.
10. Force a failure with a bad model path, then correct the path and retry.

## Verification

Focused checks used during M3:

```powershell
python -m pytest worker/tests -q
corepack pnpm --filter @diplomat/shared test
corepack pnpm --filter @diplomat/web test
corepack pnpm --filter @diplomat/web typecheck
```

Full stage checks:

```powershell
.\scripts\check.ps1
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Known Limitations

- Real ASR execution depends on the local `faster-whisper` install, available compute, model files, and upstream model behavior.
- Cancel requests are cooperative. They are checked at Worker boundaries and during segment iteration, but some provider internals may not stop immediately.
- Faster-whisper progress is approximate because the provider does not expose exact total segment count up front.
- The workbench does not yet persist a reusable model profile outside task request payloads.
- There is no model download, model validation, or license review UI.
- Translation and bilingual subtitle generation are M4 scope.
- Professional video preview, waveform, and timing tools are M5 scope.
- VTT, ASS, styled output, and burned-in video export are M6 scope.

## M3 Stage Gate Checklist

- Background task state is represented in storage and API responses.
- Fake ASR still passes deterministic tests.
- Analysis success, failure, cancellation, and retry are test-covered.
- The Web workbench can start, poll, cancel, and retry analysis jobs.
- Completed jobs load editable subtitles.
- Full repository checks pass.
- Model weights remain outside the repository.
