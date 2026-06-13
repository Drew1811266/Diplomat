# Diplomat 0.2 Frontend Workbench Design

Date: 2026-06-13
Status: Approved design, pending implementation plan
Version target: 0.2

## Summary

Diplomat 0.2 is a frontend experience release. Its purpose is to turn the 0.1 developer-facing subtitle workbench into a modern desktop-style professional subtitle editor.

The release does not focus on expanding AI capability. It focuses on product structure, visual quality, interaction design, state clarity, internationalized core UI, and testable desktop application behavior.

The confirmed visual direction is **A1: Light Professional Workbench**:

- A light, neutral desktop tool surface.
- A dark media preview area as the visual anchor.
- Dense subtitle editing surfaces.
- Restrained teal brand accent for focus, selection, progress, and primary actions.
- Clear status colors for success, warning, blocking, and failure.
- A quiet professional feel suitable for long editing sessions.

## Product Shape

Diplomat 0.2 should feel like a real local desktop application, not a web form. The app should open into a product-level project center and then transition into a media-centered editing workbench.

The first screen is a lightweight project center. It provides:

- Recent projects.
- Create project.
- Import video.
- Worker status.
- Basic error recovery.
- Settings entry.
- Language switching.

After a project is opened or created, the user enters the workbench. The workbench has:

- A left narrow application rail.
- A top toolbar for primary commands.
- A center video preview area.
- A high-density subtitle grid.
- A right multi-mode inspector.
- A lightweight timeline strip.
- A persistent status surface for Worker, task, save, and export state.

## Layout

### Application Rail

The app uses a narrow left rail for application-level navigation. It should be compact and should not compete with the editor workspace.

Initial rail entries:

- Project Center.
- Current Project.
- Tasks.
- Settings.

The rail should use icon buttons with accessible names and tooltips. It should show the current section clearly and remain visually restrained.

### Project Center

The project center is intentionally lightweight for 0.2. It is the launch surface, not a full project management suite.

It should include:

- Worker status card or status strip.
- Recent project list.
- Create project action.
- Import video action.
- Empty state when no projects exist.
- Retry or diagnostic action when the Worker is unavailable.

Recent project rows should show:

- Project name.
- Source video path.
- Source and target language.
- Duration when known.
- Subtitle document presence.
- Last updated time.

### Workbench Shell

The workbench shell is media-centered:

- Top toolbar: import, analyze, translate, save, export.
- Center top: real video preview when available.
- Center lower area: subtitle grid.
- Right side: multi-mode inspector.
- Bottom or preview-adjacent area: lightweight timeline strip.

The layout should reserve stable dimensions for the video panel, subtitle grid, toolbar, rail, inspector, and status surfaces so async content does not cause large layout shifts.

### Video Preview

0.2 should use a real `<video>` preview when the runtime can access the selected source video.

Required behavior:

- Show a modern dark preview frame.
- Load and play the source video when possible.
- Display current subtitle styling as an overlay preview.
- Keep playback controls simple.
- Show a clear unavailable state when the video cannot be loaded.

0.2 does not need to deliver full subtitle playback synchronization. Click-to-seek, active-line highlighting during playback, and advanced timing controls can be implemented later, but the preview surface should be designed so those capabilities fit naturally.

### Subtitle Grid

The subtitle list should become a high-density grid/table, not a stack of large cards.

Required columns:

- Index or id.
- Start time.
- End time.
- Source text.
- Translated text.
- Review status.
- Translation status.

The grid should support:

- Selecting a subtitle row.
- Clear selected state.
- Filter for missing or failed translations.
- Dense row display for long videos.
- Scrollable body with stable header.
- Empty state when no subtitles exist.

The grid should be optimized for scanning and review. It should avoid oversized row cards and avoid layout changes on hover.

### Inspector

The right inspector is multi-mode. It changes based on the user action and selected context.

Modes:

- `line`: default mode. Edit selected subtitle line.
- `analysis`: configure and start analysis.
- `translation`: configure and start translation.
- `export`: configure SRT export and show export result.
- `settings-lite`: project-level lightweight settings if needed.

Toolbar commands switch the inspector mode. Selecting a subtitle row returns the inspector to `line` mode.

The inspector should make the current mode obvious with title, icon, and stable section structure. It should not feel like unrelated panels are appearing randomly.

## User Flow

### Startup

1. User opens Diplomat.
2. App displays the project center.
3. App checks Worker health.
4. App loads recent projects.
5. User creates a project, imports video, or opens a recent project.

### Create And Enter Project

1. User selects or enters a source video.
2. User sets project name, source language, and target language.
3. App creates a local project through the Worker API.
4. App opens the workbench.
5. Workbench shows video preview if accessible and shows `No document` state until analysis runs.

### Analyze

1. User clicks `Analyze` in the top toolbar.
2. Inspector switches to `analysis`.
3. User reviews provider, model, language, device, and prompt settings.
4. User starts analysis.
5. Task status appears in the inspector and status surface.
6. When the task completes, subtitle document loads into the grid.

### Translate

1. User clicks `Translate`.
2. Inspector switches to `translation`.
3. User reviews provider, language pair, mode, endpoint, and API key environment variable.
4. User starts translation.
5. Grid rows show translation status.
6. Completed translation refreshes the subtitle document.

### Edit

1. User selects a subtitle row.
2. Inspector switches to `line`.
3. User edits timing, source text, or translated text.
4. App marks the document as having unsaved changes.
5. User saves from toolbar or inspector.
6. Status surface confirms save result.

### Export

1. User clicks `Export`.
2. Inspector switches to `export`.
3. User chooses SRT mode.
4. Export is enabled only when no blocking tasks are running and subtitle edits are saved.
5. Export result displays path and success state.

## State Design

### Project Center States

- Worker ready: project actions are available.
- Worker starting: project actions are disabled and startup state is visible.
- Worker unavailable: error and retry are visible.
- No recent projects: show a clear create/import path.
- Recent projects available: show project rows with metadata.

### Workbench States

- No document: project exists, subtitles not generated yet.
- Analysis running: task progress visible, duplicate analysis disabled.
- Translation running: task progress visible, translation controls disabled as needed.
- Unsaved changes: save state visible, export blocked.
- Export ready: export action available.
- Export blocked: reason is visible.
- Error: error appears in the relevant panel and in the status surface without replacing the whole app.

### Inspector State

The app must keep inspector state predictable:

- Toolbar command sets inspector mode.
- Selecting a subtitle row sets inspector mode to `line`.
- Reloading a project resets inspector mode to the most useful state based on document availability.
- Empty `line` state should clearly ask the user to select a row.

## Keyboard And Command Behavior

0.2 includes a basic keyboard foundation:

- Save subtitles.
- Play or pause video.
- Move to previous subtitle row.
- Move to next subtitle row.
- Open search or command entry.
- Close current modal, drawer, or command entry.

These shortcuts should be discoverable in UI, but 0.2 does not need a full subtitle editing shortcut system.

## Visual Design System

Diplomat 0.2 uses a professional light theme.

Design rules:

- Neutral light app background.
- White or near-white panels.
- Dark video preview region.
- Teal accent for selected state, focus, active progress, and primary action.
- Amber for warning and blocked states.
- Red for failure.
- Green for success.
- Clear focus states.
- Clear disabled states.
- No oversized marketing typography.
- No decorative gradients or large ornamental backgrounds.
- No nested cards inside cards.
- Stable dimensions for major tool surfaces.

The release only ships the light theme, but theme tokens should be semantic so a future dark theme can be added without rewriting components.

## UI Technology

### Mantine

Mantine is the primary UI component foundation for 0.2.

Use Mantine for:

- Theme provider and color tokens.
- App shell primitives.
- Buttons and action icons.
- Tooltips.
- Menus.
- Modals and drawers.
- Tabs where appropriate.
- Form controls.
- Table or table-adjacent primitives.
- Scroll areas.
- Badges.
- Progress.
- Notifications.

Do not force Mantine to solve media-editor-specific surfaces where custom components are clearer.

### Custom Components

Business-specific components:

- `ProjectCenterPage`
- `WorkbenchPage`
- `AppRail`
- `TopToolbar`
- `VideoPreviewPanel`
- `SubtitleGrid`
- `InspectorPanel`
- `LineInspector`
- `AnalysisInspector`
- `TranslationInspector`
- `ExportInspector`
- `TaskStatusSurface`
- `SettingsPage`
- `LanguageSwitcher`
- `TimelineStrip`

These components should be designed around stable interfaces and should not depend on one large `App.tsx` state object.

## Data And State Architecture

### TanStack Query

TanStack Query owns Worker/API data:

- Worker health.
- Project list.
- Active project fetch.
- Subtitle document fetch.
- Translation settings fetch.
- Task polling.
- Export requests.

Query keys should be explicit and grouped by resource. Mutation success handlers should invalidate or update the relevant query data.

### Zustand

Zustand owns local UI shell state:

- Current page.
- Active inspector mode.
- Selected subtitle row id.
- Language preference.
- Theme preference value for future dark theme support.
- Rail or timeline collapsed state.
- Search or command entry state.

Avoid putting every form field into Zustand. Single-panel form drafts should remain in local React state unless they must be shared across the app.

### React Local State

Use local state for:

- Form draft values.
- Modal-specific state.
- Temporary validation state.
- Component-local interaction state.

## Internationalization

0.2 supports Chinese and English for core UI.

Covered:

- Project center.
- Workbench toolbar.
- Inspector titles and fields.
- Settings page.
- Task status labels.
- Common errors.
- Empty states.
- Export panel.
- Language switcher.

Not required for 0.2:

- Provider ids.
- Model names.
- API key environment variable names.
- Diagnostic paths.
- Low-level logs.

The i18n layer should make hard-coded user-facing strings easy to detect during review.

## Settings

0.2 includes a basic settings page.

Settings include:

- Interface language.
- Theme preference setting that currently presents the light theme and preserves the future dark theme path.
- Worker address and status.
- Default source language.
- Default target language.
- Default export mode.

Model/provider management, project directory management, and complete shortcut editing are not required for the 0.2 settings page.

## Testing

0.2 expands frontend test coverage because the release changes architecture and interaction patterns.

Required test layers:

- Component tests for project center, workbench, toolbar, inspector, subtitle grid, settings, and language switching.
- Data-layer tests for query hooks, task polling, cache refresh, and error behavior.
- UI store tests for page selection, inspector mode, selected subtitle row, and language preference.
- i18n tests for core key completeness in Chinese and English.
- Web E2E tests for project center to workbench flow, language switching, inspector switching, subtitle row selection, save state, and export-entry state.
- Desktop shell E2E tests for the real desktop flow.
- Automatic visual regression tests for project center, workbench, and settings page.

### Desktop Shell E2E

The desired 0.2 desktop E2E path is:

1. Launch the Tauri app.
2. Verify project center appears.
3. Verify Worker status.
4. Open the native file picker.
5. Select a test video.
6. Create a project.
7. Enter the workbench.
8. Run fake analysis.
9. Verify subtitles appear.

Native file picker automation is a known stability risk. The implementation plan should still target the full path, but it should also include a controllable fallback path for local verification if the native picker is unstable in automated environments.

### Visual Regression

Visual regression should use:

- Fixed light theme.
- Fixed language.
- Fixed viewport set.
- Fixed mock or fixture data.
- Stable fonts.
- Clear screenshot names.
- Reasonable diff thresholds.

Initial screenshot targets:

- Project center empty state.
- Project center with recent projects.
- Workbench with video preview and subtitle rows.
- Workbench with analysis inspector.
- Workbench with translation inspector.
- Workbench with export inspector.
- Settings page.

## Acceptance Criteria

0.2 is acceptable when:

- Startup shows a modern project center rather than a developer form.
- Opening or creating a project transitions into a desktop-style media workbench.
- The workbench visibly uses left rail, top toolbar, center preview, subtitle grid, and right inspector.
- Video preview uses a real video element when possible.
- Subtitle preview overlay is visible in the preview region.
- Subtitle rows are displayed in a dense grid.
- Analysis, translation, line editing, and export configuration live in predictable inspector modes.
- Save, task, and export states are visually consistent.
- Core UI can switch between English and Chinese.
- Mantine is used as the UI foundation without obscuring business-specific components.
- TanStack Query owns API data and Zustand owns UI shell state.
- E2E and visual regression tests exist for the main 0.2 experience.
- The repository verification path remains clear, with `.\scripts\check.ps1` extended or complemented by documented E2E/visual commands.

## Implementation Slices

0.2 should be implemented vertically so every slice produces a reviewable product increment.

### Slice 1: Frontend Foundation

- Add Mantine.
- Add TanStack Query.
- Add Zustand.
- Add i18n foundation.
- Add theme tokens.
- Add top-level page shell.

### Slice 2: Project Center

- Build modern project center.
- Show Worker health.
- Show recent projects.
- Support create/import entry.
- Add language switcher.
- Add settings entry.

### Slice 3: Workbench Shell

- Build app rail.
- Build top toolbar.
- Build media preview panel.
- Build subtitle grid container.
- Build inspector shell.
- Build status surface.

### Slice 4: Subtitle Editing

- Implement subtitle grid rows.
- Implement selected row state.
- Implement line inspector.
- Preserve save and unsaved-change behavior.
- Preserve export blocking behavior.

### Slice 5: Task Inspectors

- Move analysis configuration into inspector mode.
- Move translation configuration into inspector mode.
- Move export configuration into inspector mode.
- Preserve task progress, cancellation, retry, and error behavior.

### Slice 6: Video Preview

- Add real video element where possible.
- Add subtitle overlay preview.
- Add basic playback control integration.
- Add unavailable state.

### Slice 7: Settings And i18n Completion

- Build settings page.
- Complete core English and Chinese strings.
- Add i18n completeness tests.
- Persist language preference.

### Slice 8: E2E And Visual Regression

- Add Web E2E.
- Add desktop shell E2E.
- Add visual regression baselines.
- Document test commands.
- Update verification workflow.

## Review Notes

This design intentionally makes 0.2 a product experience release. It allows real video preview and full desktop-flow testing, but keeps deep media-editing capabilities such as waveform generation, heavy timeline editing, and complete subtitle playback synchronization outside the primary 0.2 delivery path.

The implementation plan should protect the vertical-slice strategy and avoid turning the first slice into a broad, unreviewable rewrite.
