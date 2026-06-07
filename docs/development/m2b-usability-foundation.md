# M2b Usability Foundation

M2b turns the M2a developer workbench into a more usable local desktop workflow. It keeps fake ASR and the existing subtitle editor, but removes several early-stage obstacles around Worker startup, file selection, project reopening, and storage migration.

M3 supersedes M2b's synchronous fake analysis path with background analysis jobs and optional faster-whisper transcription. Keep this document as the M2b stage record; use [M3 Real ASR MVP](m3-real-asr-mvp.md) for the current analysis workflow.

## Included

- Worker project listing through `GET /projects`.
- Project reopening through `GET /projects/{project_id}` and subtitle reload.
- Project metadata with `createdAt`, `updatedAt`, and `hasSubtitleDocument`.
- SQLite migration from M2a and older minimal project tables.
- Desktop-native commands for video picking, Worker start/stop/status, and opening paths in the file manager.
- Browser fallback for manual source path entry.
- React project library panel for recent projects.
- Automatic Worker startup attempt when the React app is running inside Tauri and the Worker is not reachable.
- Temporary Tauri icons so desktop dev builds can compile.

## Not Included

- Real ASR.
- Translation generation.
- Speaker diarization.
- Waveform or timeline editing.
- VTT, ASS, or burned-in video export.
- Destructive project deletion.
- Packaged installer or signed release build.

## Running The Browser Workbench

Start the Worker:

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

Start the Web workbench:

```powershell
corepack pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

Browser-only mode keeps the manual source path field because browser pages cannot open native desktop file dialogs or start local processes safely.

## Running The Desktop Development App

```powershell
corepack pnpm --filter @diplomat/desktop dev
```

The desktop shell exposes these commands to the React workbench:

- `pick_video_file`
- `start_worker`
- `stop_worker`
- `worker_status`
- `open_path_in_file_manager`

When the workbench starts inside Tauri and the Worker health check fails, the app calls `start_worker`, then retries health and project-list loading. Worker logs are written under `%LOCALAPPDATA%\Diplomat\logs` when `%LOCALAPPDATA%` is available, otherwise under the system temp directory.

## Storage Behavior

The Worker stores data in `%LOCALAPPDATA%\Diplomat` by default. Set `DIPLOMAT_DATA_DIR` to override it.

M2b stores schema version `2` in `app_metadata`. On startup, `ProjectStore` creates or migrates the `projects` table. Existing M2a rows are preserved and receive an `updated_at` value derived from `created_at`. Older minimal rows are backfilled with safe development defaults:

- `source_video_path`: empty string
- `project_dir`: `<data-dir>/projects/<project_id>`
- `duration_ms`: `0`
- `source_language`: `und`
- `target_language`: `NULL`
- `created_at`: current UTC time when missing
- `updated_at`: `created_at`

Subtitle documents are not rewritten during migration.

## M2b Manual Test

1. Start the desktop development app with `corepack pnpm --filter @diplomat/desktop dev`.
2. Confirm the Worker status becomes `ok` without manually starting a separate Worker terminal.
3. Click `Pick Video` and select a local video file.
4. Confirm the selected path appears in `Source video path`.
5. Create a project.
6. Confirm the project appears under `Recent Projects`.
7. Run analysis.
8. Edit one subtitle line and save it.
9. Close and reopen the app.
10. Reopen the project from `Recent Projects`.
11. Confirm the saved subtitle document loads.
12. Export SRT and confirm the export path is shown.

## Known Limitations

- Analysis still uses fake ASR.
- Desktop Worker startup assumes `python` and the editable Worker dependencies are available in the developer environment.
- File picking is available only in Tauri desktop runtime; browser mode keeps manual path entry.
- The project library is local-only and does not yet support delete, search, tags, or batch operations.
- The temporary icon is not final branding.
