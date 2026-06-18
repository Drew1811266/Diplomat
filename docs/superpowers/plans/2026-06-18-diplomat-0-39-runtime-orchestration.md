# Diplomat 0.39 Runtime Orchestration Implementation Plan

> For agentic workers: execute this task-by-task. Keep this stage focused on lifecycle management, not heavy model downloads.

**Goal:** Add local model runtime cleanup hooks and task-manager resource release so ASR and translation phases do not compete for memory across long-video jobs.

**Architecture:** Add `worker/diplomat_worker/runtime/resources.py` with a best-effort cleanup helper. Providers expose `close()`. Task managers call cleanup in `finally`. Translation resolver is relaxed for vendor-owned local LLM entries where `entry.runtime == "local-llm"` and the selected provider is `local-llm`.

## Files

- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `scripts/verify-version.mjs`
- Modify: `README.md`
- Create: `worker/diplomat_worker/runtime/__init__.py`
- Create: `worker/diplomat_worker/runtime/resources.py`
- Create: `worker/tests/runtime/test_resources.py`
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Modify: `worker/diplomat_worker/translation/ct2_marian.py`
- Modify: `worker/diplomat_worker/translation/local_llm.py`
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Modify: `worker/diplomat_worker/translation/resolver.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/tests/translation/test_translation_resolver.py`
- Create: `docs/development/0-39-stage-gate-review.md`

## Task 1: Version Metadata And Planning Commit

- [ ] Confirm branch is `codex/0.39-runtime-orchestration`.
- [ ] Commit 0.39 development and implementation docs.
- [ ] Update release metadata from `0.38.0` to `0.39.0`.
- [ ] Run:

```powershell
corepack pnpm install --lockfile-only
node .\scripts\verify-version.mjs
```

- [ ] Commit:

```powershell
git commit -m "chore(release): advance version to 0.39.0"
```

## Task 2: Add Runtime Cleanup Helper

- [ ] Create `worker/tests/runtime/test_resources.py` first.
- [ ] Cover:
  - Objects with `close()` are called once.
  - Objects without `close()` are safe.
  - Exceptions from `close()` are captured in the report.
  - Missing Torch does not fail cleanup.
- [ ] Implement `worker/diplomat_worker/runtime/resources.py`.

Target API:

```python
@dataclass(frozen=True)
class RuntimeReleaseReport:
    closed: bool
    accelerator_cache_cleared: bool
    messages: list[str]

def release_runtime_resources(resource: object | None) -> RuntimeReleaseReport
```

- [ ] Run:

```powershell
python -m pytest worker/tests/runtime/test_resources.py -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): add runtime resource cleanup"
```

## Task 3: Add Provider Close Hooks

- [ ] Add `close()` to:
  - `FasterWhisperTranscriber`
  - `CTranslate2MarianProvider`
  - `LocalLlmTranslationProvider`
- [ ] The hooks should drop loaded model/tokenizer/translator references.
- [ ] Do not import heavy dependencies in close hooks.
- [ ] Add focused unit tests if needed.

- [ ] Run:

```powershell
python -m pytest worker/tests/asr worker/tests/translation -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): add local provider close hooks"
```

## Task 4: Release Resources From Task Managers

- [ ] Modify `AnalysisJobManager._run_task`:
  - Initialize `transcriber = None` before the try block.
  - Assign the transcriber before `run_core_pipeline`.
  - In `finally`, call `release_runtime_resources(transcriber)`.
  - Write cleanup messages to the diagnostic log.
- [ ] Modify `TranslationJobManager._run_task` similarly for `provider`.
- [ ] Add tests:
  - Analysis success calls `close()`.
  - Analysis failure calls `close()`.
  - Translation success calls `close()`.
  - Translation failure calls `close()`.

- [ ] Run:

```powershell
python -m pytest worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): release model resources after tasks"
```

## Task 5: Resolve Vendor-Owned Local LLM Entries

- [ ] Modify `translation/resolver.py` compatibility:
  - Keep task and language-pair validation.
  - For `provider == "local-llm"`, accept `entry.runtime == "local-llm"` even if `entry.provider` is a vendor such as `tencent`.
  - For `ct2-marian`, keep exact runtime/provider matching.
- [ ] Add resolver test for `translation.tencent.hunyuan-mt-7b-fp8` style entry.

- [ ] Run:

```powershell
python -m pytest worker/tests/translation/test_translation_resolver.py -q
```

- [ ] Commit:

```powershell
git commit -m "feat(worker): allow vendor local-llm registry entries"
```

## Task 6: Verification And Stage Gate

- [ ] Run focused verification:

```powershell
python -m pytest worker/tests/runtime worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py worker/tests/translation/test_translation_resolver.py -q
node .\scripts\verify-version.mjs
```

- [ ] Run full verification:

```powershell
.\scripts\check.ps1
```

- [ ] Write `docs/development/0-39-stage-gate-review.md`.
- [ ] Commit:

```powershell
git commit -m "docs: accept 0.39 runtime orchestration gate"
```

## Task 7: Merge And Push

- [ ] Merge into `main` and push:

```powershell
git switch main
git merge --no-ff codex/0.39-runtime-orchestration -m "merge: complete 0.39 runtime orchestration"
git push origin main
```

- [ ] Proceed automatically to 0.40 if accepted.

## Self-Review

- Cleanup is best-effort and must not hide the task's primary failure.
- No large model weights are added.
- No heavy model runtime is required for tests.
