# M2a Workbench Loop

M2a is the first usable Diplomat editing loop. It connects local project creation, analysis, subtitle review, line editing, save, and export into one end-to-end workflow for development testing.

## Included

- Worker API project creation from a local video path.
- Fake-ASR analysis through the existing core pipeline.
- Subtitle document load, edit, and save.
- SRT export in source, target, and bilingual mode.
- React workbench for setup, review, line editing, and export status.

## Not Included

- Real faster-whisper execution.
- Translation generation.
- Speaker diarization.
- Waveform or timeline editing.
- Tauri file picker integration.
- VTT, ASS, or burned-in video export.

## Running The Worker

```powershell
python -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765
```

The Worker stores data in `%LOCALAPPDATA%\Diplomat` by default. Set `DIPLOMAT_DATA_DIR` to override the storage location.

## Running The Web Workbench

```powershell
corepack pnpm --filter @diplomat/web dev
```

Open `http://localhost:1420`.

## M2a Manual Test

1. Start the Worker.
2. Start the web workbench.
3. Enter a project name and local video path.
4. Create the project.
5. Run analysis.
6. Select a subtitle line.
7. Edit source and translated text.
8. Save edits.
9. Export SRT.

## Verification

```powershell
.\scripts\check.ps1
```
