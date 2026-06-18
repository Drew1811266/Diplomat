# Diplomat 0.36 Material Workstation

Date: 2026-06-18

Stage: 0.36

## Objective

Upgrade the desktop frontend from a functional workbench into a polished Material Design 3 inspired desktop workstation. This stage addresses the first major 0.4 task: frontend interface design and interaction quality.

## Product Outcome

A user opening the desktop app should immediately see a coherent professional application:

- stable left navigation.
- clear top runtime status.
- useful page hierarchy.
- improved Workbench layout.
- visible long-task and model state.
- consistent buttons, panels, inputs, chips, and progress surfaces.
- no crude prototype-style layout.

## Scope

- Build shared design tokens aligned with Material 3 concepts.
- Update the app shell and navigation rail.
- Improve Workbench, Models, Tasks, Settings, and Help visual structure.
- Make long-running task state easier to scan.
- Add UI language for future real-model and segmentation stages without wiring real models yet.
- Keep all current workflows functional.

## Non-Goals

- Do not integrate VibeVoice-ASR in 0.36.
- Do not integrate Hunyuan-MT-7B-fp8 in 0.36.
- Do not download model weights in 0.36.
- Do not replace Mantine unless a later stage proves it blocks the design.
- Do not build marketing or landing pages.

## Design Direction

Use Material 3 as guidance for:

- color roles.
- surface and container hierarchy.
- navigation rail.
- app bar.
- icon buttons.
- filled, tonal, outlined, and text action emphasis.
- chips and badges.
- progress indicators.
- dialogs and snackbars.

Keep desktop density. Diplomat is a productivity tool, so the UI must support scanning and repeated editing.

## Acceptance Criteria

- The app has a documented 0.36 theme layer.
- App shell uses a professional navigation rail and status header.
- Workbench surfaces are visually organized and do not look like nested prototype panels.
- Models and Tasks pages visibly prepare users for real model and long-running job workflows.
- Text does not overflow on desktop or narrow viewports.
- Existing Web tests pass.
- TypeScript checks pass.
- Full repository verification passes before stage acceptance.
- A 0.36 stage gate review records screenshots or visual verification notes.

## Verification

Focused verification:

```powershell
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web e2e
```

Full verification:

```powershell
.\scripts\check.ps1
```

## Stage Gate

0.36 can merge only if the UI remains functional, automated tests pass, visual inspection confirms the app no longer looks like a rough prototype, and no unrelated local changes are included.

