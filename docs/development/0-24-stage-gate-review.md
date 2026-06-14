# Diplomat 0.24 Stage Gate Review

Review date: 2026-06-14

Branch: `codex/0.24-real-local-asr`

## Scope Accepted

0.24 integrates the formal local ASR runtime path:

- Shared and Worker analysis requests now carry curated ASR `modelId`.
- Worker ASR resolver validates curated registry entries, install state, model files, language support, device, and compute type.
- Analysis jobs validate ASR configuration before queueing and re-resolve before execution.
- Analysis job failures from ASR configuration now preserve stable error codes and diagnostic logs.
- Faster-whisper wrapper is covered with mocked runtime tests for model loading, word/segment conversion, cancellation, and missing optional dependency diagnostics.
- Workbench Analysis UI now selects installed curated ASR models by model id and hides the formal arbitrary provider/path controls.
- Fake ASR remains available for deterministic tests and explicit development paths.

## Commits

- `2083115 docs: plan 0.24 real local asr`
- `9c7b226 feat(shared): add asr model id contract`
- `ce94183 feat(worker): resolve installed asr models`
- `7100341 feat(worker): harden faster whisper runtime`
- `76f46d2 feat(worker): run analysis with installed asr models`
- `8bf3e8a feat(web): select asr models by curated id`

## Verification

Focused verification passed:

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/asr worker/tests/tasks/test_analysis_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

Results:

- Shared: 5 files, 30 tests passed.
- Worker focused: 65 tests passed.
- Web focused: 3 files, 50 tests passed.
- Web typecheck: passed.

Full repository verification passed:

```powershell
.\scripts\check.ps1
```

Results:

- Desktop Rust tests: 13 passed.
- Shared tests: 30 passed.
- Web tests: 20 files, 107 tests passed.
- Shared/Web/Desktop typechecks: passed.
- Worker tests: 141 passed.

Non-blocking command output:

- `pnpm` reported ignored `esbuild` build scripts, matching prior environment behavior.
- Node reported a `url.parse()` deprecation warning during checks; no test failed.
- `pip` reported an available upgrade notice; no test failed.

## Browser Smoke

Manual Browser smoke passed.

Steps:

1. Started Worker at `http://127.0.0.1:8765`.
2. Started Web app at `http://localhost:1420`.
3. Opened the app in the in-app Browser.
4. Switched from Project Center to Workbench.
5. Opened the Analysis inspector.
6. Confirmed the formal panel shows `Installed ASR model`, `Source language`, `Device`, `Compute type`, and `Initial prompt`.
7. Confirmed the formal panel does not show `Provider` or arbitrary `Model` path input.
8. Confirmed the no-model message is visible.
9. Confirmed `Start` is disabled when no installed usable ASR model is available.
10. Confirmed browser console error log count was 0.

Browser result:

- Passed.
- Worker and Web smoke processes were stopped after the test.
- Ports 8765 and 1420 were confirmed released.

## Manual Real ASR Smoke

Manual transcription of a real local video with real faster-whisper weights was not executed in this workspace.

Reason:

- 0.23 intentionally left built-in registry source URLs and checksums as audited metadata stubs.
- No validated production faster-whisper model package was installed through the formal model manager in this workspace.
- Running `faster-whisper` against an unmanaged model id would risk implicit network/model-cache behavior and would not verify the formal 0.3 product path.

0.24 does verify the runtime integration with injected transcribers and mocked faster-whisper objects. A real-video acceptance smoke must be repeated once curated model package URLs/checksums are finalized or a valid installed faster-whisper model directory is seeded through the formal install-state path.

## Review Findings

### Specification Compliance

- Passed for the formal code path: ASR jobs now require installed curated models unless explicit development wiring allows unmanaged models.
- Passed for job lifecycle: queued, running, completed, failed, canceled, and retry behavior remains covered.
- Partial for manual real-media acceptance: real model package availability remains a release-packaging dependency.

### Code Quality

- Resolver logic is isolated in `worker/diplomat_worker/asr/resolver.py`.
- Faster-whisper import remains lazy, preserving normal tests and non-ASR flows.
- The Worker stores curated request payloads without persisting resolved absolute paths in the task request.
- Frontend formal UI is simpler and no longer exposes arbitrary provider/path controls by default.

### Product Workflow

- Workbench now directs users to install a curated ASR model before local transcription.
- The selected model travels as `modelId` to the Worker.
- Device and compute controls remain visible for GPU-first and CPU fallback behavior.

### Licensing, Security, And Privacy

- No model weights were committed.
- No tests download real models.
- Formal ASR execution is local after model installation.
- The Worker refuses missing, uninstalled, wrong-task, wrong-language, and unsafe model selections.
- Final model package URLs, checksums, and license audit remain mandatory before 0.30 release acceptance.

## Remaining Limitations

- Built-in registry still needs final production model artifact URLs, pinned versions, checksums, and license audit.
- Model manager still uses local fixture downloads in tests; production multi-file model packages need finalization before real user downloads.
- CUDA availability is not fully preflighted without loading native runtime dependencies; runtime failures are surfaced through task diagnostics.
- Manual real-video ASR smoke must be rerun before 0.30 once a valid curated model installation is available.
- Local translation execution still lands in 0.25.

## Decision

0.24 is accepted for merge into `main` with one explicit carry-forward release blocker:

- Before 0.30 can be accepted, Diplomat must pass a real local video transcription smoke using a curated, audited, installed faster-whisper model package from the formal model manager path.
