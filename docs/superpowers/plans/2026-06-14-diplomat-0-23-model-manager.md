# Diplomat 0.23 Model Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the built-in curated model manager for installing, verifying, inspecting, canceling, retrying, deleting, and selecting open-source ASR/translation models.

**Architecture:** Add a shared model catalog contract, a Worker-owned registry/install-state/download manager, and a dedicated Web Models page. Workbench ASR/translation inspectors consume catalog data so the formal UI prefers installed curated models over arbitrary paths or remote endpoints.

**Tech Stack:** Zod shared schemas, FastAPI/Pydantic, SQLite, Python standard-library download/checksum utilities, React 19, Mantine, React Query, Vitest, Testing Library, pytest.

---

## File Structure

- Create `packages/shared/src/model.ts`: Zod schemas and exported types for model registry, install state, catalog responses, download responses, and delete responses.
- Modify `packages/shared/src/index.ts`: export the model contract.
- Create/update `packages/shared/tests/model.test.ts`: shared schema coverage.
- Create `worker/diplomat_worker/models/registry.py`: bundled curated registry and helpers to look up entries.
- Create `worker/diplomat_worker/models/manager.py`: download/cancel/retry/delete orchestration.
- Create `worker/diplomat_worker/models/__init__.py`: package marker and re-exports if useful.
- Modify `worker/diplomat_worker/storage/project_store.py`: add `model_installations` table and safe model-state methods.
- Modify `worker/diplomat_worker/api/runtime.py`: include models root path and a model registry dependency.
- Modify `worker/diplomat_worker/api/schemas.py`: add Pydantic model catalog/download/delete schemas.
- Modify `worker/diplomat_worker/api/app.py`: add `/models` routes and wire a `ModelDownloadManager`.
- Create `worker/tests/models/test_registry.py`: registry and state tests.
- Create `worker/tests/models/test_manager.py`: download, checksum, cancel, retry, delete tests.
- Modify `worker/tests/api/test_app.py`: route list and API behavior tests.
- Modify `apps/web/src/api.ts`: model catalog API helpers.
- Modify `apps/web/src/queries/queryKeys.ts`: model query keys.
- Create `apps/web/src/queries/modelQueries.ts`: React Query hooks.
- Create `apps/web/src/pages/ModelsPage.tsx`: model manager UI.
- Create `apps/web/src/pages/ModelsPage.test.tsx`: UI behavior tests.
- Modify `apps/web/src/state/uiStore.ts`: add `models` page.
- Modify `apps/web/src/components/AppRail.tsx`: add Models navigation icon.
- Modify `apps/web/src/App.tsx`: render Models page.
- Modify `apps/web/src/components/inspectors/AnalysisInspector.tsx`: installed ASR model selector.
- Modify `apps/web/src/components/inspectors/TranslationInspector.tsx`: curated translation model selector/availability message.
- Modify inspector tests and app tests.
- Modify `apps/web/src/i18n/en.ts` and `apps/web/src/i18n/zh.ts`: Models page and selector copy.

## Task 1: Shared Model Contract

**Files:**
- Create: `packages/shared/src/model.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/model.test.ts`

- [ ] **Step 1: Add failing shared schema tests**

Create `packages/shared/tests/model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ModelCatalogResponseSchema,
  ModelDownloadResponseSchema,
  ModelRegistryEntrySchema
} from "../src/model";

const registryEntry = {
  modelId: "asr-light",
  name: "Faster Whisper Small",
  task: "asr",
  tier: "light",
  runtime: "faster-whisper",
  provider: "faster-whisper",
  version: "2026-06-14",
  languages: ["zh", "en"],
  languagePairs: [],
  modelSizeBytes: 488000000,
  downloadSizeBytes: 244000000,
  diskRequirementBytes: 600000000,
  recommendedHardware: "CPU fallback, NVIDIA GPU recommended",
  licenseName: "MIT",
  licenseUrl: "https://huggingface.co/Systran/faster-whisper-small",
  sourceUrl: "https://example.invalid/asr-light.bin",
  checksumAlgorithm: "sha256",
  checksum: "0".repeat(64),
  termsSummary: "Open model weights; verify upstream license before release."
};

describe("model registry schemas", () => {
  it("parses a curated registry entry", () => {
    const parsed = ModelRegistryEntrySchema.parse(registryEntry);
    expect(parsed.modelId).toBe("asr-light");
    expect(parsed.task).toBe("asr");
  });

  it("parses catalog entries merged with installation state", () => {
    const parsed = ModelCatalogResponseSchema.parse({
      models: [
        {
          ...registryEntry,
          installation: {
            modelId: "asr-light",
            status: "installed",
            installedPath: "D:/Diplomat/models/asr-light",
            downloadedBytes: 244000000,
            totalBytes: 244000000,
            checksum: "0".repeat(64),
            errorMessage: null,
            createdAt: "2026-06-14T00:00:00+00:00",
            updatedAt: "2026-06-14T00:01:00+00:00",
            installedAt: "2026-06-14T00:01:00+00:00"
          },
          availability: {
            usable: true,
            reason: null
          }
        }
      ]
    });
    expect(parsed.models[0].availability.usable).toBe(true);
  });

  it("rejects unknown status values", () => {
    expect(() =>
      ModelDownloadResponseSchema.parse({
        modelId: "asr-light",
        status: "half_done",
        downloadedBytes: 0,
        totalBytes: 1,
        message: "bad"
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
corepack pnpm --dir packages/shared exec vitest run tests/model.test.ts
```

Expected: fails because `../src/model` does not exist.

- [ ] **Step 3: Add the shared schemas**

Create `packages/shared/src/model.ts` with enums and object schemas matching the test:

```ts
import { z } from "zod";

export const ModelTaskSchema = z.enum(["asr", "translation"]);
export const ModelTierSchema = z.enum(["light", "high_quality"]);
export const ModelRuntimeSchema = z.enum(["faster-whisper", "ct2-marian", "local-llm"]);
export const ModelInstallStatusSchema = z.enum([
  "not_installed",
  "queued",
  "downloading",
  "verifying",
  "installed",
  "failed",
  "canceled"
]);

export const ModelRegistryEntrySchema = z.object({
  modelId: z.string().min(1),
  name: z.string().min(1),
  task: ModelTaskSchema,
  tier: ModelTierSchema,
  runtime: ModelRuntimeSchema,
  provider: z.string().min(1),
  version: z.string().min(1),
  languages: z.array(z.string().min(2).max(12)),
  languagePairs: z.array(z.tuple([z.string().min(2).max(12), z.string().min(2).max(12)])),
  modelSizeBytes: z.number().int().nonnegative(),
  downloadSizeBytes: z.number().int().nonnegative(),
  diskRequirementBytes: z.number().int().nonnegative(),
  recommendedHardware: z.string().min(1),
  licenseName: z.string().min(1),
  licenseUrl: z.string().min(1),
  sourceUrl: z.string().min(1),
  checksumAlgorithm: z.literal("sha256"),
  checksum: z.string().min(64),
  termsSummary: z.string().min(1)
});

export const ModelInstallationSchema = z.object({
  modelId: z.string().min(1),
  status: ModelInstallStatusSchema,
  installedPath: z.string().nullable(),
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  installedAt: z.string().nullable()
});

export const ModelAvailabilitySchema = z.object({
  usable: z.boolean(),
  reason: z.string().nullable()
});

export const ModelCatalogEntrySchema = ModelRegistryEntrySchema.extend({
  installation: ModelInstallationSchema,
  availability: ModelAvailabilitySchema
});

export const ModelCatalogResponseSchema = z.object({
  models: z.array(ModelCatalogEntrySchema)
});

export const ModelDownloadResponseSchema = z.object({
  modelId: z.string().min(1),
  status: ModelInstallStatusSchema,
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export const ModelDeleteResponseSchema = z.object({
  modelId: z.string().min(1),
  filesDeleted: z.number().int().nonnegative(),
  bytesDeleted: z.number().int().nonnegative(),
  message: z.string().min(1)
});

export type ModelTask = z.infer<typeof ModelTaskSchema>;
export type ModelTier = z.infer<typeof ModelTierSchema>;
export type ModelRuntime = z.infer<typeof ModelRuntimeSchema>;
export type ModelInstallStatus = z.infer<typeof ModelInstallStatusSchema>;
export type ModelRegistryEntry = z.infer<typeof ModelRegistryEntrySchema>;
export type ModelInstallation = z.infer<typeof ModelInstallationSchema>;
export type ModelCatalogEntry = z.infer<typeof ModelCatalogEntrySchema>;
export type ModelCatalogResponse = z.infer<typeof ModelCatalogResponseSchema>;
export type ModelDownloadResponse = z.infer<typeof ModelDownloadResponseSchema>;
export type ModelDeleteResponse = z.infer<typeof ModelDeleteResponseSchema>;
```

Modify `packages/shared/src/index.ts`:

```ts
export * from "./model";
```

- [ ] **Step 4: Run shared model tests**

Run:

```powershell
corepack pnpm --dir packages/shared exec vitest run tests/model.test.ts
corepack pnpm --dir packages/shared typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/shared/src/model.ts packages/shared/src/index.ts packages/shared/tests/model.test.ts
git commit -m "feat(shared): add model manager contract"
```

## Task 2: Worker Registry, Store, And Download Manager

**Files:**
- Create: `worker/diplomat_worker/models/registry.py`
- Create: `worker/diplomat_worker/models/manager.py`
- Create: `worker/diplomat_worker/models/__init__.py`
- Modify: `worker/diplomat_worker/storage/project_store.py`
- Test: `worker/tests/models/test_registry.py`
- Test: `worker/tests/models/test_manager.py`

- [ ] **Step 1: Add failing Worker model tests**

Create tests for registry lookup, install state persistence, local fixture download, checksum mismatch, cancel, retry, safe delete, and unsafe path refusal. Tests should create fixture files under `tmp_path`, compute `sha256`, and inject registry entries with `source_url` pointing to those local files.

Run:

```powershell
python -m pytest worker/tests/models -q
```

Expected: fails because the model package and store methods do not exist.

- [ ] **Step 2: Add registry dataclasses and bundled entries**

Create `worker/diplomat_worker/models/registry.py` with a `ModelRegistryEntry` dataclass, `built_in_model_registry()`, and `get_model_entry(model_id, registry)`.

Keep built-in entries curated and metadata-only. Tests can use injected registries to avoid network downloads.

- [ ] **Step 3: Extend `ProjectStore` for model installations**

Add migration/table creation for `model_installations` and methods:

- `models_root() -> Path`
- `safe_model_dir(model_id: str) -> Path`
- `get_model_installation(model_id: str, registry_entry) -> ModelInstallationRecord`
- `list_model_installations() -> list[ModelInstallationRecord]`
- `upsert_model_installation(...)`
- `delete_model_installation(model_id: str)`
- `delete_model_files(model_id: str) -> tuple[int, int]`

Ensure recursive deletion resolves absolute paths and refuses anything outside `root_dir / "models"`.

- [ ] **Step 4: Implement `ModelDownloadManager`**

Create `worker/diplomat_worker/models/manager.py` with:

- `list_catalog()`
- `get_catalog_entry(model_id)`
- `start_download(model_id)`
- `cancel_download(model_id)`
- `retry_download(model_id)`
- `delete_model(model_id)`

Use `ThreadPoolExecutor` and cancellation tokens similar to analysis/translation jobs. For local fixture tests, support plain filesystem paths and `file://` URLs in addition to HTTP URLs.

- [ ] **Step 5: Run Worker model tests**

Run:

```powershell
python -m pytest worker/tests/models -q
```

Expected: all model tests pass.

- [ ] **Step 6: Commit**

```powershell
git add worker/diplomat_worker/models worker/diplomat_worker/storage/project_store.py worker/tests/models
git commit -m "feat(worker): add model registry and install manager"
```

## Task 3: Worker Model API

**Files:**
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing API tests**

Add route-list expectations and behavior tests for:

- `GET /models`.
- `GET /models/{model_id}`.
- `POST /models/{model_id}/download`.
- `POST /models/{model_id}/cancel`.
- `POST /models/{model_id}/retry`.
- `DELETE /models/{model_id}`.
- unknown model id returns 404.

Run:

```powershell
python -m pytest worker/tests/api/test_app.py -q
```

Expected: fails until routes and schemas exist.

- [ ] **Step 2: Add API schemas and runtime wiring**

Add Pydantic response classes matching the shared model schemas. Add a `model_registry` field to `WorkerRuntime` with a default value from `built_in_model_registry()`.

- [ ] **Step 3: Add `/models` routes**

In `create_app`, add lazy `get_model_manager()` and route handlers that translate manager records into Pydantic responses.

- [ ] **Step 4: Run Worker API tests**

Run:

```powershell
python -m pytest worker/tests/models worker/tests/api/test_app.py -q
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/api/runtime.py worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose model manager api"
```

## Task 4: Web API, Query Hooks, And Models Page

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/queries/queryKeys.ts`
- Create: `apps/web/src/queries/modelQueries.ts`
- Create: `apps/web/src/pages/ModelsPage.tsx`
- Create: `apps/web/src/pages/ModelsPage.test.tsx`
- Modify: `apps/web/src/state/uiStore.ts`
- Modify: `apps/web/src/components/AppRail.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/tests/App.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Add failing Web tests**

Tests should verify:

- Models rail item opens Models page.
- Models page renders model name, tier, runtime, license, status, and language support.
- Download, cancel, retry, and delete buttons call the expected endpoints.
- Unknown/unavailable status is surfaced as an error state.

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ModelsPage.test.tsx tests/App.test.tsx
```

Expected: fails because page/hooks do not exist.

- [ ] **Step 2: Add API helpers and hooks**

Add:

- `listModels()`
- `fetchModel(modelId)`
- `downloadModel(modelId)`
- `cancelModelDownload(modelId)`
- `retryModelDownload(modelId)`
- `deleteModel(modelId)`

React Query hooks should invalidate `queryKeys.models` after mutations.

- [ ] **Step 3: Add Models page and rail navigation**

Create a dense Models page with task filter, catalog table, metadata details, and actions. Use icon buttons where practical and keep card radius at 8px or below.

- [ ] **Step 4: Run Web page tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/ModelsPage.test.tsx tests/App.test.tsx src/components/AppRail.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/api.ts apps/web/src/queries/queryKeys.ts apps/web/src/queries/modelQueries.ts apps/web/src/pages/ModelsPage.tsx apps/web/src/pages/ModelsPage.test.tsx apps/web/src/state/uiStore.ts apps/web/src/components/AppRail.tsx apps/web/src/App.tsx apps/web/tests/App.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add model manager page"
```

## Task 5: Workbench Model Selection Integration

**Files:**
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify as needed: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify as needed: `apps/web/src/pages/WorkbenchPage.test.tsx`

- [ ] **Step 1: Add failing inspector tests**

Analysis inspector should show installed ASR models and set `provider: "faster-whisper"` plus `modelNameOrPath` to the installed path. Translation inspector should show curated translation models and prevent starting a local translation model that is unavailable or not yet executable in 0.23.

- [ ] **Step 2: Pass model catalog into inspectors**

Workbench should query models and pass catalog entries to inspectors. Keep existing tests stable by defaulting to an empty catalog and preserving deterministic fake paths where tests explicitly use them.

- [ ] **Step 3: Update inspector UI**

Replace the primary free-form model field with an installed model selector when installed catalog entries exist. Keep an advanced/dev fallback only when no installed model exists, with clear copy that the formal path is Models page installation.

- [ ] **Step 4: Run focused inspector tests**

Run:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/components/inspectors/AnalysisInspector.tsx apps/web/src/components/inspectors/AnalysisInspector.test.tsx apps/web/src/components/inspectors/TranslationInspector.tsx apps/web/src/components/inspectors/TranslationInspector.test.tsx apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx
git commit -m "feat(web): select installed curated models"
```

## Task 6: Verification, Review, Merge, Push

**Files:**
- Create: `docs/development/0-23-stage-gate-review.md`
- Modify only if needed: `docs/development/0-23-model-manager.md`

- [ ] **Step 1: Run focused verification**

```powershell
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/models worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/pages/ModelsPage.test.tsx src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx tests/App.test.tsx tests/api.test.ts
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full repository verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Attempt Browser smoke for Models page**

Start Vite and try the in-app Browser. If Browser URL policy blocks localhost again, record that exact limitation and do not bypass with another browser surface.

- [ ] **Step 4: Write stage gate review**

Record:

- branch and commits.
- automated verification results.
- Browser smoke status.
- model-license metadata notes.
- remaining limitations for real model package downloads and 0.24/0.25 runtime integration.

- [ ] **Step 5: Commit stage gate**

```powershell
git add docs/development/0-23-stage-gate-review.md
git commit -m "docs: accept 0.23 stage gate"
```

- [ ] **Step 6: Merge and push**

```powershell
git switch main
git merge --no-ff codex/0.23-model-manager -m "merge: complete 0.23 model manager"
.\scripts\check.ps1
git push origin main
```

If HTTPS push fails with HTTP/2 connection reset, retry once with:

```powershell
git -c http.version=HTTP/1.1 push origin main
```

## Self-Review

- Spec coverage: covers shared contract, curated registry, install state, download/cancel/retry/delete, checksum verification, UI page, and workbench selection.
- Placeholder scan: no task says TBD or leaves undefined behavior without a concrete implementation target.
- Type consistency: shared schema names match Worker/Web names and all API response names use `Model*` prefixes.
