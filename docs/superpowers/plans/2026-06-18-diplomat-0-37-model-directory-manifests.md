# Diplomat 0.37 Model Directory And Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local development model directory and manifest layer for the 0.4 real-model pipeline without committing model weights.

**Architecture:** Keep the current Worker-owned model registry and download manager. Add repository-level model manifests under `models/manifests`, committed placeholder directories under `models/dev`, a manifest verifier script, and Worker readiness helpers that report missing local model files safely. Do not load or run VibeVoice/Hunyuan inference in 0.37.

**Tech Stack:** Python 3.12, Pydantic/FastAPI Worker, React/Mantine Web model catalog, Node.js verification scripts, Hugging Face model metadata.

---

## Authoritative Model Targets

Use these Hugging Face repositories and revisions for 0.37 metadata:

- ASR: `microsoft/VibeVoice-ASR`
  - Hugging Face revision: `d0c9efdb8d614685062c04425d91e01b6f37d944`
  - License from model card metadata: `mit`
  - Development path: `models/dev/asr/microsoft--VibeVoice-ASR`
- Translation: `tencent/Hunyuan-MT-7B-fp8`
  - Hugging Face revision: `81e5a3f7199524570ba75e61360e990ba88665e4`
  - License metadata is stored in upstream `License.txt`; do not guess a SPDX value.
  - Development path: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8`

Keep `tencent/Hunyuan-MT-7B` documented as the non-FP8 source family, but 0.37 and 0.4 default metadata should target the FP8 repo above.

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
- Modify: `README.md`
- Modify: `scripts/verify-version.mjs`
- Modify: `.gitignore`
- Create: `models/README.md`
- Create: `models/dev/asr/microsoft--VibeVoice-ASR/.gitkeep`
- Create: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8/.gitkeep`
- Create: `models/licenses/accepted/.gitkeep`
- Create: `models/manifests/vibevoice-asr.json`
- Create: `models/manifests/hunyuan-mt-7b-fp8.json`
- Create: `scripts/verify-model-manifests.mjs`
- Modify: `scripts/verify-release-assets.mjs`
- Modify: `worker/diplomat_worker/models/registry.py`
- Create: `worker/diplomat_worker/models/dev_manifests.py`
- Modify: `worker/diplomat_worker/models/manager.py`
- Modify: `worker/tests/models/test_registry.py`
- Create: `worker/tests/models/test_dev_manifests.py`
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/pages/ModelsPage.test.tsx`

## Task 1: Start 0.37 Branch And Version Metadata

**Files:**
- Modify version files listed above.

- [ ] **Step 1: Confirm branch**

Run:

```powershell
git status --short --branch
```

Expected: current branch is `codex/0.37-model-directory-manifests`, with no unstaged changes before editing.

- [ ] **Step 2: Update version metadata to 0.37.0**

Replace `0.36.0` with `0.37.0` in:

```text
package.json
apps/web/package.json
packages/shared/package.json
apps/desktop/package.json
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/tauri.conf.json
worker/pyproject.toml
worker/diplomat_worker/__init__.py
scripts/verify-version.mjs
README.md
```

Run:

```powershell
corepack pnpm install --lockfile-only
node .\scripts\verify-version.mjs
```

Expected: version verification passes and `apps/desktop/src-tauri/Cargo.lock` records `diplomat` version `0.37.0`.

- [ ] **Step 3: Commit version metadata**

Run:

```powershell
git add package.json apps/web/package.json packages/shared/package.json apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock apps/desktop/src-tauri/tauri.conf.json worker/pyproject.toml worker/diplomat_worker/__init__.py scripts/verify-version.mjs README.md
git commit -m "chore(release): advance version to 0.37.0"
```

Expected: commit contains only version metadata and lockfile version churn.

## Task 2: Add Model Directory Skeleton And Git Ignore Rules

**Files:**
- Modify: `.gitignore`
- Create: `models/README.md`
- Create: `models/dev/asr/microsoft--VibeVoice-ASR/.gitkeep`
- Create: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8/.gitkeep`
- Create: `models/licenses/accepted/.gitkeep`

- [ ] **Step 1: Add ignore rules**

Append this block to `.gitignore`:

```gitignore
# Development model storage: keep directories and manifests, never model weights.
models/dev/**
!models/dev/
!models/dev/**/
!models/dev/**/.gitkeep
models/licenses/accepted/**
!models/licenses/accepted/
!models/licenses/accepted/.gitkeep
```

Expected: placeholder directories can be committed, but files placed under model folders remain untracked.

- [ ] **Step 2: Add model directory README**

Create `models/README.md`:

```markdown
# Diplomat Development Models

This directory defines the local development model layout for the 0.4 real-model pipeline.

- `models/manifests/` contains committed JSON metadata for approved model targets.
- `models/dev/` contains local development model folders. Only `.gitkeep` placeholders are committed.
- `models/licenses/accepted/` records local license acceptance state. The directory exists in Git, but local acceptance files are ignored.

Do not commit model weights, tokenizer files, safetensors, checkpoints, caches, or generated license acceptance records.

0.37 approved development paths:

- ASR: `models/dev/asr/microsoft--VibeVoice-ASR`
- Translation: `models/dev/translation/tencent--Hunyuan-MT-7B-fp8`
```

- [ ] **Step 3: Add placeholders**

Create empty `.gitkeep` files in:

```text
models/dev/asr/microsoft--VibeVoice-ASR/.gitkeep
models/dev/translation/tencent--Hunyuan-MT-7B-fp8/.gitkeep
models/licenses/accepted/.gitkeep
```

- [ ] **Step 4: Verify ignore behavior manually**

Run:

```powershell
Set-Content -Path models/dev/asr/microsoft--VibeVoice-ASR/model-00001-of-00008.safetensors -Value "do-not-commit"
git status --short models
Remove-Item -LiteralPath models/dev/asr/microsoft--VibeVoice-ASR/model-00001-of-00008.safetensors
```

Expected: `git status --short models` shows README, manifests/placeholders later, but does not show the fake safetensors file.

- [ ] **Step 5: Commit directory skeleton**

Run:

```powershell
git add .gitignore models/README.md models/dev/asr/microsoft--VibeVoice-ASR/.gitkeep models/dev/translation/tencent--Hunyuan-MT-7B-fp8/.gitkeep models/licenses/accepted/.gitkeep
git commit -m "chore(models): add development model directories"
```

Expected: commit contains only ignore rules, README, and placeholders.

## Task 3: Add Manifest Files And Verification Script

**Files:**
- Create: `models/manifests/vibevoice-asr.json`
- Create: `models/manifests/hunyuan-mt-7b-fp8.json`
- Create: `scripts/verify-model-manifests.mjs`
- Modify: `scripts/verify-release-assets.mjs`

- [ ] **Step 1: Add VibeVoice manifest**

Create `models/manifests/vibevoice-asr.json`:

```json
{
  "schemaVersion": "diplomat.modelManifest.v1",
  "modelId": "asr.microsoft.vibevoice-asr",
  "name": "Microsoft VibeVoice ASR",
  "task": "asr",
  "runtime": "vibevoice-asr",
  "provider": "microsoft",
  "source": {
    "type": "huggingface",
    "repoId": "microsoft/VibeVoice-ASR",
    "revision": "d0c9efdb8d614685062c04425d91e01b6f37d944",
    "url": "https://huggingface.co/microsoft/VibeVoice-ASR"
  },
  "license": {
    "name": "MIT",
    "url": "https://huggingface.co/microsoft/VibeVoice-ASR",
    "acceptanceRequired": false
  },
  "developmentPath": "models/dev/asr/microsoft--VibeVoice-ASR",
  "expectedFiles": [
    "config.json",
    "model-00001-of-00008.safetensors",
    "model-00008-of-00008.safetensors",
    "model.safetensors.index.json"
  ],
  "weightsIgnoredByGit": true,
  "notes": "0.37 metadata only. Runtime inference is planned for 0.38."
}
```

- [ ] **Step 2: Add Hunyuan FP8 manifest**

Create `models/manifests/hunyuan-mt-7b-fp8.json`:

```json
{
  "schemaVersion": "diplomat.modelManifest.v1",
  "modelId": "translation.tencent.hunyuan-mt-7b-fp8",
  "name": "Tencent Hunyuan MT 7B FP8",
  "task": "translation",
  "runtime": "local-llm",
  "provider": "tencent",
  "source": {
    "type": "huggingface",
    "repoId": "tencent/Hunyuan-MT-7B-fp8",
    "revision": "81e5a3f7199524570ba75e61360e990ba88665e4",
    "url": "https://huggingface.co/tencent/Hunyuan-MT-7B-fp8"
  },
  "license": {
    "name": "Upstream License.txt",
    "url": "https://huggingface.co/tencent/Hunyuan-MT-7B-fp8/blob/main/License.txt",
    "acceptanceRequired": true,
    "acceptanceRecord": "models/licenses/accepted/tencent--Hunyuan-MT-7B-fp8.json"
  },
  "developmentPath": "models/dev/translation/tencent--Hunyuan-MT-7B-fp8",
  "expectedFiles": [
    "config.json",
    "generation_config.json",
    "hf_quant_config.json",
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors",
    "model.safetensors.index.json",
    "tokenizer.json",
    "tokenizer_config.json"
  ],
  "weightsIgnoredByGit": true,
  "notes": "0.37 metadata only. Runtime inference is planned for 0.39."
}
```

- [ ] **Step 3: Add verifier script**

Create `scripts/verify-model-manifests.mjs` that:

- Reads every `models/manifests/*.json`.
- Requires schema version `diplomat.modelManifest.v1`.
- Requires unique `modelId`.
- Requires `source.repoId`, `source.revision`, `source.url`.
- Requires `developmentPath` to exist and contain `.gitkeep`.
- Requires `expectedFiles` to be a non-empty array.
- Rejects any non-`.gitkeep` file under `models/dev`.

Run:

```powershell
node .\scripts\verify-model-manifests.mjs
```

Expected: passes with both manifests and no model weights.

- [ ] **Step 4: Wire release asset verification**

Modify `scripts/verify-release-assets.mjs` to import/execute model manifest verification by spawning:

```js
import { spawnSync } from "node:child_process";

const modelManifestCheck = spawnSync(process.execPath, [
  rootPath("scripts/verify-model-manifests.mjs")
], { stdio: "inherit" });
expect(modelManifestCheck.status === 0, "Model manifest verification must pass.");
```

Place this after release doc checks and before final error output.

- [ ] **Step 5: Commit manifests and verifier**

Run:

```powershell
git add models/manifests/vibevoice-asr.json models/manifests/hunyuan-mt-7b-fp8.json scripts/verify-model-manifests.mjs scripts/verify-release-assets.mjs
git commit -m "feat(models): add real model manifests"
```

Expected: manifest verification passes and the commit contains no model weights.

## Task 4: Add Worker Manifest Loader And Registry Entries

**Files:**
- Create: `worker/diplomat_worker/models/dev_manifests.py`
- Modify: `worker/diplomat_worker/models/registry.py`
- Modify: `worker/diplomat_worker/models/manager.py`
- Modify: `worker/tests/models/test_registry.py`
- Create: `worker/tests/models/test_dev_manifests.py`

- [ ] **Step 1: Add manifest loader tests**

Create `worker/tests/models/test_dev_manifests.py` with tests that assert:

- Both manifests load.
- The two approved model IDs are present.
- Missing expected files produce a safe readiness reason.
- License-required Hunyuan is marked blocked until the acceptance record exists.

Run:

```powershell
python -m pytest worker/tests/models/test_dev_manifests.py -q
```

Expected before implementation: import failure for `diplomat_worker.models.dev_manifests`.

- [ ] **Step 2: Implement `dev_manifests.py`**

Create dataclasses:

```python
@dataclass(frozen=True)
class ModelManifestSource:
    type: str
    repo_id: str
    revision: str
    url: str

@dataclass(frozen=True)
class ModelManifestLicense:
    name: str
    url: str
    acceptance_required: bool
    acceptance_record: Path | None

@dataclass(frozen=True)
class ModelDevelopmentManifest:
    model_id: str
    name: str
    task: str
    runtime: str
    provider: str
    source: ModelManifestSource
    license: ModelManifestLicense
    development_path: Path
    expected_files: list[str]
```

Add functions:

```python
def repo_root() -> Path
def load_development_manifests(root: Path | None = None) -> list[ModelDevelopmentManifest]
def get_development_manifest(model_id: str, manifests: list[ModelDevelopmentManifest] | None = None) -> ModelDevelopmentManifest
def development_readiness(manifest: ModelDevelopmentManifest, root: Path | None = None) -> ModelAvailability
```

`development_readiness` returns unusable with these exact reasons:

- `"Development model directory is missing."`
- `"Model license acceptance is required."`
- `"Development model files are missing: <comma-separated files>"`

- [ ] **Step 3: Extend registry model runtime**

Modify `ModelRuntime` in `registry.py` to include `"vibevoice-asr"`.

Add registry entries:

```python
model_id="asr.microsoft.vibevoice-asr"
name="Microsoft VibeVoice ASR"
task="asr"
tier="high_quality"
runtime="vibevoice-asr"
provider="microsoft"
source_url="hf://microsoft/VibeVoice-ASR@d0c9efdb8d614685062c04425d91e01b6f37d944"
license_name="MIT"
```

```python
model_id="translation.tencent.hunyuan-mt-7b-fp8"
name="Tencent Hunyuan MT 7B FP8"
task="translation"
tier="high_quality"
runtime="local-llm"
provider="tencent"
source_url="hf://tencent/Hunyuan-MT-7B-fp8@81e5a3f7199524570ba75e61360e990ba88665e4"
license_name="Upstream License.txt"
```

Use nonzero manifest checksums computed from manifest JSON content in implementation. Do not use `"0" * 64`.

- [ ] **Step 4: Wire readiness into manager**

Modify `ModelDownloadManager._availability` or `get_catalog_entry` so if a registry entry has a matching development manifest and is not installed through the app store, the catalog availability reports the manifest readiness reason instead of crashing.

Expected behavior with only `.gitkeep` placeholders:

- VibeVoice: unusable, reason starts with `"Development model files are missing:"`.
- Hunyuan FP8: unusable, reason is `"Model license acceptance is required."`.

- [ ] **Step 5: Update registry tests**

Extend `worker/tests/models/test_registry.py`:

```python
def test_registry_contains_0_4_real_model_targets() -> None:
    registry = built_in_model_registry()
    assert get_model_entry("asr.microsoft.vibevoice-asr", registry).runtime == "vibevoice-asr"
    assert get_model_entry("translation.tencent.hunyuan-mt-7b-fp8", registry).runtime == "local-llm"
```

Run:

```powershell
python -m pytest worker/tests/models -q
```

Expected: all model tests pass.

- [ ] **Step 6: Commit Worker manifest loader**

Run:

```powershell
git add worker/diplomat_worker/models/dev_manifests.py worker/diplomat_worker/models/registry.py worker/diplomat_worker/models/manager.py worker/tests/models/test_registry.py worker/tests/models/test_dev_manifests.py
git commit -m "feat(worker): report development model readiness"
```

Expected: Worker model tests pass and readiness fails safely with absent model weights.

## Task 5: Expose Real Model Metadata In Web Fixtures

**Files:**
- Modify: `apps/web/src/test/fixtures.ts`
- Modify: `apps/web/src/pages/ModelsPage.test.tsx`

- [ ] **Step 1: Add fixture entries**

Add fixture entries for:

- `asr.microsoft.vibevoice-asr`
- `translation.tencent.hunyuan-mt-7b-fp8`

Use `installation.status: "not_installed"`, `availability.usable: false`, and reasons matching Worker readiness:

- `"Development model files are missing: config.json, model-00001-of-00008.safetensors, model-00008-of-00008.safetensors, model.safetensors.index.json"`
- `"Model license acceptance is required."`

- [ ] **Step 2: Add Web test assertions**

Update `ModelsPage.test.tsx` to assert the two names render and filtering still works:

```ts
expect(await screen.findByText("Microsoft VibeVoice ASR")).toBeVisible();
expect(screen.getByText("Tencent Hunyuan MT 7B FP8")).toBeVisible();
expect(screen.getByText("Model license acceptance is required.")).toBeVisible();
```

Run:

```powershell
corepack pnpm --dir apps/web test -- ModelsPage
corepack pnpm --dir apps/web typecheck
```

Expected: Web tests and typecheck pass.

- [ ] **Step 3: Commit Web metadata**

Run:

```powershell
git add apps/web/src/test/fixtures.ts apps/web/src/pages/ModelsPage.test.tsx
git commit -m "test(web): cover real model catalog targets"
```

Expected: commit contains fixture/test metadata only.

## Task 6: Verification, Gate, Merge, And Push

**Files:**
- Create: `docs/development/0-37-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

Run:

```powershell
node .\scripts\verify-model-manifests.mjs
node .\scripts\verify-release-assets.mjs
python -m pytest worker/tests/models -q
corepack pnpm --dir apps/web test -- ModelsPage
corepack pnpm --dir apps/web typecheck
```

Expected: all pass.

- [ ] **Step 2: Run full verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected: full repository verification passes.

- [ ] **Step 3: Write stage gate**

Create `docs/development/0-37-stage-gate-review.md` with:

- scope completed.
- manifest paths.
- git-ignore proof.
- focused verification output.
- full verification output.
- known limitations.
- decision.

- [ ] **Step 4: Commit stage gate**

Run:

```powershell
git add docs/development/0-37-stage-gate-review.md
git commit -m "docs: accept 0.37 model manifest gate"
```

- [ ] **Step 5: Merge and push**

Run:

```powershell
git switch main
git merge --no-ff codex/0.37-model-directory-manifests -m "merge: complete 0.37 model directory manifests"
git push origin main
```

Expected: GitHub `main` contains 0.37, model placeholders/manifests are committed, and no model weights are committed.

## Self-Review

- Spec coverage: covers version, directory placeholders, manifests, ignore rules, Worker readiness, Web visibility, verification, stage gate, merge, and push.
- Placeholder scan: no step depends on TODO/TBD content.
- Type consistency: model IDs are consistently `asr.microsoft.vibevoice-asr` and `translation.tencent.hunyuan-mt-7b-fp8`; manifest runtime `vibevoice-asr` is added before registry use.
