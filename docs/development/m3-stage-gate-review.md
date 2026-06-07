# M3 Stage Gate Review

Date: 2026-06-07

Branch: `codex/m3-real-asr-mvp`

## Gate Decision

M3 is implementation-complete and automated-verification-complete, but the product stage gate is not fully accepted in this environment.

Do not start M4 until the manual real-ASR acceptance path is verified, or until the project owner explicitly accepts deferring that environment-dependent check.

## Passed

- Task storage and SQLite schema version `3` are implemented and tested.
- Background analysis jobs support `queued`, `running`, `canceling`, `canceled`, `failed`, and `completed`.
- Worker endpoints are implemented:
  - `POST /projects/{project_id}/analysis-jobs`
  - `GET /tasks/{task_id}`
  - `POST /tasks/{task_id}/cancel`
  - `POST /tasks/{task_id}/retry`
- Retry can reuse the original request or accept replacement ASR config, allowing a corrected model path/provider setting.
- Fake ASR remains deterministic for tests and demos.
- Faster-whisper provider configuration path exists behind optional `worker[asr]` dependencies.
- Web workbench exposes ASR provider/model controls, progress, cancel, retry, and diagnostics.
- Completed analysis jobs load editable subtitle documents through the existing editor.
- Model weights remain outside the repository.
- M3 development documentation is present at `docs/development/m3-real-asr-mvp.md`.

## Verification Evidence

Automated checks:

```powershell
.\scripts\check.ps1
```

Result:

- Shared package: 19 tests passed.
- Web app: 27 tests passed.
- Worker: 80 tests passed.
- Desktop Rust tests: 4 tests passed.
- TypeScript typechecks passed.

Desktop check:

```powershell
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Result: passed.

Browser shell verification:

- M3 Worker started from this worktree on `http://127.0.0.1:8765`.
- M3 Web workbench started from this worktree on `http://localhost:1420`.
- Worker health returned `{"name":"diplomat-worker","status":"ok","version":"0.1.0"}`.
- Browser DOM showed:
  - `Worker: ok`
  - `Recent Projects`
  - `Analysis`
  - `ASR provider`
  - `fake`
  - `faster-whisper`
  - `Start Analysis`
  - `Cancel Analysis`
  - `Retry Analysis`
  - `Analysis progress`

## Not Verified

Manual fake-ASR media run was not executed because the current environment has no `ffmpeg` or `ffprobe` command on `PATH`, and the repository has no checked-in media fixture.

Manual real-ASR run was not executed because:

- `faster_whisper` is not installed in the current Python environment.
- No local faster-whisper model path is configured.
- No short local speech video was available for the manual acceptance test.
- `ffmpeg` and `ffprobe` are unavailable on `PATH`.

## Required Follow-Up To Accept M3

1. Install FFmpeg and FFprobe or provide absolute executable paths through the Worker runtime.
2. Install real ASR dependencies:

   ```powershell
   python -m pip install -e ".\worker[dev,asr]"
   ```

3. Provide a short local video with speech.
4. Run the documented real faster-whisper manual test in `docs/development/m3-real-asr-mvp.md`.
5. Confirm:
   - real transcription completes,
   - generated subtitle text approximately matches speech,
   - subtitles are editable and saveable,
   - cancel reaches `canceled`,
   - retry works after correcting a bad model path.

Only after those checks pass should M3 be merged and M4 begin under the strict stage-gate rule.
