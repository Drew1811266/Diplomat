# Diplomat 0.24 Real Local ASR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make installed curated faster-whisper models the formal local ASR path, with model validation, real runtime execution, progress/cancel/retry diagnostics, and Workbench UI selection by model id.

**Architecture:** Extend the shared analysis request with `modelId`, resolve that id inside the Worker against the curated registry and persisted install state, then pass only a validated local model path to the faster-whisper wrapper. The Web Workbench consumes the model catalog and posts curated model ids instead of arbitrary paths.

**Tech Stack:** Zod shared schemas, FastAPI/Pydantic, SQLite-backed `ProjectStore`, Python faster-whisper optional runtime, React 19, Mantine, React Query, Vitest, Testing Library, pytest.

---

## File Structure

- Modify `packages/shared/src/task.ts`: add `modelId` to `AnalysisJobRequestSchema`.
- Modify `apps/web/src/api.ts` tests as needed because analysis request serialization now includes model ids.
- Modify `worker/diplomat_worker/asr/config.py`: add `model_id` and runtime label support to `AsrModelConfig`.
- Create `worker/diplomat_worker/asr/resolver.py`: curated model resolution and compatibility checks.
- Modify `worker/diplomat_worker/asr/faster_whisper.py`: harden real runtime wrapper, dependency errors, model label, and progress.
- Modify `worker/diplomat_worker/api/schemas.py`: add `modelId` to `AnalysisJobRequest`.
- Modify `worker/diplomat_worker/api/app.py`: translate API request to `AsrModelConfig`, catch ASR configuration errors.
- Modify `worker/diplomat_worker/api/runtime.py`: add explicit unmanaged-ASR development flag if needed by tests/dev wiring.
- Modify `worker/diplomat_worker/tasks/analysis.py`: validate model at queue time and re-resolve at run time before creating the transcriber.
- Create `worker/tests/asr/test_resolver.py`: resolver compatibility tests.
- Create `worker/tests/asr/test_faster_whisper.py`: mocked faster-whisper wrapper tests.
- Modify `worker/tests/asr/test_fake.py`: cover `modelId` default behavior if useful.
- Modify `worker/tests/tasks/test_analysis_jobs.py`: installed curated ASR job and runtime failure tests.
- Modify `worker/tests/api/test_app.py`: API rejection/acceptance tests for `modelId`.
- Modify `apps/web/src/components/inspectors/AnalysisInspector.tsx`: formal installed ASR selector by model id, no-model blocking state.
- Modify `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`: formal selector and no-model tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: default formal ASR config and selected model id behavior.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: analysis start/retry body expectations.
- Modify `apps/web/src/test/fixtures.ts`: analysis configs and model fixtures if needed.
- Modify `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`: ASR model selection copy.

## Task 1: Shared And API Request Contract

**Files:**
- Modify: `packages/shared/src/task.ts`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/asr/config.py`
- Test: `apps/web/tests/api.test.ts`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing shared schema coverage**

Update the existing shared/api tests so `AnalysisJobRequestSchema` accepts and defaults `modelId`:

```ts
expect(
  AnalysisJobRequestSchema.parse({
    provider: "faster-whisper",
    modelId: "asr.faster-whisper.small",
    device: "cuda",
    computeType: "float16",
    sourceLanguage: "zh"
  })
).toMatchObject({
  provider: "faster-whisper",
  modelId: "asr.faster-whisper.small",
  modelNameOrPath: null
});

expect(AnalysisJobRequestSchema.parse({ provider: "fake" }).modelId).toBeNull();
```

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts
```

Expected: fail because `modelId` is stripped or missing.

- [ ] **Step 2: Add failing Worker request/config coverage**

Add Worker assertions that `AnalysisJobRequest(modelId="asr.faster-whisper.small")` populates `model_id`, and `AsrModelConfig.to_request_payload()` emits `modelId`.

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: fail because Worker schemas/config do not expose `modelId`.

- [ ] **Step 3: Implement request contract**

Add `modelId`/`model_id`:

```ts
export const AnalysisJobRequestSchema = z.object({
  provider: z.enum(["fake", "faster-whisper"]).default("fake"),
  modelId: z.string().nullable().default(null),
  modelNameOrPath: z.string().nullable().default(null),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  sourceLanguage: z.string().min(2).max(12).nullable().default(null),
  initialPrompt: z.string().nullable().default(null)
});
```

Mirror it in Pydantic and `AsrModelConfig`.

- [ ] **Step 4: Run focused contract tests**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts
python -m pytest worker/tests/api/test_app.py::test_analysis_job_request_defaults_to_fake_provider -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/shared/src/task.ts worker/diplomat_worker/api/schemas.py worker/diplomat_worker/asr/config.py apps/web/tests/api.test.ts worker/tests/api/test_app.py
git commit -m "feat(shared): add asr model id contract"
```

## Task 2: Worker ASR Model Resolver

**Files:**
- Create: `worker/diplomat_worker/asr/resolver.py`
- Modify: `worker/diplomat_worker/asr/config.py`
- Test: `worker/tests/asr/test_resolver.py`

- [ ] **Step 1: Add failing resolver tests**

Create tests for:

- missing `modelId` on formal faster-whisper requests.
- unknown model id.
- translation model selected for ASR.
- unsupported source language.
- uninstalled model.
- missing installed files.
- valid installed ASR model resolves to `model_name_or_path`.
- CPU/float16 rejection and CUDA/float16 acceptance.

Run:

```powershell
python -m pytest worker/tests/asr/test_resolver.py -q
```

Expected: fail because resolver does not exist.

- [ ] **Step 2: Implement stable resolver error type**

Create `AsrConfigurationError` with:

```python
class AsrConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
```

- [ ] **Step 3: Implement `resolve_asr_model_config`**

Resolver behavior:

```python
def resolve_asr_model_config(
    config: AsrModelConfig,
    *,
    store: ProjectStore,
    registry: list[ModelRegistryEntry],
    fallback_language: str,
    allow_unmanaged_models: bool = False,
) -> AsrModelConfig:
    ...
```

Return a copied `AsrModelConfig` with:

- source language filled from request or project.
- validated `model_id`.
- `model_name_or_path` set to the installed model directory for curated faster-whisper.

- [ ] **Step 4: Run resolver tests**

```powershell
python -m pytest worker/tests/asr/test_resolver.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/config.py worker/diplomat_worker/asr/resolver.py worker/tests/asr/test_resolver.py
git commit -m "feat(worker): resolve installed asr models"
```

## Task 3: Faster-Whisper Runtime Wrapper

**Files:**
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Test: `worker/tests/asr/test_faster_whisper.py`

- [ ] **Step 1: Add failing wrapper tests**

Use a mocked `faster_whisper` module in `sys.modules` with a fake `WhisperModel`. Verify:

- model path, device, and compute type are passed to `WhisperModel`.
- returned segments and words become `AsrSegment` and `AsrWord`.
- `model_label` is used in `AsrResult.model`.
- cancellation before model load raises `AsrCanceled`.
- missing module raises a clear `RuntimeError`.

Run:

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py -q
```

Expected: fail until wrapper is hardened.

- [ ] **Step 2: Harden wrapper**

Update `FasterWhisperTranscriber` to accept:

```python
model_name: str
model_label: str | None = None
device: str = "cpu"
compute_type: str = "int8"
language: str = "zh"
initial_prompt: str | None = None
```

Catch `ImportError` and raise:

```python
RuntimeError("faster-whisper is not installed. Install the Worker ASR extras before running local ASR.")
```

Use `self.model_label or self.model_name` for `AsrResult.model`.

- [ ] **Step 3: Run wrapper tests**

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py worker/tests/asr/test_fake.py -q
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add worker/diplomat_worker/asr/faster_whisper.py worker/tests/asr/test_faster_whisper.py worker/tests/asr/test_fake.py
git commit -m "feat(worker): harden faster whisper runtime"
```

## Task 4: Analysis Job Integration

**Files:**
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing job tests**

Add tests that:

- queue and complete an analysis job with an installed curated ASR model and injected transcriber factory.
- assert the factory receives the resolved installed path.
- reject an uninstalled curated ASR model at API create time with 409.
- fail a queued job with `ASR_MODEL_FILES_MISSING` if model files are deleted before run.
- retry a failed curated ASR job preserves `modelId`.

Run:

```powershell
python -m pytest worker/tests/tasks/test_analysis_jobs.py worker/tests/api/test_app.py -q
```

Expected: fail until task integration exists.

- [ ] **Step 2: Add runtime flag**

Add `allow_unmanaged_asr_models: bool = False` to `WorkerRuntime`. Keep default false.

- [ ] **Step 3: Validate at create time**

In `AnalysisJobManager.create_analysis_job`, load the project and call the resolver before creating a task. Store the original curated request payload, not the resolved absolute path.

- [ ] **Step 4: Re-resolve at task start**

In `_run_task`, after FFmpeg preflight and before `transcriber_factory`, call the resolver again and pass the resolved config to the transcriber factory.

- [ ] **Step 5: Convert ASR config errors to API and task failures**

In API route creation, catch `AsrConfigurationError` and return 409 with its message.

In `_run_task`, catch `AsrConfigurationError`, log the message, and update task:

```python
status="failed"
error_code=exc.code
error_message=exc.message
```

- [ ] **Step 6: Run Worker focused tests**

```powershell
python -m pytest worker/tests/asr worker/tests/tasks/test_analysis_jobs.py worker/tests/api/test_app.py -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/api/runtime.py worker/diplomat_worker/tasks/analysis.py worker/diplomat_worker/api/app.py worker/tests/tasks/test_analysis_jobs.py worker/tests/api/test_app.py
git commit -m "feat(worker): run analysis with installed asr models"
```

## Task 5: Web Workbench Formal ASR UI

**Files:**
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Add failing UI tests**

Add tests that verify:

- formal ASR selector lists installed usable ASR models by name.
- selecting a model sets `provider: "faster-whisper"` and `modelId`.
- Start is disabled when no installed usable ASR model exists.
- no formal arbitrary model path input is visible.
- Workbench posts `modelId` instead of installed path.

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Expected: fail until UI changes are implemented.

- [ ] **Step 2: Update default analysis config**

Set Workbench formal defaults:

```ts
const defaultAnalysisConfig: AnalysisJobRequest = {
  provider: "faster-whisper",
  modelId: null,
  modelNameOrPath: null,
  device: "cuda",
  computeType: "float16",
  sourceLanguage: null,
  initialPrompt: null
};
```

- [ ] **Step 3: Update AnalysisInspector formal UI**

Use installed model ids as select values:

```ts
onConfigChange({
  ...config,
  provider: "faster-whisper",
  modelId: selectedModelId,
  modelNameOrPath: null
});
```

Disable Start when `busy || !config.modelId`.

- [ ] **Step 4: Add localized copy**

Add strings for:

- installed ASR model.
- install an ASR model first.
- no ASR model available.
- CPU fallback/device guidance.

- [ ] **Step 5: Run Web focused tests**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/inspectors/AnalysisInspector.tsx apps/web/src/components/inspectors/AnalysisInspector.test.tsx apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/src/test/fixtures.ts apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts apps/web/tests/api.test.ts
git commit -m "feat(web): select asr models by curated id"
```

## Task 6: Verification, Review, Merge, Push

**Files:**
- Create: `docs/development/0-24-stage-gate-review.md`
- Modify only if needed: `docs/development/0-24-real-local-asr.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/asr worker/tests/tasks/test_analysis_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full repository verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Start Worker and Web app, open the app in the in-app Browser, select the Workbench Analysis inspector, confirm no installed model blocks Start, then use a seeded installed model fixture if available to confirm the selected ASR request posts `modelId`.

- [ ] **Step 4: Manual real ASR smoke**

If the machine has a valid installed faster-whisper model directory and FFmpeg, transcribe a short local video. Record exact model id, device, compute type, result, and diagnostics. If no valid model artifact is available because production model package URLs/checksums are still pending, record this as a known 0.30 release-packaging dependency rather than pretending the manual smoke passed.

- [ ] **Step 5: Write stage gate review**

Record:

- branch and commits.
- automated verification commands and results.
- Browser smoke result.
- manual ASR smoke result or blocker.
- known limitations around production model package URLs/checksums.
- acceptance decision.

- [ ] **Step 6: Commit stage gate**

```powershell
git add docs/development/0-24-stage-gate-review.md
git commit -m "docs: accept 0.24 stage gate"
```

- [ ] **Step 7: Merge and push**

```powershell
git switch main
git merge --no-ff codex/0.24-real-local-asr -m "merge: complete 0.24 real local asr"
.\scripts\check.ps1
git push origin main
```

If HTTPS push fails with HTTP/2 connection reset, retry once with:

```powershell
git -c http.version=HTTP/1.1 push origin main
```

## Self-Review

- Spec coverage: covers curated `modelId`, resolver checks, real faster-whisper wrapper, analysis job progress/failure/retry, Web formal ASR selection, fake ASR preservation, verification, and stage gate.
- Placeholder scan: no task uses unresolved markers or leaves behavior undefined; the only conditional item is manual real ASR smoke availability, and the required recording behavior is explicit.
- Type consistency: `modelId` is the shared/Web/API field name, `model_id` is the Python field, and `AsrModelConfig` carries both model id and resolved runtime path.
