# Diplomat 0.36 Stage Gate Review

Date: 2026-06-18
Stage: 0.36 Material workstation
Decision: Accepted

## Scope Completed

- Advanced version metadata to `0.36.0`.
- Added Material Design 3 inspired workstation theme tokens and shell navigation polish.
- Reworked the desktop shell with stable header, rail, active navigation state, and runtime badge.
- Improved long-task status presentation with status badges, progress, cancel/retry/log actions, and localized `canceling` state.
- Refined the Workbench with a project context strip, structured task status, stable editing regions, and updated visual baseline.
- Polished Models, Tasks, Settings, and Help pages for desktop workstation scanning:
  - Models now summarize installed, usable, active download, and runtime profile counts.
  - Tasks now presents the long-video segmentation, ASR, translation, export, and recovery pipeline.
  - Settings now surfaces runtime health summaries before detailed diagnostics.
  - Help now includes the long-video workflow guidance for speech-aware segmentation and staged model memory use.

## Focused Verification

- `node .\scripts\verify-version.mjs`: passed.
- `corepack pnpm --dir apps/web test -- AppProviders AppRail`: passed during shell/theme work.
- `corepack pnpm --dir apps/web test -- TaskStatusSurface`: passed after status-surface updates.
- `corepack pnpm --dir apps/web test -- WorkbenchPage TaskStatusSurface`: passed.
- `corepack pnpm --dir apps/web test -- ModelsPage TasksPage SettingsPage HelpPage`: passed.
- `corepack pnpm --dir apps/web test`: passed, 29 files / 179 tests.
- `corepack pnpm --dir apps/web typecheck`: passed.

## E2E And Visual Verification

- Initial E2E run failed before app launch because Playwright Chromium was missing from the local browser cache.
- Attempted `corepack pnpm --dir apps/web exec playwright install chromium`; the download process stalled without cache growth.
- Added optional `PLAYWRIGHT_BROWSER_CHANNEL` support to `apps/web/playwright.config.ts` and ran E2E through locally installed Chrome.
- `PLAYWRIGHT_BROWSER_CHANNEL=chrome corepack pnpm --dir apps/web e2e:update`: passed, regenerated the intentional Workbench visual snapshot.
- `PLAYWRIGHT_BROWSER_CHANNEL=chrome corepack pnpm --dir apps/web e2e`: passed, 4/4 tests.

Visual inspection of the updated Workbench screenshot confirmed:

- Main desktop regions render nonblank.
- Project context, task status, toolbar, video preview, subtitle grid, timeline, and inspector are visible.
- No obvious text overlap or inaccessible blank areas are present at the 1280x720 desktop viewport.

## Full Repository Verification

- `.\scripts\check.ps1`: passed.
- Covered:
  - `pnpm install --frozen-lockfile`
  - version metadata verification for `0.36.0`
  - release asset verification for `0.36.0`
  - workspace package tests
  - workspace package typechecks
  - desktop Cargo tests, 20 passed
  - Python worker editable install
  - Python tests, 267 passed

## Known Limitations

- 0.36 is a desktop UI/workstation stage. It does not yet connect the new 0.4 real ASR and translation model runtime.
- Tasks page is a structured pipeline/readiness surface; full persisted task history remains a later stage.
- Local Playwright cached Chromium was not available on this machine; 0.36 E2E was verified with installed Chrome through the new browser-channel override.
- The 3-hour video acceptance test is not part of 0.36. It remains the final 0.40 gate.

## Acceptance Decision

0.36 meets the stage goals for a more polished, stable, desktop-oriented workstation shell and page structure. The stage is accepted and ready to merge to `main`.
