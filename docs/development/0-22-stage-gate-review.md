# Diplomat 0.22 Stage Gate Review

Review date: 2026-06-14

## Gate Decision

Status: accepted for 0.22 code integration.

0.22 is accepted because Project Center now works as a local project library instead of a recent-project list. The shared contract, Worker storage layer, Worker HTTP API, Web API client, query hooks, Project Center UI, bilingual copy, and regression tests are implemented and covered by automated verification.

The in-app Browser smoke test for `http://127.0.0.1:1420` was attempted but blocked by Browser Use URL policy in this Codex session. No alternate browser surface was used to bypass that policy. The blocked smoke check is recorded below and does not block 0.22 because the affected Project Center behavior is covered by focused Vitest tests and the full repository check.

## Scope Reviewed

- Project diagnostics and derived project status contract.
- Safe project cleanup, backup, import, and delete store operations.
- Worker maintenance and import API endpoints.
- Web API helpers and React Query mutation hooks.
- Project Center search, status filter, diagnostics table, import backup form, row action menu, and delete confirmation modal.
- English and Chinese UI strings for new project management states.
- Test fixtures and API tests updated to require project diagnostics.

## Automated Verification Evidence

Focused verification:

```powershell
python -m pytest worker/tests/storage/test_project_store.py worker/tests/api/test_app.py -q
corepack pnpm --dir packages/shared test
corepack pnpm --dir packages/shared typecheck
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
```

Results:

- Worker storage/API focused tests: passed.
- Shared package tests: passed, 27 tests.
- Shared typecheck: passed.
- Web tests: passed, 96 tests.
- Web typecheck: passed.

Full repository verification:

```powershell
.\scripts\check.ps1
```

Result: passed.

Coverage from `scripts/check.ps1`:

- Shared package tests: 27 passed.
- Desktop Rust tests: 13 passed.
- Web tests: 96 passed.
- Worker tests: 113 passed.
- Shared, Web, and Desktop package checks completed.

Warnings observed:

- `pnpm install` reported ignored `esbuild` build scripts.
- Node reported a `url.parse()` deprecation warning.
- `pip` reported an available update.

None of these warnings block the 0.22 acceptance criteria.

## Browser Smoke Status

Vite was started successfully:

```text
http://127.0.0.1:1420/
```

The in-app Browser navigation then failed with a Browser Use URL policy block and the tab showed `This page crashed`. The automation output reported that the requested local page was blocked by Browser policy.

Disposition:

- Do not bypass with another browser automation surface in this stage.
- Rely on focused Project Center component tests, API tests, typecheck, and full repository verification for 0.22 acceptance.
- Re-run visual smoke verification in a later stage if the Browser policy permits local dev URLs again.

## Acceptance Checklist

- Project Center supports search: accepted.
- Project Center supports derived status filtering: accepted.
- Project rows show derived status and diagnostics: accepted.
- Project warnings are visible in the table: accepted.
- Project, export, and log folder actions are wired through the desktop bridge: accepted by UI wiring and tests.
- Cache cleanup and export cleanup APIs are implemented safely: accepted.
- Project backup package creation is implemented: accepted.
- Project import/restore creates a new project id: accepted.
- Delete requires confirmation and supports optional file deletion: accepted.
- Unsafe project file deletion is refused in storage tests: accepted.
- Empty, Worker unavailable, corrupted, failed, and migration-failed states are represented in contract/UI copy: accepted.
- Focused tests pass: accepted.
- Full repository verification passes: accepted.
- Browser local smoke: blocked by tool policy and documented.

## Remaining Limitations

- Backup packages preserve source media paths, not source media files.
- Cross-machine media relinking remains a later-stage feature.
- Dirty draft status is still limited until autosave/draft tracking lands in a later stage.
- Large project directory disk scanning is simple and may need optimization if real data shows latency.
- Manual visual smoke should be retried when local Browser navigation is available.
