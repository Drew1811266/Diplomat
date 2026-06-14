# Diplomat 0.30 Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Diplomat into a 0.3.0 Windows desktop release candidate with version gates, packaging metadata, release readiness checks, in-app help, release docs, and explicit blocker handling.

**Architecture:** Add a small release-readiness contract shared between Worker and Web, expose it from the Worker, and surface it in Settings. Keep user-facing release guidance in a dedicated Help Center page. Add a repository version verifier so release metadata drift fails automated checks.

**Tech Stack:** Node.js script for version verification, TypeScript/Zod/Vitest/React/Mantine/React Query, Python/FastAPI/Pydantic/pytest, Tauri 2 config, PowerShell release checks, Markdown release docs.

---

## File Structure

- Create `scripts/verify-version.mjs`: validates all release version metadata.
- Modify `scripts/check.ps1`: run version verification before package tests.
- Modify version metadata:
  - `package.json`
  - `apps/web/package.json`
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `apps/desktop/src-tauri/Cargo.toml`
  - `apps/desktop/src-tauri/Cargo.lock`
  - `packages/shared/package.json`
  - `worker/pyproject.toml`
  - `worker/diplomat_worker/__init__.py`
  - `README.md`
- Modify `apps/desktop/src-tauri/tauri.conf.json`: enable bundle metadata and icons.
- Create `packages/shared/src/release.ts`: release readiness schemas and types.
- Modify `packages/shared/src/index.ts`: export release contracts.
- Create `packages/shared/tests/release.test.ts`: shared release contract tests.
- Create `worker/diplomat_worker/release/readiness.py`: release readiness audit builder.
- Create `worker/diplomat_worker/release/__init__.py`.
- Create `worker/tests/release/test_readiness.py`: Worker readiness tests.
- Modify `worker/diplomat_worker/api/schemas.py`: release readiness response schemas.
- Modify `worker/diplomat_worker/api/app.py`: `GET /release/readiness`.
- Modify `worker/tests/api/test_app.py`: route coverage.
- Modify `apps/web/src/api.ts`: `fetchReleaseReadiness`.
- Modify `apps/web/tests/api.test.ts`: helper coverage.
- Modify `apps/web/src/queries/queryKeys.ts`: release readiness query key.
- Create `apps/web/src/queries/releaseQueries.ts`: query hook.
- Create `apps/web/src/pages/HelpPage.tsx`: in-app Help Center.
- Create `apps/web/src/pages/HelpPage.test.tsx`.
- Modify `apps/web/src/state/uiStore.ts`: add `help` page.
- Modify `apps/web/src/components/AppRail.tsx` and `.test.tsx`: add Help navigation.
- Modify `apps/web/src/App.tsx` and `apps/web/tests/App.test.tsx`: route Help page.
- Modify `apps/web/src/pages/SettingsPage.tsx` and `.test.tsx`: release readiness panel.
- Modify `apps/web/src/i18n/en.ts` and `zh.ts`: Help and release readiness copy.
- Create release docs:
  - `docs/release/0.3-acceptance-script.md`
  - `docs/release/0.3-packaging-checklist.md`
  - `docs/release/0.3-privacy-review.md`
  - `docs/release/0.3-model-audit.md`
  - `docs/release/0.3-ffmpeg-audit.md`
- Create `docs/development/0-30-stage-gate-review.md` after verification.

---

### Task 1: Version Metadata Gate

**Files:**
- Create: `scripts/verify-version.mjs`
- Modify: `scripts/check.ps1`
- Modify version files listed above

- [ ] **Step 1: Write the failing version verifier**

Create `scripts/verify-version.mjs` with a hard-coded release version:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedVersion = "0.3.0";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const checks = [
  ["package.json", readJson("package.json").version],
  ["apps/web/package.json", readJson("apps/web/package.json").version],
  ["apps/desktop/package.json", readJson("apps/desktop/package.json").version],
  ["packages/shared/package.json", readJson("packages/shared/package.json").version],
  ["apps/desktop/src-tauri/tauri.conf.json", readJson("apps/desktop/src-tauri/tauri.conf.json").version],
  ["apps/desktop/src-tauri/Cargo.toml", readText("apps/desktop/src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1]],
  ["worker/pyproject.toml", readText("worker/pyproject.toml").match(/^version = "([^"]+)"/m)?.[1]],
  ["worker/diplomat_worker/__init__.py", readText("worker/diplomat_worker/__init__.py").match(/__version__ = "([^"]+)"/)?.[1]],
];

const failures = checks.filter(([, actual]) => actual !== expectedVersion);
if (!readText("README.md").includes("Current project version: **0.3.0**")) {
  failures.push(["README.md", "missing 0.3.0 version line"]);
}

if (failures.length > 0) {
  console.error("Version verification failed:");
  for (const [file, actual] of failures) {
    console.error(`- ${file}: ${actual ?? "missing"} !== ${expectedVersion}`);
  }
  process.exit(1);
}

console.log(`All release version metadata matches ${expectedVersion}.`);
```

- [ ] **Step 2: Run and verify failure**

```powershell
node scripts/verify-version.mjs
```

Expected: fails because current metadata is `0.2.0`.

- [ ] **Step 3: Bump version metadata and check script**

Update all listed version files to `0.3.0`, update README version line, and add this near the start of `scripts/check.ps1`:

```powershell
Write-Host "Verifying release version metadata"
node .\scripts\verify-version.mjs
```

- [ ] **Step 4: Verify and commit**

```powershell
node scripts/verify-version.mjs
corepack pnpm --dir apps/desktop test
git add scripts/verify-version.mjs scripts/check.ps1 package.json apps/web/package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock packages/shared/package.json worker/pyproject.toml worker/diplomat_worker/__init__.py README.md
git commit -m "chore(release): verify 0.3 version metadata"
```

---

### Task 2: Shared Release Readiness Contract

**Files:**
- Create: `packages/shared/src/release.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/release.test.ts`

- [ ] **Step 1: Write failing shared tests**

Create `packages/shared/tests/release.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ReleaseReadinessResponseSchema } from "../src";

describe("release readiness contracts", () => {
  it("parses release readiness reports with blockers and warnings", () => {
    const report = ReleaseReadinessResponseSchema.parse({
      version: "0.3.0",
      generatedAt: "2026-06-14T00:00:00+00:00",
      ready: false,
      summary: { pass: 1, warning: 1, blocker: 1 },
      checks: [
        {
          id: "version_metadata",
          label: "Version metadata",
          severity: "pass",
          message: "All version metadata matches 0.3.0.",
          remediation: null
        },
        {
          id: "model_registry_checksums",
          label: "Model registry checksums",
          severity: "blocker",
          message: "Placeholder checksums remain.",
          remediation: "Replace placeholders with audited package checksums."
        },
        {
          id: "ffmpeg_available",
          label: "FFmpeg",
          severity: "warning",
          message: "FFmpeg is not bundled in development.",
          remediation: "Verify release binary distribution."
        }
      ]
    });

    expect(report.ready).toBe(false);
    expect(report.summary.blocker).toBe(1);
  });
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
corepack pnpm --dir packages/shared test
```

Expected: fails because release schemas are missing.

- [ ] **Step 3: Implement schemas**

Create `packages/shared/src/release.ts`:

```ts
import { z } from "zod";

export const ReleaseReadinessSeveritySchema = z.enum(["pass", "warning", "blocker"]);

export const ReleaseReadinessCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  severity: ReleaseReadinessSeveritySchema,
  message: z.string().min(1),
  remediation: z.string().min(1).nullable()
});

export const ReleaseReadinessSummarySchema = z.object({
  pass: z.number().int().nonnegative(),
  warning: z.number().int().nonnegative(),
  blocker: z.number().int().nonnegative()
});

export const ReleaseReadinessResponseSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().min(1),
  ready: z.boolean(),
  summary: ReleaseReadinessSummarySchema,
  checks: z.array(ReleaseReadinessCheckSchema)
});

export type ReleaseReadinessSeverity = z.infer<typeof ReleaseReadinessSeveritySchema>;
export type ReleaseReadinessCheck = z.infer<typeof ReleaseReadinessCheckSchema>;
export type ReleaseReadinessSummary = z.infer<typeof ReleaseReadinessSummarySchema>;
export type ReleaseReadinessResponse = z.infer<typeof ReleaseReadinessResponseSchema>;
```

Export it from `packages/shared/src/index.ts`:

```ts
export * from "./release";
```

- [ ] **Step 4: Verify and commit**

```powershell
corepack pnpm --dir packages/shared test
git add packages/shared/src/release.ts packages/shared/src/index.ts packages/shared/tests/release.test.ts
git commit -m "feat(shared): add release readiness contract"
```

---

### Task 3: Worker Release Readiness API

**Files:**
- Create: `worker/diplomat_worker/release/__init__.py`
- Create: `worker/diplomat_worker/release/readiness.py`
- Test: `worker/tests/release/test_readiness.py`
- Modify: `worker/diplomat_worker/api/schemas.py`
- Modify: `worker/diplomat_worker/api/app.py`
- Test: `worker/tests/api/test_app.py`

- [ ] **Step 1: Write failing Worker readiness tests**

Create `worker/tests/release/test_readiness.py`:

```python
from diplomat_worker.release.readiness import build_release_readiness_report
from diplomat_worker.models.registry import built_in_model_registry


def test_release_readiness_flags_placeholder_model_checksums() -> None:
    report = build_release_readiness_report(
        version="0.3.0",
        registry=built_in_model_registry(),
        ffmpeg_status={"status": "available", "message": "ok"},
        ffprobe_status={"status": "available", "message": "ok"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    checksum_check = next(check for check in report.checks if check.id == "model_registry_checksums")

    assert checksum_check.severity == "blocker"
    assert report.ready is False


def test_release_readiness_passes_when_inputs_are_audited(fixture_registry) -> None:
    report = build_release_readiness_report(
        version="0.3.0",
        registry=fixture_registry,
        ffmpeg_status={"status": "available", "message": "ok"},
        ffprobe_status={"status": "available", "message": "ok"},
        desktop_bundle_active=True,
        help_center_available=True,
        release_docs_available=True,
    )

    assert report.summary["blocker"] == 0
    assert report.ready is True
```

Define `fixture_registry` in the test with non-placeholder checksums and downloadable `file://` or `.zip` style sources.

- [ ] **Step 2: Run and verify failure**

```powershell
python -m pytest worker/tests/release/test_readiness.py -q
```

Expected: fails because the release package does not exist.

- [ ] **Step 3: Implement readiness builder and API schemas**

`readiness.py` should define dataclasses `ReleaseReadinessCheck` and `ReleaseReadinessReport`, plus:

```python
def build_release_readiness_report(
    *,
    version: str,
    registry: list[ModelRegistryEntry],
    ffmpeg_status: Mapping[str, str],
    ffprobe_status: Mapping[str, str],
    desktop_bundle_active: bool,
    help_center_available: bool,
    release_docs_available: bool,
) -> ReleaseReadinessReport:
    ...
```

Rules:

- checksum of all zeroes is a blocker.
- empty license name or URL is a blocker.
- `source_url` starting with `https://huggingface.co/` and containing only repo owner/name is a blocker because it is a model-card page, not a package artifact.
- missing FFmpeg or FFprobe is a blocker in release mode.
- inactive desktop bundle is a blocker.
- missing Help Center or release docs is a blocker.
- version not `0.3.0` is a blocker.

Add Pydantic response schemas to `api/schemas.py` and `GET /release/readiness` to `api/app.py`.

- [ ] **Step 4: Verify and commit**

```powershell
python -m pytest worker/tests/release/test_readiness.py worker/tests/api/test_app.py -q
git add worker/diplomat_worker/release worker/tests/release/test_readiness.py worker/diplomat_worker/api/schemas.py worker/diplomat_worker/api/app.py worker/tests/api/test_app.py
git commit -m "feat(worker): expose release readiness checks"
```

---

### Task 4: Web Release Readiness And Help Center

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/tests/api.test.ts`
- Modify: `apps/web/src/queries/queryKeys.ts`
- Create: `apps/web/src/queries/releaseQueries.ts`
- Create: `apps/web/src/pages/HelpPage.tsx`
- Create: `apps/web/src/pages/HelpPage.test.tsx`
- Modify: `apps/web/src/state/uiStore.ts`
- Modify: `apps/web/src/components/AppRail.tsx`
- Modify: `apps/web/src/components/AppRail.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/tests/App.test.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/pages/SettingsPage.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write failing Web API and Help tests**

Add `fetchReleaseReadiness` coverage to `apps/web/tests/api.test.ts`, Help page localization tests in `HelpPage.test.tsx`, AppRail expectations for a `Help` button, App route navigation to Help, and Settings expectations for readiness blockers.

- [ ] **Step 2: Run and verify failure**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/pages/HelpPage.test.tsx src/components/AppRail.test.tsx tests/App.test.tsx src/pages/SettingsPage.test.tsx
```

Expected: fails because the API helper, Help page, navigation, and Settings panel are missing.

- [ ] **Step 3: Implement Web release readiness and Help**

Implementation requirements:

- `fetchReleaseReadiness(baseUrl)` calls `/release/readiness` and parses `ReleaseReadinessResponseSchema`.
- `useReleaseReadinessQuery(enabled = true)` polls no more often than ordinary query refetches; no live interval is required.
- `HelpPage` uses sections, not nested cards, and includes first-run, models, local workflow, editing, export, diagnostics, privacy, and release checklist content.
- `AppRail` adds a Help icon button.
- `SettingsPage` shows readiness summary with pass/warning/blocker counts, then a compact list of checks. Use `Badge` colors: teal, orange, red.
- Browser mode may show a Worker API error if `/release/readiness` is unavailable.
- All new copy exists in `en.ts` and `zh.ts`.

- [ ] **Step 4: Verify and commit**

```powershell
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/pages/HelpPage.test.tsx src/components/AppRail.test.tsx tests/App.test.tsx src/pages/SettingsPage.test.tsx
corepack pnpm --dir apps/web typecheck
git add apps/web/src/api.ts apps/web/tests/api.test.ts apps/web/src/queries/queryKeys.ts apps/web/src/queries/releaseQueries.ts apps/web/src/pages/HelpPage.tsx apps/web/src/pages/HelpPage.test.tsx apps/web/src/state/uiStore.ts apps/web/src/components/AppRail.tsx apps/web/src/components/AppRail.test.tsx apps/web/src/App.tsx apps/web/tests/App.test.tsx apps/web/src/pages/SettingsPage.tsx apps/web/src/pages/SettingsPage.test.tsx apps/web/src/i18n/en.ts apps/web/src/i18n/zh.ts
git commit -m "feat(web): add release readiness help center"
```

---

### Task 5: Packaging Metadata And Release Docs

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: root and desktop package scripts
- Modify: `README.md`
- Create release docs under `docs/release/`

- [ ] **Step 1: Write release docs**

Create:

- `docs/release/0.3-acceptance-script.md`
- `docs/release/0.3-packaging-checklist.md`
- `docs/release/0.3-privacy-review.md`
- `docs/release/0.3-model-audit.md`
- `docs/release/0.3-ffmpeg-audit.md`

Each document must include concrete pass/fail checkboxes and explicit blocker status.

- [ ] **Step 2: Enable Tauri bundle metadata**

Update `tauri.conf.json`:

```json
"bundle": {
  "active": true,
  "targets": ["nsis"],
  "icon": ["icons/icon.ico", "icons/icon.png"]
}
```

Add scripts:

```json
"release:check": "node scripts/verify-version.mjs && pnpm -r check",
"desktop:build": "pnpm --dir apps/desktop build"
```

- [ ] **Step 3: Refresh README**

README must describe:

- 0.3.0 local/offline workflow.
- built-in model manager.
- local ASR and local translation.
- SRT/VTT/ASS/burn-in export.
- Help Center and Settings diagnostics.
- Windows/Tauri build path.
- model weights downloaded separately.
- FFmpeg distribution/license requirement.

- [ ] **Step 4: Verify and commit**

```powershell
node scripts/verify-version.mjs
corepack pnpm --dir apps/desktop test
git add apps/desktop/src-tauri/tauri.conf.json package.json apps/desktop/package.json README.md docs/release
git commit -m "docs(release): add 0.3 packaging and acceptance docs"
```

---

### Task 6: Focused Verification, Browser Smoke, Stage Gate, Merge, Push

**Files:**
- Create: `docs/development/0-30-stage-gate-review.md`

- [ ] **Step 1: Run focused verification**

```powershell
node scripts/verify-version.mjs
corepack pnpm --dir packages/shared test
python -m pytest worker/tests/release/test_readiness.py worker/tests/api/test_app.py worker/tests/models/test_registry.py -q
corepack pnpm --dir apps/web exec vitest run tests/api.test.ts src/pages/HelpPage.test.tsx src/components/AppRail.test.tsx tests/App.test.tsx src/pages/SettingsPage.test.tsx
corepack pnpm --dir apps/web typecheck
```

- [ ] **Step 2: Run full verification**

```powershell
.\scripts\check.ps1
```

- [ ] **Step 3: Run desktop packaging smoke where toolchain allows**

```powershell
corepack pnpm --dir apps/web build
corepack pnpm --dir apps/desktop build
```

If the build fails because a Windows packaging prerequisite is missing, record the exact missing prerequisite as a blocker.

- [ ] **Step 4: Run Browser smoke**

Start Worker and Web. In the in-app Browser:

1. Open Project Center.
2. Navigate to Help.
3. Confirm first-run, model, export, diagnostics, and privacy sections are visible.
4. Switch to Chinese and confirm Help remains localized.
5. Navigate to Settings.
6. Confirm release readiness summary and check rows render.
7. Confirm browser console error count is 0.

- [ ] **Step 5: Write stage gate review**

Create `docs/development/0-30-stage-gate-review.md` with:

- commits reviewed.
- focused and full verification results.
- packaging smoke result.
- Browser smoke result.
- release readiness blocker count.
- installer/manual real-model acceptance status.
- final decision.

- [ ] **Step 6: Accept only if no blockers remain**

If release readiness or manual acceptance still has blockers, do not merge 0.30 as accepted. Continue fixing blockers or mark the goal blocked only after the strict blocked-audit threshold is met.

If no blockers remain:

```powershell
git add docs/development/0-30-stage-gate-review.md
git commit -m "docs: accept 0.30 stage gate"
git checkout main
git merge --no-ff codex/0.30-release-hardening -m "merge: complete 0.30 release hardening"
git push origin main
```

---

## Self-Review

- Spec coverage: the plan covers version metadata, packaging metadata, Help Center, localization, privacy docs, model and FFmpeg audits, release readiness checks, README refresh, focused verification, full verification, browser smoke, packaging smoke, stage gate, merge, and push.
- Placeholder scan: the plan intentionally records potential blockers, but implementation steps are concrete and testable.
- Type consistency: shared, Worker, and Web all use the same readiness terms: `ready`, `summary`, `checks`, `severity`, `pass`, `warning`, and `blocker`.
