# Diplomat 0.25 Local Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make installed curated local translation models the formal Chinese-English translation path, with model validation, local runtime providers, progress/cancel/retry diagnostics, settings persistence, and Workbench UI selection by model id.

**Architecture:** Extend translation requests and settings with `modelId`, device, and compute fields, resolve the model id inside the Worker against the curated registry and install state, then pass only a validated installed path to a local translation provider. The Web Workbench consumes the model catalog and posts curated model ids instead of remote endpoint configuration.

**Tech Stack:** Zod shared schemas, FastAPI/Pydantic, SQLite-backed `ProjectStore`, optional Python `ctranslate2`, `sentencepiece`, `transformers`, and `torch` runtimes, React 19, Mantine, React Query, Vitest, Testing Library, pytest.

---

## File Structure

- Modify `packages/shared/src/task.ts`: add local translation providers and `modelId`, `modelNameOrPath`, `device`, `computeType` fields.
- Modify `packages/shared/tests/task.test.ts`: cover local translation parsing and defaults.
- Modify `worker/diplomat_worker/translation/config.py`: add local provider fields and factory routing.
- Create `worker/diplomat_worker/translation/resolver.py`: curated translation model resolution and compatibility checks.
- Create `worker/diplomat_worker/translation/ct2_marian.py`: CTranslate2 Marian local runtime wrapper.
- Create `worker/diplomat_worker/translation/local_llm.py`: Transformers local LLM translation wrapper.
- Modify `worker/diplomat_worker/tasks/translation.py`: validate, re-resolve, and run local model configs.
- Modify `worker/diplomat_worker/api/runtime.py`: add `allow_unmanaged_translation_models` development flag.
- Modify `worker/diplomat_worker/api/schemas.py`: add local translation request/settings fields.
- Modify `worker/diplomat_worker/api/app.py`: translate API requests and catch translation configuration errors.
- Modify `worker/diplomat_worker/storage/project_store.py`: persist and migrate translation model settings.
- Create `worker/tests/translation/test_resolver.py`: resolver compatibility tests.
- Create `worker/tests/translation/test_ct2_marian.py`: mocked CTranslate2/SentencePiece tests.
- Create `worker/tests/translation/test_local_llm.py`: mocked Transformers local LLM tests.
- Modify `worker/tests/tasks/test_translation_jobs.py`: local model job tests and failure/retry behavior.
- Modify `worker/tests/api/test_app.py`: API request, settings, rejection, and retry tests.
- Modify `worker/tests/storage/test_project_store.py`: translation settings persistence and migration tests.
- Modify `worker/pyproject.toml`: add translation optional dependencies.
- Modify `apps/web/src/components/inspectors/TranslationInspector.tsx`: formal installed model selector and compatibility blocking.
- Modify `apps/web/src/components/inspectors/TranslationInspector.test.tsx`: formal UI and development-control tests.
- Modify `apps/web/src/pages/WorkbenchPage.tsx`: default translation config and model selection behavior.
- Modify `apps/web/src/pages/WorkbenchPage.test.tsx`: translation request body and retry expectations.
- Modify `apps/web/src/test/fixtures.ts`: installed translation model fixture.
- Modify `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`: translation model copy.
- Modify `apps/web/tests/api.test.ts`: request serialization and retry tests.
- Create `docs/development/0-25-stage-gate-review.md` after verification.

## Task 1: Shared, API, And Settings Contract

**Files:**
- Modify: `packages/shared/src/task.ts`
- Modify: `packages/shared/tests/task.test.ts`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/translation/config.py`
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Test: `worker/tests/api/test_app.py`
- Test: `worker/tests/storage/test_project_store.py`
- Test: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write failing shared schema tests**

Add a shared test that parses a local translation request:

```ts
const request = TranslationJobRequestSchema.parse({
  provider: "ct2-marian",
  modelId: "translation.opus-mt.zh-en",
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  device: "cuda",
  computeType: "float16"
});

expect(request).toMatchObject({
  provider: "ct2-marian",
  modelId: "translation.opus-mt.zh-en",
  modelNameOrPath: null,
  device: "cuda",
  computeType: "float16"
});
```

Run:

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fail because the schema does not accept local translation providers or `modelId`.

- [ ] **Step 2: Write failing Worker schema and store tests**

Add assertions:

```python
request = TranslationSettingsRequest(
    provider="ct2-marian",
    modelId="translation.opus-mt.zh-en",
    sourceLanguage="zh",
    targetLanguage="en",
    device="cuda",
    computeType="float16",
)
assert request.model_id == "translation.opus-mt.zh-en"
assert request.device == "cuda"
assert request.compute_type == "float16"
```

Add a `ProjectStore` round-trip test that saves translation settings with:

```python
provider="ct2-marian"
model_id="translation.opus-mt.zh-en"
model_name_or_path=None
device="cuda"
compute_type="float16"
```

Run:

```powershell
python -m pytest worker/tests/api/test_app.py::test_translation_settings_request_defaults_to_fake_missing_only worker/tests/storage/test_project_store.py::test_translation_settings_can_be_saved_and_reopened -q
```

Expected: fail because Python schemas and storage do not carry local model fields.

- [ ] **Step 3: Implement shared schema**

Update `TranslationProviderSchema`:

```ts
export const TranslationProviderSchema = z.enum([
  "fake",
  "libretranslate",
  "ct2-marian",
  "local-llm"
]);
```

Update `TranslationJobRequestSchema`:

```ts
export const TranslationJobRequestSchema = z.object({
  provider: TranslationProviderSchema.default("fake"),
  modelId: z.string().nullable().default(null),
  modelNameOrPath: z.string().nullable().default(null),
  sourceLanguage: z.string().min(2).max(12),
  targetLanguage: z.string().min(2).max(12),
  mode: TranslationModeSchema.default("missing_only"),
  device: z.string().min(1).default("cpu"),
  computeType: z.string().min(1).default("int8"),
  endpoint: z.string().nullable().default(null),
  apiKeyEnv: z.string().nullable().default(null)
});
```

- [ ] **Step 4: Implement Python config and schemas**

Update `TranslationProviderName`:

```python
TranslationProviderName = Literal["fake", "libretranslate", "ct2-marian", "local-llm"]
```

Add fields to `TranslationProviderConfig`:

```python
model_id: str | None = None
model_name_or_path: str | None = None
device: str = "cpu"
compute_type: str = "int8"
```

Make `to_request_payload()` emit `modelId`, `modelNameOrPath`, `device`, and `computeType` when present or non-default.

Mirror the fields in `TranslationSettingsRequest` and `TranslationSettingsResponse`.

- [ ] **Step 5: Implement storage migration**

Increase `SCHEMA_VERSION` by one and update `_ensure_translation_settings_table()` to create new columns:

```sql
model_id TEXT,
model_name_or_path TEXT,
device TEXT NOT NULL DEFAULT 'cpu',
compute_type TEXT NOT NULL DEFAULT 'int8'
```

Add an `_ensure_translation_settings_columns()` helper using `PRAGMA table_info(translation_settings)` and `ALTER TABLE` for old databases.

Update `TranslationSettingsRecord`, `get_translation_settings()`, `save_translation_settings()`, and `_translation_settings_from_row()`.

- [ ] **Step 6: Run contract tests**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/api/test_app.py::test_translation_settings_request_defaults_to_fake_missing_only worker/tests/storage/test_project_store.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add packages/shared/src/task.ts packages/shared/tests/task.test.ts worker/diplomat_worker/api/schemas.py worker/diplomat_worker/translation/config.py worker/diplomat_worker/storage/project_store.py worker/tests/api/test_app.py worker/tests/storage/test_project_store.py apps/web/tests/api.test.ts
git commit -m "feat(shared): add local translation contract"
```

## Task 2: Worker Translation Model Resolver

**Files:**
- Create: `worker/diplomat_worker/translation/resolver.py`
- Test: `worker/tests/translation/test_resolver.py`

- [ ] **Step 1: Write failing resolver tests**

Create tests for:

- `ct2-marian` without `modelId` raises `TRANSLATION_MODEL_REQUIRED`.
- unknown model id raises `TRANSLATION_MODEL_NOT_FOUND`.
- ASR model selected for translation raises `TRANSLATION_MODEL_NOT_COMPATIBLE`.
- `local-llm` selected with a `ct2-marian` model raises `TRANSLATION_MODEL_NOT_COMPATIBLE`.
- unsupported language pair raises `TRANSLATION_LANGUAGE_PAIR_UNSUPPORTED`.
- uninstalled model raises `TRANSLATION_MODEL_NOT_INSTALLED`.
- missing installed files raises `TRANSLATION_MODEL_FILES_MISSING`.
- valid installed model resolves `model_name_or_path`.
- CPU/float16 raises `TRANSLATION_COMPUTE_UNSUPPORTED`.
- CUDA/float16 resolves.

Run:

```powershell
python -m pytest worker/tests/translation/test_resolver.py -q
```

Expected: fail because the resolver does not exist.

- [ ] **Step 2: Implement stable resolver error type**

Create:

```python
class TranslationConfigurationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
```

- [ ] **Step 3: Implement `resolve_translation_provider_config`**

Use this signature:

```python
def resolve_translation_provider_config(
    config: TranslationProviderConfig,
    *,
    store: ProjectStore,
    registry: list[ModelRegistryEntry],
    fallback_source_language: str,
    fallback_target_language: str,
    allow_unmanaged_models: bool = False,
) -> TranslationProviderConfig:
    ...
```

Return a copied config with fallback languages filled and `model_name_or_path` set to the installed model directory for curated local providers.

- [ ] **Step 4: Run resolver tests**

```powershell
python -m pytest worker/tests/translation/test_resolver.py -q
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/translation/resolver.py worker/tests/translation/test_resolver.py
git commit -m "feat(worker): resolve installed translation models"
```

## Task 3: Local Translation Runtime Providers

**Files:**
- Create: `worker/diplomat_worker/translation/ct2_marian.py`
- Create: `worker/diplomat_worker/translation/local_llm.py`
- Modify: `worker/diplomat_worker/translation/config.py`
- Modify: `worker/pyproject.toml`
- Test: `worker/tests/translation/test_ct2_marian.py`
- Test: `worker/tests/translation/test_local_llm.py`

- [ ] **Step 1: Write failing CTranslate2 provider tests**

Mock `ctranslate2.Translator` and `sentencepiece.SentencePieceProcessor` in `sys.modules`.

Assert that:

```python
result.translated_text == "Hello world"
result.provider == "ct2-marian"
result.model == "translation.opus-mt.zh-en"
```

Also assert missing optional imports raise:

```python
RuntimeError("CTranslate2 Marian translation dependencies are not installed")
```

Run:

```powershell
python -m pytest worker/tests/translation/test_ct2_marian.py -q
```

Expected: fail because the provider does not exist.

- [ ] **Step 2: Implement `CTranslate2MarianProvider`**

Constructor fields:

```python
model_path: str
model_label: str | None = None
device: str = "cpu"
compute_type: str = "int8"
source_tokenizer_name: str = "source.spm"
target_tokenizer_name: str = "target.spm"
```

Translate behavior:

```python
source_tokens = self._source_tokenizer.EncodeAsPieces(request.source_text)
results = self._translator.translate_batch([source_tokens])
target_tokens = results[0].hypotheses[0]
translated_text = self._target_tokenizer.DecodePieces(target_tokens).strip()
```

- [ ] **Step 3: Write failing local LLM provider tests**

Mock `transformers.AutoTokenizer`, `transformers.AutoModelForCausalLM`, and `torch` in `sys.modules`.

Assert the provider builds a language-specific prompt, calls `generate`, decodes the generated text, strips prompt echo, and returns:

```python
result.provider == "local-llm"
result.model == "translation.qwen3.4b"
```

Run:

```powershell
python -m pytest worker/tests/translation/test_local_llm.py -q
```

Expected: fail because the provider does not exist.

- [ ] **Step 4: Implement `LocalLlmTranslationProvider`**

Constructor fields:

```python
model_path: str
model_label: str | None = None
device: str = "cpu"
compute_type: str = "float16"
max_new_tokens: int = 256
```

Use lazy imports and create the model with local files only:

```python
tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    local_files_only=True,
    trust_remote_code=True,
    torch_dtype=torch.float16 if compute_type == "float16" else None,
    device_map="auto" if device == "cuda" else None,
)
```

Generate with `do_sample=False` and decode only the returned sequence. Strip prompt echo and leading labels like `Translation:` if present.

- [ ] **Step 5: Route factory and optional dependencies**

Update `create_translation_provider()` so:

- `fake` returns `FakeTranslationProvider`.
- `libretranslate` returns `LibreTranslateProvider`.
- `ct2-marian` requires `model_name_or_path` and returns `CTranslate2MarianProvider`.
- `local-llm` requires `model_name_or_path` and returns `LocalLlmTranslationProvider`.

Add optional dependencies:

```toml
translation = [
  "ctranslate2>=4.4.0",
  "sentencepiece>=0.2.0",
  "transformers>=4.52.0",
  "torch>=2.4.0"
]
```

- [ ] **Step 6: Run runtime tests**

```powershell
python -m pytest worker/tests/translation -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/translation/config.py worker/diplomat_worker/translation/ct2_marian.py worker/diplomat_worker/translation/local_llm.py worker/tests/translation/test_ct2_marian.py worker/tests/translation/test_local_llm.py worker/pyproject.toml
git commit -m "feat(worker): add local translation runtimes"
```

## Task 4: Translation Job Integration

**Files:**
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing job tests**

Add tests that:

- queue and complete a translation job with an installed curated `ct2-marian` model and injected provider factory.
- assert provider factory receives the resolved installed path and curated model id.
- reject an uninstalled curated translation model at API create time with 409.
- fail a queued job with `TRANSLATION_MODEL_FILES_MISSING` if model files are deleted before execution.
- retry a failed curated translation job preserves `modelId`.
- `missing_only` protects edited translations.
- `overwrite_all` replaces edited translations.

Run:

```powershell
python -m pytest worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py -q
```

Expected: fail until task integration exists.

- [ ] **Step 2: Add runtime flag**

Add to `WorkerRuntime`:

```python
allow_unmanaged_translation_models: bool = False
```

- [ ] **Step 3: Validate at create time**

In `TranslationJobManager.create_translation_job`, load the project and call `resolve_translation_provider_config()` before creating the task. Store the original curated request payload, not the resolved absolute path.

- [ ] **Step 4: Re-resolve at task start**

In `_run_task`, after loading the payload and before `translation_provider_factory`, call the resolver again and pass the resolved config to the provider factory.

- [ ] **Step 5: Convert configuration errors**

In API creation, catch `TranslationConfigurationError` and return 409.

In `_run_task`, catch `TranslationConfigurationError`, log the message, and update the task with:

```python
status="failed"
error_code=exc.code
error_message=exc.message
```

- [ ] **Step 6: Run Worker focused tests**

```powershell
python -m pytest worker/tests/translation worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py worker/tests/storage/test_project_store.py -q
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/api/runtime.py worker/diplomat_worker/tasks/translation.py worker/diplomat_worker/api/app.py worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py
git commit -m "feat(worker): run translation with installed models"
```

## Task 5: Web Workbench Formal Translation UI

**Files:**
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`
- Modify: `apps/web/tests/api.test.ts`

- [ ] **Step 1: Write failing UI tests**

Add tests that verify:

- formal translation selector lists only installed usable translation models.
- selecting an installed model sets `provider`, `modelId`, clears `modelNameOrPath`, and applies the model's first compatible language pair.
- Start is disabled when no installed usable translation model exists.
- Start is disabled when the selected model does not support the requested language pair.
- formal UI does not show Provider, Endpoint, or API key env.
- development controls show Provider, Endpoint, and API key env only with `allowDevelopmentControls`.
- Workbench posts `modelId` and provider for translation jobs.

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
```

Expected: fail until UI changes are implemented.

- [ ] **Step 2: Update default translation config**

Use:

```ts
const defaultTranslationConfig: TranslationJobRequest = {
  provider: "ct2-marian",
  modelId: null,
  modelNameOrPath: null,
  sourceLanguage: "zh",
  targetLanguage: "en",
  mode: "missing_only",
  device: "cuda",
  computeType: "float16",
  endpoint: null,
  apiKeyEnv: null
};
```

- [ ] **Step 3: Update `TranslationInspector` formal UI**

Add `allowDevelopmentControls?: boolean = false`.

Formal selector behavior:

```ts
onConfigChange({
  ...config,
  provider: model.provider as TranslationJobRequest["provider"],
  modelId: model.modelId,
  modelNameOrPath: null,
  sourceLanguage: model.languagePairs[0]?.[0] ?? config.sourceLanguage,
  targetLanguage: model.languagePairs[0]?.[1] ?? config.targetLanguage
});
```

Compute:

```ts
const selectedModelSupportsPair = selectedModel?.languagePairs.some(
  ([source, target]) => source === config.sourceLanguage && target === config.targetLanguage
) ?? false;
```

Disable Start when busy, language invalid, no compatible installed model is selected, or selected model does not support the pair.

- [ ] **Step 4: Add localized copy**

Add strings for:

- installed translation model.
- install a translation model first.
- no translation model available.
- translation model language pair unsupported.

- [ ] **Step 5: Run Web focused tests**

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/inspectors/TranslationInspector.tsx apps/web/src/components/inspectors/TranslationInspector.test.tsx apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/src/test/fixtures.ts apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts apps/web/tests/api.test.ts
git commit -m "feat(web): select translation models by curated id"
```

## Task 6: Verification, Review, Merge, Push

**Files:**
- Create: `docs/development/0-25-stage-gate-review.md`
- Modify only if needed: `docs/development/0-25-local-translation.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/translation worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py worker/tests/storage/test_project_store.py -q
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full repository verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run Browser smoke**

Start Worker and Web app, open the app in the in-app Browser, select the Workbench Translation inspector, confirm no installed model blocks Start, then use a seeded installed translation model fixture if available to confirm the request posts `modelId` and the formal UI hides remote provider fields.

- [ ] **Step 4: Manual real translation smoke**

If the machine has a valid installed OPUS-MT CTranslate2 model directory with tokenizer files, translate a short saved subtitle document in both Chinese-to-English and English-to-Chinese directions. Record exact model id, device, compute type, result, and diagnostics. If no valid curated translation model artifact is available because production model package URLs/checksums are still pending, record this as a known 0.30 release-packaging dependency.

- [ ] **Step 5: Write stage gate review**

Record:

- branch and commits.
- automated verification commands and results.
- Browser smoke result.
- manual translation smoke result or blocker.
- known limitations around production model package URLs/checksums/tokenizer manifests.
- acceptance decision.

- [ ] **Step 6: Commit stage gate**

```powershell
git add docs/development/0-25-stage-gate-review.md
git commit -m "docs: accept 0.25 stage gate"
```

- [ ] **Step 7: Merge and push**

```powershell
git switch main
git merge --no-ff codex/0.25-local-translation -m "merge: complete 0.25 local translation"
.\scripts\check.ps1
git push origin main
```

If HTTPS push fails with HTTP/2 connection reset, retry once with:

```powershell
git -c http.version=HTTP/1.1 push origin main
```

## Self-Review

- Spec coverage: covers curated `modelId`, resolver checks, local runtime wrappers, settings persistence, translation job progress/failure/retry, edited-line protection, Web formal translation selection, fake/LibreTranslate preservation for development, verification, and stage gate.
- Placeholder scan: no task uses unresolved markers or leaves behavior undefined; manual real translation smoke has an explicit fallback recording requirement when production model artifacts are not available.
- Type consistency: `modelId` is the shared/Web/API field name, `model_id` is the Python field, and `TranslationProviderConfig` carries both the curated id and resolved runtime path.
