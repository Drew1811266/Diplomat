# M4 Stage Gate Review

## Gate Decision

Status: accepted on 2026-06-07.

M4 is accepted for the current early-stage development baseline. Translation, bilingual subtitle editing, and bilingual SRT export are implemented and verified. Burned-in video export remains outside M4.

## Scope Reviewed

- Subtitle line translation metadata.
- Worker fake and LibreTranslate provider paths.
- Project translation settings storage.
- Background translation jobs.
- Worker translation settings and job APIs.
- Shared TypeScript contracts.
- Web Translation panel, polling, edit status, missing translation filter, save, and export flow.
- Source, target, and bilingual SRT export behavior.

## Automated Verification Evidence

Final run from `D:\Software Project\Diplomat\.worktrees\m4-translation-bilingual`:

```powershell
.\scripts\check.ps1
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Results:

- `.\scripts\check.ps1`: passed.
  - Shared package tests: 23 passed.
  - Web tests: 38 passed.
  - Web typecheck: passed.
  - Worker tests: 101 passed.
  - Desktop Rust tests: 4 passed.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`: passed.

Focused M4 verification also completed during implementation:

- Worker API CORS and translation API tests: `python -m pytest worker/tests/api/test_app.py -q`
- Worker SRT export tests: `python -m pytest worker/tests/export/test_srt.py -q`
- Web App translation workflow tests: `corepack pnpm --filter @diplomat/web test -- App.test.tsx`
- Web API helper tests: `corepack pnpm --filter @diplomat/web test -- api.test.ts`
- Web typecheck: `corepack pnpm --filter @diplomat/web typecheck`

## Manual Verification Evidence

Browser run from the M4 worktree:

1. Started Worker on `http://127.0.0.1:8767` with `DIPLOMAT_CORS_ORIGINS=http://127.0.0.1:1421`.
2. Started Web on `http://127.0.0.1:1421` with `VITE_DIPLOMAT_WORKER_BASE_URL=http://127.0.0.1:8767`.
3. Seeded project `project-30be7bfb6eba4ba2b9414f5f948fa56a` with two Chinese subtitle lines.
4. Reopened the project in the Web workbench and confirmed 2 subtitle rows.
5. Started fake translation and confirmed Worker wrote `[en] ...` target text.
6. Reopened the project and confirmed translated text appeared in the subtitle list and editor.
7. Edited line 1 target text to `Manual subtitle translation`, saved, reopened, and confirmed persistence.
8. Exported bilingual SRT to `.dev\m4-browser-data\projects\project-30be7bfb6eba4ba2b9414f5f948fa56a\exports\subtitle-bilingual.srt`.
9. Inspected the SRT and confirmed it contains source lines plus target lines, including `Manual subtitle translation`.
10. Started LibreTranslate translation with invalid endpoint `http://127.0.0.1:9` and confirmed the Worker produced a failed translation task and line-level error.
11. Retried the failed task with fake provider replacement config and confirmed the Worker completed recovery.
12. Reopened the project in the Web workbench and confirmed both lines returned to `translated` with fake provider output.

The browser automation session did not observe live `/tasks/<id>` polling during timed waits, so manual confirmation used project reopen after Worker completion. The live queued-to-completed polling path is covered by the Web App regression test `polls a queued translation job and displays completed target text`.

## Remaining Limitations

- Fake provider is deterministic test behavior, not real translation.
- LibreTranslate requires a user-provided endpoint.
- No API keys are committed; only environment variable names are stored.
- Burned-in video export is outside M4.
