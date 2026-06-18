# Diplomat 0.36 Material Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Web/Tauri desktop experience into a Material Design 3 inspired workstation while preserving current workflows.

**Architecture:** Keep the existing React, Mantine, Zustand, and Tauri structure. Add a focused design-token layer, update the app shell and shared surfaces, then polish core pages with stable layout and test coverage.

**Tech Stack:** React 19, TypeScript, Vite, Mantine 9, Tabler Icons, Zustand, Vitest, Playwright, Tauri 2.

---

## Files

- Modify: `package.json`
- Modify: `worker/pyproject.toml`
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `worker/diplomat_worker/__init__.py`
- Modify: `README.md`
- Modify: `scripts/verify-version.mjs`
- Modify: `apps/web/src/app/theme.ts`
- Modify: `apps/web/src/app/AppShellLayout.tsx`
- Modify: `apps/web/src/components/AppRail.tsx`
- Modify: `apps/web/src/components/TaskStatusSurface.tsx`
- Modify: `apps/web/src/pages/WorkbenchPage.tsx`
- Modify: `apps/web/src/pages/ModelsPage.tsx`
- Modify: `apps/web/src/pages/TasksPage.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/pages/HelpPage.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/app/AppProviders.test.tsx`
- Test: `apps/web/src/components/AppRail.test.tsx`
- Test: `apps/web/src/components/TaskStatusSurface.tsx`
- Test: `apps/web/src/pages/WorkbenchPage.test.tsx`
- Test: `apps/web/src/pages/ModelsPage.test.tsx`
- Test: `apps/web/src/pages/TasksPage.test.tsx`

### Task 1: Start 0.36 Branch And Version Metadata

- [ ] **Step 1: Create the stage branch**

Run:

```powershell
git switch -c codex/0.36-material-workstation
```

Expected: branch switches to `codex/0.36-material-workstation`.

- [ ] **Step 2: Check for unrelated local changes**

Run:

```powershell
git status --short --branch
```

Expected: only known pre-existing local changes are present. Do not stage `apps/desktop/src-tauri/Cargo.toml` unless the 0.36 version metadata change intentionally touches it and the diff is reviewed line-by-line.

- [ ] **Step 3: Update version metadata to 0.36.0**

Update the same files used by previous release stages:

```text
package.json
worker/pyproject.toml
apps/desktop/package.json
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/tauri.conf.json
worker/diplomat_worker/__init__.py
README.md
scripts/verify-version.mjs
```

Expected: every formal version reference moves from `0.35.0` to `0.36.0`.

- [ ] **Step 4: Verify version metadata**

Run:

```powershell
node .\scripts\verify-version.mjs
```

Expected: version metadata verification passes for `0.36.0`.

- [ ] **Step 5: Commit version metadata**

Run:

```powershell
git add package.json worker/pyproject.toml apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/tauri.conf.json worker/diplomat_worker/__init__.py README.md scripts/verify-version.mjs
git commit -m "chore(release): advance version to 0.36.0"
```

Expected: commit contains only intended version metadata changes.

### Task 2: Add Material Workstation Theme Tokens

- [ ] **Step 1: Extend `appTheme`**

Modify `apps/web/src/app/theme.ts` to define 0.36 workstation tokens:

```ts
import { createTheme, rem } from "@mantine/core";

export const workstationSurfaces = {
  app: "#f4f7fb",
  rail: "#111827",
  header: "#ffffff",
  panel: "#ffffff",
  panelAlt: "#f8fafc",
  outline: "#d7dee8",
  outlineStrong: "#aab7c7",
  text: "#111827",
  textMuted: "#5b677a",
  success: "#0f766e",
  warning: "#b45309",
  danger: "#be123c"
};

export const appTheme = createTheme({
  primaryColor: "teal",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  },
  radius: {
    xs: rem(3),
    sm: rem(4),
    md: rem(6),
    lg: rem(8),
    xl: rem(8)
  },
  colors: {
    diplomatTeal: [
      "#e6fffb",
      "#c8f7f0",
      "#99f6e4",
      "#5eead4",
      "#2dd4bf",
      "#14b8a6",
      "#0f766e",
      "#115e59",
      "#134e4a",
      "#042f2e"
    ]
  },
  other: {
    workstationSurfaces
  }
});
```

Expected: current Mantine provider still loads and no page imports break.

- [ ] **Step 2: Add theme tests**

Update `apps/web/src/app/AppProviders.test.tsx` to assert the app renders with the theme and no provider error.

Run:

```powershell
corepack pnpm --dir apps/web test -- AppProviders
```

Expected: AppProviders tests pass.

- [ ] **Step 3: Commit theme tokens**

Run:

```powershell
git add apps/web/src/app/theme.ts apps/web/src/app/AppProviders.test.tsx
git commit -m "feat(web): add workstation theme tokens"
```

Expected: commit contains theme-only changes.

### Task 3: Rework App Shell And Navigation Rail

- [ ] **Step 1: Update `AppShellLayout`**

Modify `apps/web/src/app/AppShellLayout.tsx` so the header has:

- app name.
- current page label.
- Worker/runtime status surface placeholder.
- language switcher.

The shell must use stable heights and widths:

```text
header height: 56
navbar width: 72
main padding top: 56
main padding left: 72
```

- [ ] **Step 2: Update `AppRail`**

Modify `apps/web/src/components/AppRail.tsx` so navigation uses icon-first items with accessible labels, active state, tooltips, and stable button dimensions.

- [ ] **Step 3: Update tests**

Update `apps/web/src/components/AppRail.test.tsx` to assert:

- every page navigation item renders.
- active item is visually marked with `aria-current="page"` or an equivalent testable state.
- clicking an item calls navigation.

Run:

```powershell
corepack pnpm --dir apps/web test -- AppRail
```

Expected: AppRail tests pass.

- [ ] **Step 4: Commit shell and rail**

Run:

```powershell
git add apps/web/src/app/AppShellLayout.tsx apps/web/src/components/AppRail.tsx apps/web/src/components/AppRail.test.tsx
git commit -m "feat(web): polish desktop shell navigation"
```

Expected: commit contains app shell and navigation changes only.

### Task 4: Improve Long-Task Status Surface

- [ ] **Step 1: Update `TaskStatusSurface`**

Modify `apps/web/src/components/TaskStatusSurface.tsx` to present:

- active task type.
- task status badge.
- progress bar.
- current message.
- diagnostic log action when available.
- cancel or retry action when available.

- [ ] **Step 2: Add visual states**

Use colors consistently:

```text
running: teal
queued: blue-gray
completed: green
failed: rose
canceled: amber
```

- [ ] **Step 3: Update tests**

Add or update tests to cover queued, running, completed, failed, and canceled states.

Run:

```powershell
corepack pnpm --dir apps/web test -- TaskStatusSurface
```

Expected: TaskStatusSurface tests pass.

- [ ] **Step 4: Commit task surface**

Run:

```powershell
git add apps/web/src/components/TaskStatusSurface.tsx apps/web/src/components/TaskStatusSurface.test.tsx
git commit -m "feat(web): clarify long task status surface"
```

Expected: commit contains task status changes only.

### Task 5: Workbench Layout Polish

- [ ] **Step 1: Reorganize Workbench surfaces**

Modify `apps/web/src/pages/WorkbenchPage.tsx` and related CSS so the workbench has:

- project/context strip.
- video preview and timeline region.
- subtitle grid region.
- inspector region.
- recovery/task status region.

Use stable responsive grid constraints and avoid nested card styling.

- [ ] **Step 2: Preserve workflows**

Confirm existing actions still appear:

- create/open project.
- analyze.
- translate.
- save.
- export.
- edit selected line.
- undo/redo where currently supported.

- [ ] **Step 3: Update tests**

Update `WorkbenchPage.test.tsx` for any label or structure changes while preserving behavior assertions.

Run:

```powershell
corepack pnpm --dir apps/web test -- WorkbenchPage
```

Expected: WorkbenchPage tests pass.

- [ ] **Step 4: Commit Workbench polish**

Run:

```powershell
git add apps/web/src/pages/WorkbenchPage.tsx apps/web/src/pages/WorkbenchPage.test.tsx apps/web/src/App.css
git commit -m "feat(web): refine workstation workbench layout"
```

Expected: commit contains Workbench layout and tests.

### Task 6: Page Polish For Models, Tasks, Settings, And Help

- [ ] **Step 1: Polish Models page**

Modify `apps/web/src/pages/ModelsPage.tsx` so model cards show:

- model name.
- runtime.
- readiness.
- installed/download status.
- profile availability.
- clear action area.

- [ ] **Step 2: Polish Tasks page**

Modify `apps/web/src/pages/TasksPage.tsx` so long tasks are easier to scan by type, status, project, progress, and recovery action.

- [ ] **Step 3: Polish Settings page**

Modify `apps/web/src/pages/SettingsPage.tsx` so runtime readiness, release blockers, and desktop diagnostics are grouped into clear sections.

- [ ] **Step 4: Polish Help page**

Modify `apps/web/src/pages/HelpPage.tsx` to explain model, long-video, recovery, and release-readiness workflows as compact desktop help, not marketing copy.

- [ ] **Step 5: Update page tests**

Run:

```powershell
corepack pnpm --dir apps/web test -- ModelsPage TasksPage SettingsPage HelpPage
```

Expected: all page tests pass.

- [ ] **Step 6: Commit page polish**

Run:

```powershell
git add apps/web/src/pages/ModelsPage.tsx apps/web/src/pages/ModelsPage.test.tsx apps/web/src/pages/TasksPage.tsx apps/web/src/pages/TasksPage.test.tsx apps/web/src/pages/SettingsPage.tsx apps/web/src/pages/SettingsPage.test.tsx apps/web/src/pages/HelpPage.tsx apps/web/src/pages/HelpPage.test.tsx apps/web/src/App.css
git commit -m "feat(web): polish workstation support pages"
```

Expected: commit contains support page UI changes and tests.

### Task 7: Visual And Repository Verification

- [ ] **Step 1: Run focused Web checks**

Run:

```powershell
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
```

Expected: Web tests and typecheck pass.

- [ ] **Step 2: Run Playwright checks**

Run:

```powershell
corepack pnpm --dir apps/web e2e
```

Expected: E2E tests pass. If screenshot baselines intentionally change, inspect the new screenshots before updating baselines.

- [ ] **Step 3: Run full repository verification**

Run:

```powershell
.\scripts\check.ps1
```

Expected: full repository verification passes.

- [ ] **Step 4: Write stage gate review**

Create `docs/development/0-36-stage-gate-review.md` recording:

- scope completed.
- focused verification.
- full verification.
- visual inspection notes.
- known limitations.
- acceptance decision.

- [ ] **Step 5: Commit stage gate**

Run:

```powershell
git add docs/development/0-36-stage-gate-review.md
git commit -m "docs: accept 0.36 material workstation gate"
```

Expected: stage gate commit is created after verification.

### Task 8: Merge And Push 0.36

- [ ] **Step 1: Confirm branch status**

Run:

```powershell
git status --short --branch
```

Expected: no unintended changes are staged or unstaged for 0.36.

- [ ] **Step 2: Merge to main**

Run:

```powershell
git switch main
git merge --no-ff codex/0.36-material-workstation -m "merge: complete 0.36 material workstation"
```

Expected: merge commit is created on `main`.

- [ ] **Step 3: Push main**

Run:

```powershell
git push origin main
```

Expected: GitHub `main` advances to the 0.36 merge commit.

- [ ] **Step 4: Begin next stage**

After push succeeds, start 0.37 by writing the detailed implementation plan for `docs/development/0-37-model-directory-manifests.md`.

