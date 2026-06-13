# Diplomat 0.2 Frontend Workbench

This document tracks the 0.2 frontend workbench release checks and desktop shell E2E target. Playwright checks are run as explicit release/manual commands instead of from `scripts/check.ps1` because browser cache, headed mode, and visual baselines can vary by developer or CI environment.

## 0.2 Manual/Release Checklist

Run the deterministic web checks from the repository root:

```powershell
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
```

Run the web E2E suite separately:

```powershell
corepack pnpm --dir apps/web e2e
```

Run the desktop smoke target on a machine with a headed browser available:

```powershell
corepack pnpm --dir apps/web e2e:desktop
```

Only update the visual baseline when the 0.2 workbench visual change is intentional, then review the generated PNG diff before committing:

```powershell
corepack pnpm --dir apps/web e2e:update
```

## Current Smoke Target

The desktop smoke target runs through the existing Web Playwright configuration in headed Chromium so it is stable on developer machines while the real Tauri automation path is still being hardened. Run it from the repository root:

```powershell
corepack pnpm --dir apps/web e2e:desktop
```

The script executes:

```powershell
playwright test e2e/desktop-smoke.spec.ts --headed
```

The smoke test uses the existing `apps/web/e2e/fixtures.ts` Worker mocks and only verifies that the Project Center is visible with either English or Chinese UI text. It does not automate a native file picker and does not require a Tauri WebView yet.

## Real Desktop Flow Target

The full 0.2 desktop E2E path should cover the real shell once native automation is reliable:

1. Start the Tauri development app:

   ```powershell
   corepack pnpm --filter @diplomat/desktop dev
   ```

2. Confirm the Project Center appears.
3. Confirm the Worker status shows ready, or that the desktop shell shows the Worker starting state before it becomes ready.
4. Select the configured test video fixture through the desktop video picker.
5. Create a project from the selected fixture.
6. Enter the workbench after project creation.
7. Run fake analysis from the analysis inspector.
8. Confirm subtitle rows appear in the workbench subtitle grid.

## Native Picker Fallback

Native Windows file picker automation can be unstable in CI and in headed local runs. If the picker cannot be automated reliably, keep the Tauri app under test but inject the fixture path through a controlled fallback before creating the project:

- Prefer a test-only desktop command or IPC hook that returns the fixture path without opening the picker.
- If that is not available, use the browser/web-mode fallback field for `Source video path` and enter the fixture path directly.
- Keep the same downstream assertions: project creation succeeds, the workbench opens, fake analysis completes, and subtitle rows render.

The fallback should be documented in the test output when used so a local pass does not hide a picker automation gap.
