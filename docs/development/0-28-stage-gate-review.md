# Diplomat 0.28 Stage Gate Review

Date: 2026-06-14

Stage: 0.28 Export Visual Styles

Branch: `codex/0.28-subtitle-export-visual-styles`

## Scope Accepted

0.28 adds general subtitle export and visual export preparation:

- SRT, VTT, and ASS text subtitle export.
- Source, target, and bilingual export modes.
- Worker-side timing validation with blocking errors and non-blocking warnings.
- Project-scoped subtitle style presets with create, update, rename, apply, delete, backup, and import preservation.
- Workbench export inspector controls for format, mode, style, presets, safe-area overlay, and validation summaries.
- Live video subtitle preview using the active style draft.
- Legacy `/projects/{project_id}/exports/srt` compatibility route.

## Commits Reviewed

- `2424a02 docs: plan 0.28 export visual styles`
- `9b01fab feat(shared): add subtitle export and style contracts`
- `20bab84 feat(worker): add vtt and ass subtitle export`
- `951f72a feat(worker): add style presets and subtitle export API`
- `d73e4c3 feat(web): add subtitle export and style preset helpers`
- `d8ff3db feat(web): integrate export style editor`
- `6a1c97d test(web): update export style e2e coverage`

## Focused Verification

All focused verification commands exited with status 0.

```powershell
corepack pnpm --dir packages/shared test
```

Result: 5 test files, 45 tests passed.

```powershell
python -m pytest worker/tests/export/test_text_subtitles.py worker/tests/export/test_srt.py worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
```

Result: 105 tests passed.

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleStyles.test.ts src/components/VideoPreviewPanel.test.tsx src/components/inspectors/ExportInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Result: 5 test files, 82 tests passed.

```powershell
corepack pnpm --dir apps/web typecheck
```

Result: TypeScript completed with no errors.

## Full Verification

```powershell
.\scripts\check.ps1
```

Latest result on the final 0.28 worktree:

- Desktop Rust tests: 13 passed.
- Shared package tests: 45 passed.
- Web Vitest suite: 27 test files, 163 tests passed.
- TypeScript package checks: desktop placeholder, shared, and web passed.
- Worker pytest suite: 206 passed.
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

- Project center loads a real project fixture and language switching still works.
- Workbench opens a project and exports through `/exports/subtitles`.
- The deterministic workbench screenshot was updated for the 0.28 subtitle preview overlay.
- Desktop smoke target still opens the project center.

## Browser Smoke

Manual browser smoke used an isolated runtime:

- Worker: `http://127.0.0.1:8765`
- Web: `http://127.0.0.1:1420`
- Data directory: `.tmp/smoke-0.28/data`
- Seed project: `project-50fcb79265d1497aa7a2ae85235c2a18`

Verified through the in-app Browser:

- Project appears in Project Center and opens into Workbench.
- Subtitle row text appears and can be selected for preview.
- Export inspector opens from the Workbench toolbar.
- SRT bilingual export succeeds.
- VTT target export succeeds.
- ASS bilingual export succeeds.
- Font size changes update the live subtitle preview.
- Safe-area overlay appears when toggled.
- Style preset save, rename, apply, update, delete work.
- A temporary preset remains visible after reload, proving persistence, then deletes cleanly.
- Overlapping cue timings disable export with `Fix timing errors before exporting.`
- Warning-only timing issues keep export enabled and export succeeds.
- Browser console error count: 0.

Export files inspected:

- `.tmp/smoke-0.28/data/projects/project-50fcb79265d1497aa7a2ae85235c2a18/exports/subtitle-bilingual.srt`
- `.tmp/smoke-0.28/data/projects/project-50fcb79265d1497aa7a2ae85235c2a18/exports/subtitle-target.vtt`
- `.tmp/smoke-0.28/data/projects/project-50fcb79265d1497aa7a2ae85235c2a18/exports/subtitle-bilingual.ass`

File checks:

- VTT starts with `WEBVTT`.
- ASS contains `[V4+ Styles]`, `[Events]`, and `Dialogue:` rows.
- SRT contains numbered cues and bilingual text.

## Known Limitations

- SRT and VTT are plain text formats; visual style controls are persisted and previewed, but only ASS carries rich styling in exported subtitle text.
- ASS output uses named fonts from the subtitle style. Final appearance depends on OS font availability in the playback application.
- The browser smoke used a placeholder media file because `ffmpeg` was not available on PATH in this environment. The smoke validated subtitle overlay and export behavior, not video decoding.
- 0.28 does not implement burned-in video export. That remains outside this stage.

## Decision

0.28 meets the stage goal and is accepted for merge to `main`.
