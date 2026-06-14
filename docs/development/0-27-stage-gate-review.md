# Diplomat 0.27 Stage Gate Review

Date: 2026-06-14
Branch: `codex/0.27-editing-workflow-safety`

## Scope Reviewed

- `ab4c586 docs: plan 0.27 editing workflow polish`
- `d6f0dd2 feat(shared): add draft snapshot contracts`
- `f2072d0 feat(worker): persist subtitle drafts and snapshots`
- `8bdf98a feat(worker): expose draft and snapshot APIs`
- `6a2a503 feat(web): add editing workflow helpers`
- `4370247 feat(web): add editor workflow panels`
- `7fe3b86 feat(web): integrate editing workflow safety`

## Acceptance Result

0.27 is accepted for merge. The stage implements durable subtitle drafts, recoverable snapshots, risky overwrite snapshots, command bar editing, autosave, undo/redo, split/merge, batch offset snapshots, recovery UI, shortcut handling, and export protection while unresolved drafts exist.

## Focused Verification

- `corepack pnpm --dir packages/shared test`
  - Passed: 5 files, 40 tests.
- `python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q`
  - Passed.
- `corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/lib/subtitleEditing.test.ts src/components/EditorCommandBar.test.tsx src/components/RecoveryPanel.test.tsx src/pages/WorkbenchPage.test.tsx`
  - Passed: 5 files, 77 tests.
- `corepack pnpm --dir apps/web typecheck`
  - Passed.

## Full Verification

- `.\scripts\check.ps1`
  - Passed.
  - Desktop: 13 tests passed.
  - Shared: 5 files, 40 tests passed.
  - Web: 26 files, 153 tests passed.
  - Worker: 184 tests passed.

Non-blocking output:

- pnpm reported the existing ignored build-script warning for `esbuild`.
- Node reported an existing `DEP0169` warning for `url.parse()`.
- pip reported an available upgrade notice.

## Browser Smoke

Environment:

- Worker: `http://127.0.0.1:8765`
- Web: `http://127.0.0.1:1420`
- Data dir: `.tmp/smoke-0.27/data`
- Seeded project: `project-3884ac2b34b44cb59e48e0a9793f7d1c`

Verified in the in-app Browser:

- Opened seeded project from Project Center.
- Edited source text and observed `Autosaved draft` recovery state.
- Reloaded, reopened the project, restored the server draft, and confirmed restored text.
- Used command bar Undo and Redo.
- Confirmed `S` in the source textarea does not split a subtitle line.
- Confirmed `S` outside editable fields splits the selected subtitle line.
- Merged the split line with Merge next.
- Applied a selected-line batch timing offset and confirmed `Before batch timing` snapshot creation.
- Restored the batch timing snapshot and confirmed timing reverted.
- Confirmed Export is blocked while an autosaved server draft is pending.
- Browser console error count: 0.

## Known Limitations

- Undo/redo is session-local. Durable recovery is handled by drafts and snapshots, not by replaying history after reload.
- Split uses a simple midpoint text split and timing clamp. It is safe and predictable, but not semantic.
- Autosave is debounce-based and last-writer-wins for the local single-user workflow.
