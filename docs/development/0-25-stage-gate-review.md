# Diplomat 0.25 Stage Gate Review

Review date: 2026-06-14

Branch: `codex/0.25-local-translation`

## Scope Accepted

0.25 integrates the formal local translation runtime path:

- Shared and Worker translation requests now carry curated translation `modelId`, optional model path, device, and compute type.
- Worker translation resolver validates curated registry entries, install state, model files, language-pair support, device, and compute type.
- Translation jobs validate model configuration before queueing and re-resolve before execution.
- Translation failures from configuration and runtime paths preserve stable error codes and diagnostic logs.
- CTranslate2 Marian and local LLM translation providers are implemented with lazy optional dependency imports.
- Workbench Translation UI now selects installed curated translation models by model id and hides remote provider controls in the formal product path.
- Remote/fake translation paths remain available only through explicit development wiring and tests.

## Commits

- `aa48293 docs: plan 0.25 local translation`
- `596ecdf feat(shared): add local translation contract`
- `e29d426 feat(worker): resolve installed translation models`
- `f8641d8 feat(worker): add local translation runtimes`
- `38213a8 feat(worker): run translation with installed models`
- `f6460bc feat(web): select translation models by curated id`
- `b375753 test(worker): rename translation resolver tests`

## Verification

Focused verification passed:

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/translation worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py worker/tests/storage/test_project_store.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

Results:

- Shared: 5 files, 31 tests passed.
- Worker focused: 89 tests passed.
- Web focused: 3 files, 53 tests passed.
- Web typecheck: passed.

Full repository verification passed:

```powershell
.\scripts\check.ps1
```

Results:

- Desktop Rust tests: 13 passed.
- Shared tests: 5 files, 31 tests passed.
- Web tests: 20 files, 108 tests passed.
- Shared/Web/Desktop typechecks: passed.
- Worker tests: 162 passed.

Non-blocking command output:

- `pnpm` reported ignored `esbuild` build scripts, matching prior environment behavior.
- Node reported a `url.parse()` deprecation warning during checks; no test failed.
- `pip` reported an available upgrade notice; no test failed.

During full verification, pytest initially exposed an import-file mismatch because both ASR and translation suites had a top-level `test_resolver.py` module name. The translation resolver test was renamed to `worker/tests/translation/test_translation_resolver.py`; after the rename, `python -m pytest worker/tests/asr worker/tests/translation -q` passed with 34 tests and the full repository check passed.

## Browser Smoke

Manual Browser smoke passed.

Steps:

1. Started Worker at `http://127.0.0.1:8765` with an isolated temporary `DIPLOMAT_DATA_DIR`.
2. Started Web app at `http://127.0.0.1:1420`.
3. Seeded a minimal project and subtitle document in the temporary Worker store.
4. Opened the app in the in-app Browser.
5. Opened the seeded project from Project Center.
6. Opened the Translation inspector.
7. Confirmed the formal panel shows `Translation model`, `Source language`, `Target language`, `Translation mode`, `Device`, and `Compute type`.
8. Confirmed the formal panel does not show `Provider`, `Endpoint`, or `API key env`.
9. Confirmed the no-model message is visible: `Install a translation model from Models before starting local translation.`
10. Confirmed `Start` is disabled when no installed usable translation model is available.
11. Confirmed browser console error log count was 0.

Browser result:

- Passed.
- Worker and Web smoke processes were stopped after the test.
- Ports 8765 and 1420 had no remaining listening process after cleanup.

## Manual Real Translation Smoke

Manual translation with a real local translation model was not executed in this workspace.

Reason:

- 0.23 intentionally left built-in registry source URLs and checksums as audited metadata stubs.
- No validated production OPUS/CTranslate2 or local LLM translation model package was installed through the formal model manager in this workspace.
- Running unmanaged local model paths would not verify the formal 0.3 product path and would risk implicit network/model-cache behavior.

0.25 verifies runtime integration with resolver tests, mocked CTranslate2/SentencePiece objects, mocked Transformers objects, and task-level local provider execution. A real subtitle translation acceptance smoke must be repeated once curated translation model package URLs/checksums and tokenizer manifests are finalized or a valid installed translation model directory is seeded through the formal install-state path.

## Review Findings

### Specification Compliance

- Passed for the formal code path: translation jobs now require installed curated models unless explicit development wiring allows unmanaged translation models.
- Passed for job lifecycle: queued, running, completed, failed, canceled, and retry behavior remains covered.
- Passed for UI formalization: remote provider controls are hidden in the normal product path.
- Partial for manual real-model acceptance: production model package availability remains a release-packaging dependency.

### Code Quality

- Resolver logic is isolated in `worker/diplomat_worker/translation/resolver.py`.
- Optional runtime dependencies remain lazy, preserving normal tests and non-translation flows.
- The Worker stores curated request payloads without persisting resolved absolute paths in the task request.
- The frontend formal UI is model-manager driven and avoids arbitrary provider/path configuration by default.

### Product Workflow

- Workbench now directs users to install a curated translation model before local translation.
- The selected model travels as `modelId` to the Worker.
- Device and compute controls remain visible for GPU-first and CPU fallback behavior.
- Translation language pairs are derived from the selected model and blocked when unsupported.

### Licensing, Security, And Privacy

- No model weights were committed.
- No tests download real models.
- Formal translation execution is local after model installation.
- The Worker refuses missing, uninstalled, wrong-task, wrong-provider/runtime, wrong-language, and unsupported device/compute selections.
- Final model package URLs, checksums, tokenizer/package manifests, and license audit remain mandatory before 0.30 release acceptance.

## Remaining Limitations

- Built-in registry still needs final production translation artifact URLs, pinned versions, checksums, tokenizer manifests, and license audit.
- Model manager still uses local fixture downloads in tests; production multi-file model packages need finalization before real user downloads.
- CUDA availability is not fully preflighted without loading native runtime dependencies; runtime failures are surfaced through task diagnostics.
- Manual real subtitle translation smoke must be rerun before 0.30 once a valid curated translation model installation is available.
- End-to-end ASR plus translation plus export release smoke remains a 0.30 acceptance item.

## Decision

0.25 is accepted for merge into `main` with one explicit carry-forward release blocker:

- Before 0.30 can be accepted, Diplomat must pass a real local subtitle translation smoke using a curated, audited, installed translation model package from the formal model manager path.
