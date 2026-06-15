# Diplomat 0.33 Model Runtime Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long-video model execution predictable by exposing runtime profiles, validating hardware compatibility, reusing loaded model state, batching translation where supported, and writing benchmark reports.

**Architecture:** Add a Worker-owned runtime capability and profile layer that is separate from model downloads. Resolvers and task managers use that layer before launching ASR or translation work, while the UI consumes profile metadata from the existing model catalog. Benchmark execution stays opt-in through a script/module and is not added to `scripts/check.ps1`.

**Tech Stack:** Python 3.12, FastAPI Worker, dataclasses/Pydantic, pytest, CTranslate2, faster-whisper, TypeScript, Zod, React, Mantine, Vitest.

---

## Files

- Modify: `README.md`
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/desktop/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/Cargo.lock`
- Modify: `worker/pyproject.toml`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `scripts/verify-version.mjs`
- Create: `worker/diplomat_worker/models/capabilities.py`
- Create: `worker/diplomat_worker/models/profiles.py`
- Modify: `worker/diplomat_worker/models/manager.py`
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `worker/diplomat_worker/asr/resolver.py`
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Modify: `worker/diplomat_worker/translation/base.py`
- Modify: `worker/diplomat_worker/translation/config.py`
- Modify: `worker/diplomat_worker/translation/resolver.py`
- Modify: `worker/diplomat_worker/translation/ct2_marian.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Create: `worker/diplomat_worker/tasks/errors.py`
- Create: `worker/diplomat_worker/benchmarks.py`
- Create: `scripts/run-0.33-benchmark.ps1`
- Modify: `packages/shared/src/model.ts`
- Modify: `packages/shared/src/task.ts`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`
- Create: `worker/tests/models/test_profiles.py`
- Modify: `worker/tests/models/test_manager.py`
- Modify: `worker/tests/api/test_app.py`
- Modify: `worker/tests/asr/test_faster_whisper.py`
- Modify: `worker/tests/translation/test_translation_resolver.py`
- Modify: `worker/tests/translation/test_ct2_marian.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Create: `worker/tests/tasks/test_errors.py`
- Create: `worker/tests/test_benchmarks.py`
- Create: `docs/development/0-33-stage-gate-review.md` during stage review

## Task 0: Advance Version Metadata To 0.33.0

**Files:**
- Modify: release metadata files listed above

- [ ] **Step 1: Update version strings**

Set every release metadata value to `0.33.0`. In `scripts/verify-version.mjs`, set:

```js
const expectedVersion = "0.33.0";
```

In `README.md`, update the version section to:

```markdown
Current project version: **0.33.0**
Release tag: **v0.33**
```

- [ ] **Step 2: Refresh lock metadata**

Run:

```powershell
corepack pnpm install --lockfile-only
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Expected: Cargo finishes successfully and `Cargo.lock` records the local package version as `0.33.0`.

- [ ] **Step 3: Verify version metadata**

Run:

```powershell
node .\scripts\verify-version.mjs
```

Expected output:

```text
All release version metadata matches 0.33.0.
```

- [ ] **Step 4: Commit**

```powershell
git add package.json apps/web/package.json apps/desktop/package.json packages/shared/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock worker/pyproject.toml worker/diplomat_worker/__init__.py README.md scripts/verify-version.mjs pnpm-lock.yaml
git commit -m "chore(release): advance version to 0.33.0"
```

## Task 1: Add Runtime Capabilities And Model Profiles

**Files:**
- Create: `worker/diplomat_worker/models/capabilities.py`
- Create: `worker/diplomat_worker/models/profiles.py`
- Create: `worker/tests/models/test_profiles.py`

- [ ] **Step 1: Write failing profile tests**

Create `worker/tests/models/test_profiles.py`:

```python
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.profiles import build_runtime_profiles, find_runtime_profile
from diplomat_worker.models.registry import ModelRegistryEntry


def make_entry(
    *,
    model_id: str = "asr.fixture.small",
    task: str = "asr",
    runtime: str = "faster-whisper",
    provider: str = "faster-whisper",
    tier: str = "light",
) -> ModelRegistryEntry:
    return ModelRegistryEntry(
        model_id=model_id,
        name="Fixture Model",
        task=task,
        tier=tier,
        runtime=runtime,
        provider=provider,
        version="test",
        languages=["zh", "en"],
        language_pairs=[] if task == "asr" else [("zh", "en")],
        model_size_bytes=100,
        download_size_bytes=100,
        disk_requirement_bytes=100,
        recommended_hardware="test hardware",
        license_name="MIT",
        license_url="https://example.invalid/license",
        source_url="https://example.invalid/model.bin",
        checksum_algorithm="sha256",
        checksum="f" * 64,
        terms_summary="Fixture model.",
    )


def test_faster_whisper_profiles_explain_cuda_unavailable() -> None:
    profiles = build_runtime_profiles(
        make_entry(),
        RuntimeCapabilities(cuda_available=False, cuda_device_count=0, detected_by="test"),
    )

    cuda_profile = find_runtime_profile(profiles, device="cuda", compute_type="float16")
    cpu_profile = find_runtime_profile(profiles, device="cpu", compute_type="int8")

    assert cpu_profile is not None
    assert cpu_profile.available is True
    assert cpu_profile.batch_size == 1
    assert cuda_profile is not None
    assert cuda_profile.available is False
    assert cuda_profile.reason == "CUDA is not available in this Worker runtime."


def test_ct2_translation_profiles_include_batch_size() -> None:
    profiles = build_runtime_profiles(
        make_entry(
            model_id="translation.fixture.zh-en",
            task="translation",
            runtime="ct2-marian",
            provider="ct2-marian",
        ),
        RuntimeCapabilities(cuda_available=True, cuda_device_count=1, detected_by="test"),
    )

    profile = find_runtime_profile(profiles, device="cuda", compute_type="float16")

    assert profile is not None
    assert profile.available is True
    assert profile.batch_size == 8
    assert profile.notes == "CTranslate2 batch translation profile."
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/models/test_profiles.py -q
```

Expected: import failure because `models.capabilities` and `models.profiles` do not exist.

- [ ] **Step 3: Implement runtime capabilities**

Create `worker/diplomat_worker/models/capabilities.py`:

```python
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class RuntimeCapabilities:
    cuda_available: bool = False
    cuda_device_count: int = 0
    detected_by: str = "default"


def detect_runtime_capabilities() -> RuntimeCapabilities:
    configured = os.environ.get("DIPLOMAT_CUDA_AVAILABLE")
    if configured is not None:
        enabled = configured.strip().lower() in {"1", "true", "yes", "on"}
        return RuntimeCapabilities(
            cuda_available=enabled,
            cuda_device_count=1 if enabled else 0,
            detected_by="DIPLOMAT_CUDA_AVAILABLE",
        )

    try:
        import ctranslate2
    except ImportError:
        return RuntimeCapabilities()

    try:
        count = int(ctranslate2.get_cuda_device_count())
    except Exception:
        return RuntimeCapabilities(detected_by="ctranslate2")
    return RuntimeCapabilities(
        cuda_available=count > 0,
        cuda_device_count=max(count, 0),
        detected_by="ctranslate2",
    )
```

- [ ] **Step 4: Implement model profiles**

Create `worker/diplomat_worker/models/profiles.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.registry import ModelRegistryEntry


@dataclass(frozen=True)
class ModelRuntimeProfile:
    profile_id: str
    task: str
    provider: str
    device: str
    compute_type: str
    batch_size: int
    recommended: bool
    available: bool
    reason: str | None
    notes: str


def build_runtime_profiles(
    entry: ModelRegistryEntry,
    capabilities: RuntimeCapabilities,
) -> list[ModelRuntimeProfile]:
    if entry.runtime == "faster-whisper":
        return [
            _profile(entry, "cpu", "int8", 1, True, True, None, "CPU fallback ASR profile."),
            _profile(entry, "cpu", "float32", 1, False, True, None, "CPU high precision fallback."),
            _profile(
                entry,
                "cuda",
                "int8",
                1,
                entry.tier == "light",
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CUDA ASR profile.",
            ),
            _profile(
                entry,
                "cuda",
                "float16",
                1,
                entry.tier == "high_quality",
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CUDA float16 ASR profile.",
            ),
        ]
    if entry.runtime == "ct2-marian":
        return [
            _profile(entry, "cpu", "int8", 8, True, True, None, "CTranslate2 batch translation profile."),
            _profile(entry, "cpu", "float32", 4, False, True, None, "CTranslate2 CPU precision profile."),
            _profile(
                entry,
                "cuda",
                "int8",
                16,
                False,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CTranslate2 CUDA batch translation profile.",
            ),
            _profile(
                entry,
                "cuda",
                "float16",
                8,
                True,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "CTranslate2 batch translation profile.",
            ),
        ]
    if entry.runtime == "local-llm":
        return [
            _profile(
                entry,
                "cuda",
                "float16",
                1,
                True,
                capabilities.cuda_available,
                None if capabilities.cuda_available else "CUDA is not available in this Worker runtime.",
                "Local LLM translation profile.",
            )
        ]
    return []


def find_runtime_profile(
    profiles: list[ModelRuntimeProfile],
    *,
    device: str,
    compute_type: str,
) -> ModelRuntimeProfile | None:
    return next(
        (
            profile
            for profile in profiles
            if profile.device == device and profile.compute_type == compute_type
        ),
        None,
    )


def _profile(
    entry: ModelRegistryEntry,
    device: str,
    compute_type: str,
    batch_size: int,
    recommended: bool,
    available: bool,
    reason: str | None,
    notes: str,
) -> ModelRuntimeProfile:
    return ModelRuntimeProfile(
        profile_id=f"{entry.model_id}:{device}:{compute_type}",
        task=entry.task,
        provider=entry.provider,
        device=device,
        compute_type=compute_type,
        batch_size=batch_size,
        recommended=recommended,
        available=available,
        reason=reason,
        notes=notes,
    )
```

- [ ] **Step 5: Run tests**

```powershell
python -m pytest worker/tests/models/test_profiles.py -q
```

Expected: `2 passed`.

- [ ] **Step 6: Commit**

```powershell
git add worker/diplomat_worker/models/capabilities.py worker/diplomat_worker/models/profiles.py worker/tests/models/test_profiles.py
git commit -m "feat(models): add runtime capability profiles"
```

## Task 2: Expose Runtime Profiles Through Model Catalog

**Files:**
- Modify: `worker/diplomat_worker/models/manager.py`
- Modify: `worker/diplomat_worker/api/runtime.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Modify: `packages/shared/src/model.ts`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `worker/tests/models/test_manager.py`
- Modify: `worker/tests/api/test_app.py`
- Modify: `packages/shared/tests/model.test.ts`

- [ ] **Step 1: Add failing catalog tests**

Append to `worker/tests/models/test_manager.py`:

```python
from diplomat_worker.models.capabilities import RuntimeCapabilities


def test_catalog_entry_includes_runtime_profiles(tmp_path: Path) -> None:
    source_path, checksum = write_fixture(tmp_path)
    manager = ModelDownloadManager(
        ProjectStore(tmp_path / "diplomat.db"),
        registry=[make_entry(source_path, checksum)],
        runtime_capabilities=RuntimeCapabilities(cuda_available=False, cuda_device_count=0, detected_by="test"),
        auto_start=False,
    )

    catalog_entry = manager.get_catalog_entry("fixture-asr-light")

    assert catalog_entry.runtime_profiles[0].profile_id == "fixture-asr-light:cpu:int8"
    assert any(profile.reason == "CUDA is not available in this Worker runtime." for profile in catalog_entry.runtime_profiles)
```

Add to `worker/tests/api/test_app.py` inside `test_model_catalog_download_and_delete_routes` after `listed = ...`:

```python
    assert listed["runtimeProfiles"][0]["profileId"] == "api-asr-light:cpu:int8"
    assert listed["runtimeProfiles"][0]["batchSize"] == 1
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/models/test_manager.py::test_catalog_entry_includes_runtime_profiles worker/tests/api/test_app.py::test_model_catalog_download_and_delete_routes -q
```

Expected: `ModelDownloadManager` does not accept `runtime_capabilities` and responses do not include `runtimeProfiles`.

- [ ] **Step 3: Update manager dataclasses**

In `worker/diplomat_worker/models/manager.py`, import profiles and capabilities:

```python
from diplomat_worker.models.capabilities import RuntimeCapabilities
from diplomat_worker.models.profiles import ModelRuntimeProfile, build_runtime_profiles
```

Add `runtime_profiles` to `ModelCatalogEntry`:

```python
@dataclass(frozen=True)
class ModelCatalogEntry:
    registry: ModelRegistryEntry
    installation: ModelInstallationRecord
    availability: ModelAvailability
    runtime_profiles: list[ModelRuntimeProfile]
```

Add a constructor parameter:

```python
        runtime_capabilities: RuntimeCapabilities | None = None,
```

and store:

```python
        self.runtime_capabilities = runtime_capabilities or RuntimeCapabilities()
```

Return profiles from `get_catalog_entry`:

```python
            runtime_profiles=build_runtime_profiles(entry, self.runtime_capabilities),
```

- [ ] **Step 4: Thread capabilities from runtime to API manager**

In `worker/diplomat_worker/api/runtime.py`, import `RuntimeCapabilities` and `detect_runtime_capabilities`, then add:

```python
    runtime_capabilities: RuntimeCapabilities = field(default_factory=detect_runtime_capabilities)
```

In `worker/diplomat_worker/api/app.py`, update `get_model_downloads()` manager creation:

```python
                runtime_capabilities=active_runtime.runtime_capabilities,
```

- [ ] **Step 5: Add API schema mapping**

In `worker/diplomat_worker/api/schemas.py`, add:

```python
class ModelRuntimeProfileResponse(CamelModel):
    profile_id: str = Field(alias="profileId")
    task: Literal["asr", "translation"]
    provider: str
    device: str
    compute_type: str = Field(alias="computeType")
    batch_size: int = Field(alias="batchSize", ge=1)
    recommended: bool
    available: bool
    reason: str | None = None
    notes: str
```

Add to `ModelCatalogEntryResponse`:

```python
    runtime_profiles: list[ModelRuntimeProfileResponse] = Field(alias="runtimeProfiles")
```

In `model_catalog_entry_response`, map:

```python
        runtime_profiles=[
            ModelRuntimeProfileResponse(
                profile_id=profile.profile_id,
                task=profile.task,
                provider=profile.provider,
                device=profile.device,
                compute_type=profile.compute_type,
                batch_size=profile.batch_size,
                recommended=profile.recommended,
                available=profile.available,
                reason=profile.reason,
                notes=profile.notes,
            )
            for profile in entry.runtime_profiles
        ],
```

- [ ] **Step 6: Update shared TypeScript schema**

In `packages/shared/src/model.ts`, add:

```ts
export const ModelRuntimeProfileSchema = z.object({
  profileId: z.string().min(1),
  task: ModelTaskSchema,
  provider: z.string().min(1),
  device: z.string().min(1),
  computeType: z.string().min(1),
  batchSize: z.number().int().positive(),
  recommended: z.boolean(),
  available: z.boolean(),
  reason: z.string().nullable(),
  notes: z.string().min(1)
});
```

Add to `ModelCatalogEntrySchema`:

```ts
  runtimeProfiles: z.array(ModelRuntimeProfileSchema)
```

Export:

```ts
export type ModelRuntimeProfile = z.infer<typeof ModelRuntimeProfileSchema>;
```

Update `apps/web/src/test/fixtures.ts` by adding a `runtimeProfiles` array to each model fixture with at least `cpu/int8` and `cuda/float16` profiles.

- [ ] **Step 7: Run tests**

```powershell
python -m pytest worker/tests/models/test_manager.py worker/tests/api/test_app.py -q
corepack pnpm --dir packages/shared test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add worker/diplomat_worker/models/manager.py worker/diplomat_worker/api/runtime.py worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py packages/shared/src/model.ts apps/web/src/test/fixtures.ts worker/tests/models/test_manager.py worker/tests/api/test_app.py packages/shared/tests/model.test.ts
git commit -m "feat(models): expose runtime profiles in catalog"
```

## Task 3: Validate Hardware Profiles And Map Runtime Failures

**Files:**
- Modify: `worker/diplomat_worker/asr/resolver.py`
- Modify: `worker/diplomat_worker/translation/resolver.py`
- Modify: `worker/diplomat_worker/tasks/analysis.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Create: `worker/diplomat_worker/tasks/errors.py`
- Modify: `worker/tests/translation/test_translation_resolver.py`
- Modify: `worker/tests/tasks/test_analysis_jobs.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Create: `worker/tests/tasks/test_errors.py`

- [ ] **Step 1: Write failing resolver and error mapping tests**

Create `worker/tests/tasks/test_errors.py`:

```python
from diplomat_worker.tasks.errors import classify_runtime_error


def test_classify_runtime_error_maps_out_of_memory() -> None:
    code, message = classify_runtime_error(RuntimeError("CUDA out of memory while allocating"))

    assert code == "RUNTIME_OUT_OF_MEMORY"
    assert "memory" in message.lower()


def test_classify_runtime_error_maps_cuda_unavailable() -> None:
    code, message = classify_runtime_error(RuntimeError("CUDA driver is not available"))

    assert code == "RUNTIME_CUDA_UNAVAILABLE"
    assert "CUDA" in message
```

Append resolver tests that pass `RuntimeCapabilities(cuda_available=False)` and expect:

```python
assert exc_info.value.code == "ASR_CUDA_UNAVAILABLE"
assert exc_info.value.code == "TRANSLATION_CUDA_UNAVAILABLE"
```

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/tasks/test_errors.py worker/tests/asr/test_resolver.py worker/tests/translation/test_translation_resolver.py -q
```

Expected: task error module does not exist and resolver signatures do not accept capabilities.

- [ ] **Step 3: Add runtime error classifier**

Create `worker/diplomat_worker/tasks/errors.py`:

```python
def classify_runtime_error(exc: Exception) -> tuple[str, str]:
    message = str(exc) or exc.__class__.__name__
    lowered = message.lower()
    if "out of memory" in lowered or "oom" in lowered:
        return (
            "RUNTIME_OUT_OF_MEMORY",
            f"Model runtime ran out of memory. Use a lighter model, CPU int8, or a smaller batch size. Details: {message}",
        )
    if "cuda" in lowered and ("not available" in lowered or "driver" in lowered or "no cuda" in lowered):
        return (
            "RUNTIME_CUDA_UNAVAILABLE",
            f"CUDA runtime is unavailable. Switch the model profile to CPU or install a working NVIDIA CUDA runtime. Details: {message}",
        )
    return ("ANALYSIS_FAILED", message)
```

- [ ] **Step 4: Update resolvers**

In both resolvers, accept:

```python
from diplomat_worker.models.capabilities import RuntimeCapabilities

...
    runtime_capabilities: RuntimeCapabilities | None = None,
```

Before accepting `device == "cuda"`:

```python
    capabilities = runtime_capabilities or RuntimeCapabilities()
    if config.device == "cuda" and not capabilities.cuda_available:
        raise AsrConfigurationError(
            "ASR_CUDA_UNAVAILABLE",
            "CUDA is not available in this Worker runtime. Switch to CPU or install a working NVIDIA CUDA runtime.",
        )
```

Use the translation equivalent code and `TranslationConfigurationError`.

- [ ] **Step 5: Pass capabilities from task managers**

In `AnalysisJobManager._resolve_config`, pass:

```python
            runtime_capabilities=self.runtime.runtime_capabilities,
```

In `TranslationJobManager._resolve_config`, pass the same argument.

In generic exception handlers, use `classify_runtime_error`. For translation, convert the fallback code from `ANALYSIS_FAILED` to `TRANSLATION_FAILED` when no specific runtime code matched.

- [ ] **Step 6: Run tests**

```powershell
python -m pytest worker/tests/tasks/test_errors.py worker/tests/asr/test_resolver.py worker/tests/translation/test_translation_resolver.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add worker/diplomat_worker/asr/resolver.py worker/diplomat_worker/translation/resolver.py worker/diplomat_worker/tasks/analysis.py worker/diplomat_worker/tasks/translation.py worker/diplomat_worker/tasks/errors.py worker/tests/tasks/test_errors.py worker/tests/asr/test_resolver.py worker/tests/translation/test_translation_resolver.py worker/tests/tasks/test_analysis_jobs.py worker/tests/tasks/test_translation_jobs.py
git commit -m "feat(runtime): validate hardware profiles before jobs"
```

## Task 4: Reuse Faster-Whisper Runtime Across Chunks

**Files:**
- Modify: `worker/diplomat_worker/asr/faster_whisper.py`
- Modify: `worker/tests/asr/test_faster_whisper.py`

- [ ] **Step 1: Add failing reuse test**

Append to `worker/tests/asr/test_faster_whisper.py`:

```python
def test_faster_whisper_transcriber_reuses_loaded_model_between_chunks(monkeypatch, tmp_path: Path) -> None:
    install_fake_faster_whisper(monkeypatch)
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")
    transcriber = FasterWhisperTranscriber(model_name="small", language="zh")

    transcriber.transcribe(audio_path=audio_path, chunks=[AudioChunk(index=0, start_ms=0, end_ms=30_000)])
    transcriber.transcribe(audio_path=audio_path, chunks=[AudioChunk(index=1, start_ms=30_000, end_ms=60_000)])

    assert len(FakeWhisperModel.instances) == 1
    assert len(FakeWhisperModel.instances[0].transcribe_calls) == 2
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py::test_faster_whisper_transcriber_reuses_loaded_model_between_chunks -q
```

Expected: two fake model instances are created.

- [ ] **Step 3: Add cached model loader and warmup hook**

In `FasterWhisperTranscriber.__init__`, add:

```python
        self._model = None
```

Add:

```python
    def warmup(self, cancel_token: CancelToken | None = None) -> None:
        if cancel_token is not None and cancel_token.is_cancel_requested():
            raise AsrCanceled("Analysis canceled")
        self._load_model()

    def _load_model(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. Install the Worker ASR extras before running local ASR."
            ) from exc
        self._model = WhisperModel(self.model_name, device=self.device, compute_type=self.compute_type)
        return self._model
```

Replace local model construction in `transcribe` with:

```python
        model = self._load_model()
```

- [ ] **Step 4: Run faster-whisper tests**

```powershell
python -m pytest worker/tests/asr/test_faster_whisper.py -q
```

Expected: all faster-whisper tests pass.

- [ ] **Step 5: Commit**

```powershell
git add worker/diplomat_worker/asr/faster_whisper.py worker/tests/asr/test_faster_whisper.py
git commit -m "feat(asr): reuse faster-whisper model across chunks"
```

## Task 5: Add CTranslate2 Batch Translation

**Files:**
- Modify: `worker/diplomat_worker/translation/base.py`
- Modify: `worker/diplomat_worker/translation/config.py`
- Modify: `worker/diplomat_worker/translation/ct2_marian.py`
- Modify: `worker/diplomat_worker/tasks/translation.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `packages/shared/src/task.ts`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `worker/tests/translation/test_ct2_marian.py`
- Modify: `worker/tests/tasks/test_translation_jobs.py`
- Modify: `worker/tests/api/test_app.py`

- [ ] **Step 1: Add failing provider batch test**

Append to `worker/tests/translation/test_ct2_marian.py`:

```python
def test_ct2_marian_provider_translates_batch(monkeypatch, tmp_path: Path) -> None:
    install_fake_ct2_modules(monkeypatch)
    model_path = tmp_path / "translation-model"
    model_path.mkdir()
    (model_path / "source.spm").write_bytes(b"source tokenizer")
    (model_path / "target.spm").write_bytes(b"target tokenizer")
    provider = CTranslate2MarianProvider(model_path=str(model_path), model_label="translation.opus")

    results = provider.translate_batch(
        [
            TranslationRequest("line-1", "你好", "zh", "en"),
            TranslationRequest("line-2", "世界", "zh", "en"),
        ]
    )

    translator = FakeTranslator.instances[0]
    assert translator.translate_calls == [[["▁你好"], ["▁世界"]]]
    assert [result.line_id for result in results] == ["line-1", "line-2"]
```

Add a task-manager test with a fake provider that implements `translate_batch` and assert one batch call for two lines.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
python -m pytest worker/tests/translation/test_ct2_marian.py::test_ct2_marian_provider_translates_batch worker/tests/tasks/test_translation_jobs.py::test_translation_job_uses_batch_provider_when_available -q
```

Expected: `translate_batch` does not exist and task manager uses per-line translation.

- [ ] **Step 3: Extend translation config**

In `TranslationProviderConfig`, add:

```python
    batch_size: int = 8
```

Include it in payloads when provider is local:

```python
        if self.provider in {"ct2-marian", "local-llm"} or self.batch_size != 8:
            payload["batchSize"] = str(self.batch_size)
```

Parse:

```python
            batch_size=int(payload.get("batchSize") or payload.get("batch_size", 8)),
```

Add `batch_size` / `batchSize` to API schemas and shared TypeScript request schemas.

- [ ] **Step 4: Add optional batch protocol**

In `worker/diplomat_worker/translation/base.py`, add:

```python
class BatchTranslationProvider(Protocol):
    def translate_batch(
        self,
        requests: list[TranslationRequest],
        cancel_token: CancelToken | None = None,
    ) -> list[TranslationResult]:
        raise NotImplementedError
```

- [ ] **Step 5: Implement CTranslate2 batch**

In `CTranslate2MarianProvider`, add:

```python
    def translate_batch(
        self,
        requests: list[TranslationRequest],
        cancel_token: CancelToken | None = None,
    ) -> list[TranslationResult]:
        self._raise_if_canceled(cancel_token)
        translator, source_tokenizer, target_tokenizer = self._load_runtime()
        batches = [source_tokenizer.EncodeAsPieces(request.source_text) for request in requests]
        raw_results = translator.translate_batch(batches)
        results = []
        for request, raw in zip(requests, raw_results, strict=True):
            try:
                target_tokens = raw.hypotheses[0]
            except (IndexError, AttributeError) as exc:
                raise RuntimeError("CTranslate2 Marian returned no translation hypotheses") from exc
            results.append(
                TranslationResult(
                    line_id=request.line_id,
                    translated_text=target_tokenizer.DecodePieces(target_tokens).strip(),
                    provider=self.provider,
                    model=self.model_label or self.model_path,
                )
            )
        return results
```

Change `translate()` to call `translate_batch([request], cancel_token=cancel_token)[0]`.

- [ ] **Step 6: Use batches in task manager**

In `TranslationJobManager._run_task`, build `TranslationRequest` objects in groups of `resolved_config.batch_size`. If `hasattr(provider, "translate_batch")`, call it once per group; otherwise call `provider.translate()` per line. Keep progress messages as `Translated X of Y lines`.

- [ ] **Step 7: Run tests**

```powershell
python -m pytest worker/tests/translation/test_ct2_marian.py worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py -q
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx
```

Expected: tests pass. If `pnpm --dir ... exec` cannot find `vitest`, run:

```powershell
.\apps\web\node_modules\.bin\vitest.cmd run src/pages/WorkbenchPage.test.tsx
```

- [ ] **Step 8: Commit**

```powershell
git add worker/diplomat_worker/translation/base.py worker/diplomat_worker/translation/config.py worker/diplomat_worker/translation/ct2_marian.py worker/diplomat_worker/tasks/translation.py worker/diplomat_worker/api/schemas.py packages/shared/src/task.ts apps/web/src/pages/WorkbenchPage.tsx worker/tests/translation/test_ct2_marian.py worker/tests/tasks/test_translation_jobs.py worker/tests/api/test_app.py
git commit -m "feat(translation): batch ctranslate2 jobs"
```

## Task 6: Add Opt-In Benchmark Report Schema And Script

**Files:**
- Create: `worker/diplomat_worker/benchmarks.py`
- Create: `worker/tests/test_benchmarks.py`
- Create: `scripts/run-0.33-benchmark.ps1`

- [ ] **Step 1: Write failing benchmark report tests**

Create `worker/tests/test_benchmarks.py`:

```python
import json
from pathlib import Path

from diplomat_worker.benchmarks import BenchmarkReport, BenchmarkScenario, write_benchmark_report


def test_write_benchmark_report_records_runtime_metadata(tmp_path: Path) -> None:
    report = BenchmarkReport(
        schema_version="diplomat.benchmark.v1",
        created_at="2026-06-15T00:00:00+00:00",
        app_version="0.33.0",
        media_path="D:/media/demo.mp4",
        media_duration_ms=600_000,
        scenario=BenchmarkScenario(
            label="10-minute smoke",
            task="asr",
            provider="faster-whisper",
            model_id="asr.faster-whisper.small",
            device="cpu",
            compute_type="int8",
            batch_size=1,
        ),
        elapsed_ms=1234,
        peak_memory_bytes=99,
        status="completed",
        error_code=None,
        error_message=None,
    )

    path = write_benchmark_report(tmp_path, report)

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["schemaVersion"] == "diplomat.benchmark.v1"
    assert payload["scenario"]["device"] == "cpu"
    assert payload["elapsedMs"] == 1234
```

- [ ] **Step 2: Run test and confirm failure**

```powershell
python -m pytest worker/tests/test_benchmarks.py -q
```

Expected: benchmark module does not exist.

- [ ] **Step 3: Implement benchmark dataclasses and writer**

Create `worker/diplomat_worker/benchmarks.py` with `BenchmarkScenario`, `BenchmarkReport`, `_to_payload`, and `write_benchmark_report(output_dir, report)` using atomic JSON writes and filenames like `benchmark-20260615T000000Z.json`.

- [ ] **Step 4: Add script**

Create `scripts/run-0.33-benchmark.ps1`:

```powershell
param(
  [Parameter(Mandatory = $true)][string]$MediaPath,
  [string]$OutputDir = ".dev\benchmarks",
  [string]$Task = "asr",
  [string]$Provider = "faster-whisper",
  [string]$ModelId = "asr.faster-whisper.small",
  [string]$Device = "cpu",
  [string]$ComputeType = "int8",
  [int]$BatchSize = 1
)

$ErrorActionPreference = "Stop"
python -m diplomat_worker.benchmarks `
  --media "$MediaPath" `
  --output "$OutputDir" `
  --task "$Task" `
  --provider "$Provider" `
  --model-id "$ModelId" `
  --device "$Device" `
  --compute-type "$ComputeType" `
  --batch-size "$BatchSize"
```

The module CLI must write a report even when it only records metadata and elapsed time for the operator-provided smoke. It must not download models and must not run from `scripts/check.ps1`.

- [ ] **Step 5: Run tests**

```powershell
python -m pytest worker/tests/test_benchmarks.py -q
```

Expected: benchmark tests pass.

- [ ] **Step 6: Commit**

```powershell
git add worker/diplomat_worker/benchmarks.py worker/tests/test_benchmarks.py scripts/run-0.33-benchmark.ps1
git commit -m "feat(benchmarks): add opt-in runtime report writer"
```

## Task 7: Show Runtime Profile Explanations In Inspectors

**Files:**
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.tsx`
- Modify: `apps/web/src/components/inspectors/AnalysisInspector.test.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.tsx`
- Modify: `apps/web/src/components/inspectors/TranslationInspector.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Add failing UI tests**

In `AnalysisInspector.test.tsx`, add a catalog entry with an installed model whose `cuda/float16` profile has `available: false` and `reason: "CUDA is not available in this Worker runtime."`. Assert:

```ts
expect(screen.getByText("CUDA is not available in this Worker runtime.")).toBeVisible();
expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
```

In `TranslationInspector.test.tsx`, assert the selected compatible model shows `Batch size 8` for its selected profile.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
.\apps\web\node_modules\.bin\vitest.cmd run src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx
```

Expected: profile messages are not rendered.

- [ ] **Step 3: Add profile helpers in each inspector**

Use:

```ts
function selectedProfile(model: ModelCatalogEntry | null, device: string, computeType: string) {
  return (
    model?.runtimeProfiles.find(
      (profile) => profile.device === device && profile.computeType === computeType
    ) ?? null
  );
}
```

For analysis, compute `selectedModel` and `profile`; set:

```ts
const profileBlocksStart = Boolean(profile && !profile.available);
const canStart = allowDevelopmentControls
  ? !busy
  : !busy && Boolean(installedAsrModelId) && !profileBlocksStart;
```

Render under device/compute controls:

```tsx
{profile ? (
  <Text size="xs" c={profile.available ? "dimmed" : "orange"}>
    {profile.available
      ? t("inspector.runtimeProfile", { device: profile.device, computeType: profile.computeType, batchSize: profile.batchSize })
      : profile.reason}
  </Text>
) : null}
```

For translation, use the same pattern and include the existing language-pair block in `canUseConfig`.

- [ ] **Step 4: Add translations**

In English:

```ts
runtimeProfile: "{{device}} · {{computeType}} · Batch size {{batchSize}}",
```

In Chinese:

```ts
runtimeProfile: "{{device}} · {{computeType}} · 批量 {{batchSize}}",
```

- [ ] **Step 5: Run tests**

```powershell
.\apps\web\node_modules\.bin\vitest.cmd run src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx src/pages/WorkbenchPage.test.tsx
```

Expected: inspector and workbench tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/components/inspectors/AnalysisInspector.tsx apps/web/src/components/inspectors/AnalysisInspector.test.tsx apps/web/src/components/inspectors/TranslationInspector.tsx apps/web/src/components/inspectors/TranslationInspector.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): explain runtime profile availability"
```

## Task 8: Full Verification And 0.33 Stage Gate

**Files:**
- Create: `docs/development/0-33-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
python -m pytest worker/tests/models worker/tests/translation/test_ct2_marian.py worker/tests/tasks/test_translation_jobs.py worker/tests/test_benchmarks.py worker/tests/tasks/test_errors.py -q
.\apps\web\node_modules\.bin\vitest.cmd run src/pages/ModelsPage.test.tsx src/components/inspectors/AnalysisInspector.test.tsx src/components/inspectors/TranslationInspector.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full repository verification**

Use the Python PATH injection if `python` is not on PATH:

```powershell
$env:PATH='C:\Users\Drew\AppData\Local\Programs\Python\Python312;' + $env:PATH; .\scripts\check.ps1
```

Expected: JavaScript, Rust, TypeScript, and Python checks pass.

- [ ] **Step 3: Write stage gate review**

Create `docs/development/0-33-stage-gate-review.md` recording:

- Runtime profiles exposed in the model catalog.
- Hardware compatibility validation before ASR and translation job start.
- Faster-whisper model reuse across chunked ASR.
- CTranslate2 batch translation support.
- Runtime out-of-memory and CUDA-unavailable diagnostic mapping.
- Benchmark report schema and opt-in script.
- Focused and full verification evidence.
- Manual benchmark smoke status.

- [ ] **Step 4: Commit stage gate**

```powershell
git add docs/development/0-33-stage-gate-review.md
git commit -m "docs: record 0.33 stage gate review"
```

- [ ] **Step 5: Merge and push after acceptance**

```powershell
git switch main
git merge --no-ff codex/0.33-model-runtime-performance -m "merge: complete 0.33 model runtime performance"
git push origin main
```

Expected: merge and push succeed. Start 0.34 planning only after the push succeeds.

## Self-Review

- Spec coverage: runtime profiles, hardware compatibility checks, model health explanations, warmup/reuse hooks, CTranslate2 batch mode, memory/CUDA diagnostics, benchmark report schema, and full verification are mapped to tasks.
- Placeholder scan: no task uses TBD, TODO, or vague "add tests" language; each task names files, commands, and expected results.
- Type consistency: `RuntimeCapabilities`, `ModelRuntimeProfile`, `runtimeProfiles`, `batchSize`, `classify_runtime_error`, and benchmark schema names are introduced before use and reused consistently.
