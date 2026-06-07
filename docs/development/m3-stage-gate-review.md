# M3 Stage Gate Review

Date: 2026-06-07

Branch: `codex/m3-real-asr-mvp`

## Gate Decision

M3 is accepted.

The implementation, automated checks, browser workbench shell verification, fake-ASR media run, real faster-whisper media run, cancellation path, and failed-model retry path all passed in this environment.

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
- Manual fake-ASR media verification passed with a generated local speech video.
- Manual real faster-whisper verification passed with `tiny.en`.
- Cancellation of an active real-ASR task reached `canceled`.
- Retry after a bad model path succeeded after replacing the retry request config with `tiny.en`.

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

Fake-ASR media verification:

- Local FFmpeg/FFprobe was downloaded into `.dev/tools` and injected into the Worker process `PATH`.
- A local TTS video was generated at `.dev/samples/speech.mp4`.
- `POST /projects/{project_id}/analysis-jobs` with provider `fake` completed.
- Result:
  - status: `completed`
  - progress: `1.0`
  - subtitle lines: `1`
  - first source line: `Fake transcript chunk 0`

Real faster-whisper verification:

- Worker ASR dependencies were installed with `python -m pip install -e ".\worker[dev,asr]"`.
- Installed versions:
  - `faster-whisper`: `1.2.1`
  - `ctranslate2`: `4.8.0`
- `POST /projects/{project_id}/analysis-jobs` with provider `faster-whisper`, model `tiny.en`, device `cpu`, and compute type `int8` completed.
- Result:
  - status: `completed`
  - progress: `1.0`
  - subtitle lines: `1`
  - first source line: `Hello world. This is a Diplomat subtitle test. The local transcription should create editable English subtitles.`

Cancellation verification:

- A real-ASR job was started and immediately canceled.
- Initial cancel response reached `canceling`.
- Final task state reached `canceled`.
- Final message: `Analysis canceled`.

Failed-model retry verification:

- A real-ASR job was started with a nonexistent local model path.
- The job reached `failed` with an actionable faster-whisper model error.
- `POST /tasks/{task_id}/retry` was called with replacement config using model `tiny.en`.
- Retry task completed and wrote the same expected subtitle text.

## Local Verification Artifacts

The following artifacts are intentionally local-only and ignored by Git:

- `.dev/tools`: downloaded FFmpeg/FFprobe binaries.
- `.dev/samples/speech.wav`
- `.dev/samples/speech.mp4`
- `.dev/data`: verification projects, subtitle documents, and task diagnostics.

Model weights and provider caches remain outside the repository and keep their upstream licenses.

## Stage Gate Outcome

M3 satisfies the roadmap acceptance criteria and can be merged before starting M4.
