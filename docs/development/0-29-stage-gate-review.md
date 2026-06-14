# Diplomat 0.29 Stage Gate Review

Date: 2026-06-14

Stage: 0.29 Burn-In Video Export

Branch: `codex/0.29-burn-in-video-export`

## Scope Accepted

0.29 adds burned-in video export as a production workflow:

- Shared burn-in export request contract for mode, style, output path, codec, CRF, and preset.
- Worker-side MP4 render engine using ASS intermediate subtitles and FFmpeg `subtitles` filter.
- Project-scoped output path safety, source overwrite protection, command list arguments, and FFmpeg filter path escaping.
- Background export tasks with progress, completion, cancellation, retry, diagnostics, and pre-render subtitle snapshot.
- Worker API route `POST /projects/{project_id}/exports/video`.
- Existing task cancel and retry routes dispatch export tasks.
- Web API and React Query helpers for burn-in export.
- Export inspector controls for rendering video, export task progress, cancel, retry, and opening the exports folder.
- Workbench integration using the active export mode and style draft.
- E2E fixture coverage for the burn-in export UI path.

## Commits Reviewed

- `dc9334c docs: plan 0.29 burn-in video export`
- `0b59077 feat(shared): add burn-in export contract`
- `448da8f feat(worker): add burn-in export engine`
- `118ffe1 feat(worker): add burn-in export task manager`
- `dd894dd feat(worker): expose burn-in export task api`
- `f43eea4 feat(web): add burn-in export api helper`
- `b187d61 feat(web): add burn-in export controls`
- `84d0dd8 feat(web): integrate burn-in video export`

## Focused Verification

All focused verification commands exited with status 0.

```powershell
corepack pnpm --dir packages/shared test
```

Result: 5 test files, 47 tests passed.

```powershell
python -m pytest worker/tests/export/test_burn_in.py worker/tests/tasks/test_export_jobs.py worker/tests/api/test_app.py -q
```

Result: 73 focused Worker tests passed.

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Result: 3 test files, 78 tests passed.

```powershell
corepack pnpm --dir apps/web typecheck
```

Result: TypeScript completed with no errors.

```powershell
corepack pnpm --dir apps/web e2e
```

Result: 4 Playwright tests passed.

## Full Verification

```powershell
.\scripts\check.ps1
```

Latest result on the final 0.29 worktree:

- Desktop Rust tests: 13 passed.
- Shared package tests: 47 passed.
- Web Vitest suite: 27 test files, 166 tests passed.
- TypeScript package checks: desktop placeholder, shared, and web passed.
- Worker pytest suite: 224 passed.
- Script completed with `All M0/M1 checks completed`.

The command emitted only existing toolchain notices:

- `pnpm` ignored `esbuild` build scripts until approved.
- Node deprecation warning for `url.parse()`.
- Pip update notice.

## Playwright E2E

```powershell
corepack pnpm --dir apps/web e2e
```

Result: 4 tests passed.

Coverage:

- Project center loads a recent project fixture and language switching still works.
- Workbench opens a project, exports subtitle text, and starts a burn-in export task through the fixture route.
- The deterministic workbench screenshot remains stable.
- Desktop smoke target still opens the project center.

## Browser Smoke

Manual browser smoke used an isolated runtime:

- Worker: `http://127.0.0.1:8765`
- Web: `http://127.0.0.1:1420`
- Data directory: `.dev/verify-0.29/smoke/data`
- Seed project: `project-c5d5235e954c4cdcbaa5e40c39bac6c1`
- Temporary FFmpeg: Gyan FFmpeg 8.1.1 Essentials downloaded to `.dev/verify-0.29/winget-ffmpeg`

Verified through the in-app Browser:

- Project appears in Project Center and opens into Workbench.
- Saved bilingual subtitle row appears in the grid and timeline.
- Export inspector opens from the Workbench toolbar.
- Burn-in render starts from the `Render video` action.
- UI reports `Burn-in export completed` and `100%`.
- Browser console error count: 0.
- Worker and Web smoke processes were stopped after verification.

Rendered output:

```text
.dev/verify-0.29/smoke/data/projects/project-c5d5235e954c4cdcbaa5e40c39bac6c1/exports/burn-in-bilingual-task-e078f60234814a8e9a0574ef0fa7e111.mp4
```

File checks:

- Output size: 57,189 bytes.
- `ffprobe` reports a 2.000 second MP4.
- Video stream: H.264, 640x360, 24 fps, 48 frames.
- Audio stream: AAC mono, 44.1 kHz.
- Extracted frame at 1 second shows the Chinese source line and English translation visibly burned into the video.

## Cancel And Retry Evidence

Cancel and retry behavior is covered by automated tests rather than the short-video browser smoke:

- Worker task tests cover queued export cancellation, rejected retry for running tasks, and fresh task creation when retrying canceled or failed export tasks.
- API tests cover export task dispatch through `/tasks/{task_id}/cancel` and `/tasks/{task_id}/retry`.
- Web component and Workbench tests cover cancel and retry button wiring for export tasks.

## Known Limitations

- 0.29 exposes a browser-mode default output path only. External output path picking remains future desktop bridge work.
- Render options are intentionally narrow: MP4, H.264 `libx264`, CRF, and preset. Hardware encoders, resolution controls, and audio fallback UI are not included.
- The Worker requires a usable FFmpeg and FFprobe installation. This repository does not bundle FFmpeg binaries.
- Visual output depends on OS font availability. 0.29 does not implement font discovery or embedding.
- Running FFmpeg cancellation is implemented through task cancellation tokens and process termination, but the browser smoke used a short successful render rather than a long interactive cancel run.

## Decision

0.29 meets the stage goal and is accepted for merge to `main`.
