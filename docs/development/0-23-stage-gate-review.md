# Diplomat 0.23 Stage Gate Review

Review date: 2026-06-14

Branch: `codex/0.23-model-manager`

## Scope Accepted

0.23 establishes the built-in model manager path for the 0.3 release:

- Shared model catalog/install/download/delete schemas.
- Worker curated model registry, persisted install state, safe model directory handling, checksum verification, cancel, retry, and delete flows.
- Worker `/models` API for catalog, detail, download, cancel, retry, and delete.
- Web Models page in the left rail with task filtering, status, progress, license, hardware, and model actions.
- Workbench ASR selector for installed curated ASR models.
- Workbench translation selector for curated translation models, with 0.23 blocking copy until local translation execution lands in 0.25.

## Commits

- `9b64162 docs: plan 0.23 model manager`
- `b42935a feat(shared): add model manager contract`
- `511d773 feat(worker): add model registry and install manager`
- `f42ee20 feat(worker): expose model manager api`
- `fe28129 feat(web): add model manager page`
- `60e7097 feat(web): select installed curated models`

## Verification

Focused verification passed:

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/models worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/pages/ModelsPage.test.tsx src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx tests/App.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

Results:

- Shared: 5 files, 30 tests passed.
- Worker focused: 47 tests passed.
- Web focused: 5 files, 44 tests passed.
- Web typecheck: passed.

Full repository verification passed:

```powershell
.\scripts\check.ps1
```

Results:

- Desktop Rust tests: 13 passed.
- Shared tests: 30 passed.
- Web tests: 20 files, 106 tests passed.
- Shared/Web/Desktop typechecks: passed.
- Worker tests: 124 passed.

Non-blocking command output:

- `pnpm` reported ignored `esbuild` build scripts, matching prior environment behavior.
- Node reported a `url.parse()` deprecation warning during checks; no test failed.

## Browser Smoke

Manual Browser smoke passed.

Steps:

1. Started Worker at `http://127.0.0.1:8765`.
2. Started Web app at `http://localhost:1420`.
3. Opened the app in the in-app Browser.
4. Confirmed Project Center loaded and Worker status was ready.
5. Opened the Models rail item.
6. Confirmed 5 curated models rendered with license, status, hardware, language, and action metadata.
7. Clicked the Translation task filter.
8. Confirmed the table filtered to 3 translation models.

Browser result:

- Passed.
- No localhost Browser URL policy block occurred in this run.

## Model And License Notes

Bundled registry entries are curated metadata for open-source candidates:

- `Systran/faster-whisper-small`, license signal: MIT.
- `Systran/faster-whisper-medium`, license signal: MIT.
- `Helsinki-NLP/opus-mt-zh-en`, license signal: CC-BY-4.0.
- `Helsinki-NLP/opus-mt-en-zh`, license signal: Apache-2.0.
- `Qwen/Qwen3-4B`, license signal: Apache-2.0.

The upstream model cards were checked during 0.23 planning. They must be re-audited before 0.30 packaging because model metadata and license declarations can change.

## Remaining Limitations

- Built-in registry source URLs currently point at upstream model pages and carry placeholder checksums. Real packaged model artifacts, final URLs, and checksums must be produced and audited before production downloads are enabled.
- Worker download support is implemented and covered with local fixture files. Multi-GB production downloads still need resume behavior and package layout validation before 0.30.
- ASR runtime execution with installed curated models lands in 0.24.
- Local translation runtime execution lands in 0.25; 0.23 intentionally blocks selected local translation models from starting jobs.
- Remote/free-form development paths remain in tests and fallback UI when no curated installed model is present; the formal product path now prefers curated installed models.

## Decision

0.23 is accepted for merge into `main`.
