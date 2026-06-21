# Diplomat UX Observation Log

This document is the running intake log for user-observed UX, interaction, and product-flow issues in Diplomat. It is intentionally not a development plan yet. Each entry should preserve the user's observed problem first, then translate it into an actionable product/design hypothesis.

## Process

1. Record each user observation as a separate numbered entry.
2. For each entry, capture what the user experienced, why it matters, and what workflow expectation it violates.
3. Add an initial optimization direction, but do not implement until the observation set is complete or the user asks to execute a specific fix.
4. When the user says the observation round is complete, consolidate this log into a formal development specification with stages, tests, and acceptance criteria.

## Product Direction Guardrails

- Diplomat should feel like a mature desktop productivity tool for video/subtitle work.
- Main workflows should be project-first and media-workbench-driven: create/open a project, then import, replace, analyze, translate, edit, and export inside the workbench.
- System settings and project settings must remain conceptually separate.
- Technical runtime details should be visible only when useful for diagnosis; ordinary users need clear task-oriented messages.
- UI should stay minimal, white/light, dense enough for repeated professional use, and aligned with Material Design 3 principles adapted for desktop software.

## Observation Template

### UX-000 - Short title

- Status: Observed | Understood | Spec-ready | Implemented | Verified
- User observation:
- My understanding:
- Workflow expectation:
- Likely root cause:
- Optimization direction:
- Affected areas:
- Priority:
- Acceptance criteria:

## Observations

### UX-001 - Video import appeared unresponsive after file selection or drop

- Status: Implemented and verified
- User observation: After creating/opening a project, dragging a video into the import surface or selecting a video from the file picker appeared to do nothing. The UI stayed on the source-video import surface and did not enter the real workbench.
- My understanding: The user expected file selection/drop to immediately bind the video to the current project and transition into the editable workbench. A silent failure at this first media step blocks the entire product flow.
- Workflow expectation: A project container can be empty, but once a valid video is selected or dropped, the app should import it, show the media in the project media bin, and reveal the workbench. If import fails, the same surface must show a clear reason.
- Likely root cause: The development launcher started the worker without project-local FFmpeg/FFprobe paths. Worker media probing failed while the empty import surface hid the mutation error.
- Optimization direction: Development launch must pass the same media tool paths to worker and desktop, and the empty import page must show import errors inline.
- Affected areas: `scripts/start-dev-desktop.mjs`, `scripts/dev-launch-utils.mjs`, `apps/web/src/pages/WorkbenchPage.tsx`.
- Priority: P0, because it blocks first-run use.
- Acceptance criteria: Selecting or dropping a valid local video imports it into the active project; media import failures are visible on the import surface with a useful reason.

### UX-002 - Project creation should enter the full workbench immediately

- Status: Observed
- User observation: Creating a project should only require naming the project and clicking create. After creation, the app should enter the workbench immediately. It should not route the user to a dedicated source-video import screen before the real workbench appears.
- My understanding: The current empty-project import surface feels like a blocking onboarding step rather than a professional project workspace. Mature video productivity tools such as Jianying/CapCut, DaVinci Resolve, Premiere Pro, and Final Cut Pro separate project creation from media import: users create/open a project first, then import one or more media files inside the workbench.
- Workflow expectation: Project creation creates the container and opens the main workbench. The workbench should be usable even before media exists, with the media bin/import affordance visible inside the workspace rather than replacing the workspace.
- Likely root cause: The workbench currently has a special `showMediaImportStart` branch that returns an import-focused empty screen when the active project has no media. This makes "empty project" look like a separate mode instead of a normal workbench state.
- Optimization direction: Remove the blocking dedicated import page. Render the full workbench shell for empty projects, keep media import/drop in the project media area, and show empty states inside the preview/subtitle/timeline regions where appropriate. The user should always feel they are inside the project after creation.
- Affected areas: `apps/web/src/pages/ProjectCenterPage.tsx`, `apps/web/src/pages/WorkbenchPage.tsx`, workbench empty-state copy, project creation navigation, workbench tests.
- Priority: P0, because it defines the first-run product flow and the user's first impression of the app as a mature productivity tool.
- Acceptance criteria: After clicking create project, the app navigates directly to the workbench; the workbench toolbar/context/media bin are visible; no full-page "import source video first" screen blocks the workspace; importing media remains available from the media bin and toolbar.

### UX-003 - Workbench layout should prioritize a large video preview and bottom timeline

- Status: Observed
- User observation: The current video workbench looks visually cluttered. In the screenshot, the video has large black side margins and occupies a relatively small preview area, while many toolbars, status strips, media cards, subtitle table rows, and timeline elements compete for attention. The user expects a layout closer to Final Cut Pro or Jianying/CapCut: bottom timeline, large center/top video preview, left-side media import/bin area, and right-side translation or parameter settings.
- My understanding: The current workbench allocates too much primary space to secondary surfaces and stacks too many horizontal bands above and below the preview. The user's core activity is watching and editing timed video/subtitle content, so the video preview and timeline should be the dominant visual anchors. Media import and translation settings should be side panels around that core, not vertical blocks that push the preview down.
- Workflow expectation: A professional video/subtitle editing workspace should have a stable editing triad: media bin on the left, preview/player in the center, inspector/settings on the right, and timeline across the bottom. The subtitle table can be integrated as an editing panel below or beside the preview, but it should not shrink the preview into a secondary element.
- Likely root cause: The current `WorkbenchPage` layout uses a stacked media-first grid where project media, preview, subtitle grid, and timeline are vertically ordered in one main column, with the inspector on the right. The video component likely uses a contain-style fit that preserves full frame but creates large black margins for narrow or non-matching aspect ratios. Several status and command rows also consume vertical space before the user reaches the preview.
- Optimization direction: Redesign the workbench shell around a video-editor layout: compact top app/workspace bar; left media/import panel; center preview region with larger adaptive height and better fit controls; right inspector for translation/project settings; bottom timeline as the persistent lowest region. Subtitle table should become a dockable/resizable panel or share space with timeline/editor controls instead of permanently reducing preview height. Add preview fit modes or smarter sizing so black bars are minimized without losing inspectability.
- Affected areas: `apps/web/src/pages/WorkbenchPage.tsx`, `VideoPreviewPanel`, `SubtitleGrid`, `TimelineEditor`, `InspectorPanel`, workspace layout state, responsive layout tests, visual snapshots.
- Priority: P0, because it defines whether the app feels like a mature video productivity tool rather than a collection of panels.
- Acceptance criteria: On desktop, the video preview is the dominant center/top area; timeline is anchored at the bottom; media import/bin is available on the left; translation/project controls live on the right; unnecessary horizontal status bands are compressed or moved; preview black margins are reduced where possible; users can inspect video comfortably without losing access to subtitle/timeline editing.

### UX-004 - Target workbench concept: preview left, tabbed parameter panel right, timeline bottom

- Status: Observed
- User observation: The user provided a sketch with three main areas. Area 1 is the video preview area where playback, pause, and timeline scrubbing control viewing. Area 2 is a parameter panel on the right, with several tabs at the top. The exact tab count is not fixed; it should be determined by the app's real functional grouping. Switching tabs changes the settings/content shown in the right panel, such as project settings, translation model, language settings, and subtitle content. The subtitle tab should show the complete subtitle list, not only the currently selected line. Area 3 is the full-width timeline area at the bottom.
- My understanding: The user does not want to copy Jianying/CapCut exactly. The desired direction is a simplified professional workstation: a large left preview canvas, a persistent right inspector with tabbed modes, and a bottom timeline. This keeps the main screen stable while letting users switch the right panel between different editing/control contexts.
- Workflow expectation: Users should always understand the three primary zones: watch video in area 1, adjust settings or inspect/edit contextual details in area 2, and navigate/edit time-based content in area 3. The right tabs should be local to the parameter panel, not another confusing global navigation row.
- Likely root cause: The current workbench spreads controls across top workspace tabs, command bars, media rows, subtitle grids, and inspector modes. The interaction model is too fragmented, so users cannot easily predict where project settings, translation settings, subtitle content, and timeline controls belong.
- Optimization direction: Use the sketch as the target conceptual layout for the next workbench redesign. Build a two-row desktop grid: top row split into `preview` and `tabbed-inspector`, bottom row as `timeline`. Move project/media controls into compact contextual surfaces; consolidate inspector modes into right-side tabs based on actual product needs, for example Project, Media, Translation, Subtitles, and Export. The Subtitles tab should contain the full subtitle list/table and support list-level navigation/editing. Keep playback and timeline playhead synchronized between preview and bottom timeline.
- Affected areas: `WorkbenchPage`, `AppShellLayout` workspace navigation, `InspectorPanel`, translation/project settings panels, subtitle content surface, timeline/playhead state, visual layout tests.
- Priority: P0, because this is the user's preferred target layout and should guide the formal redesign spec.
- Acceptance criteria: The workbench can be described by three stable zones matching the sketch; right-side tabs switch panel contents without changing the whole page; tab count is driven by real feature grouping rather than a fixed number; the subtitles tab shows the complete subtitle list; preview remains the largest top-left region; bottom timeline spans the full editor width; users can play/pause and scrub from preview/timeline without hunting through multiple navigation layers.

### UX-005 - Separate project settings tab from global system settings gear

- Status: Observed
- User observation: The upper-right area should include a small gear icon at the far corner for global system settings. Project settings should be a tab/page inside the workbench context, while clicking the gear should switch the whole application into the system settings interface.
- My understanding: The user wants two settings scopes to be visually and navigationally distinct. Project settings are contextual to the current project and belong in the workbench/right-side tabbed panel. System settings are app-wide and should be reached through a persistent gear icon, not mixed into project workflow tabs.
- Workflow expectation: While working in a project, users can adjust project-specific settings without leaving the workbench. For global preferences such as runtime, model directories, language, appearance, shortcuts, diagnostics, and advanced tools, users click the top-right gear and the entire interface changes to the system settings screen.
- Likely root cause: Current navigation and settings surfaces blur global settings and project settings, so users may not know whether a control affects only the current project or the whole application.
- Optimization direction: Reserve an icon-only top-right gear button for system settings, with tooltip and accessible label. Keep project settings as a workbench tab. Make system settings a full-app route/screen with a clear return path to the current project/workbench.
- Affected areas: `AppShellLayout`, top bar/system actions, `SettingsPage`, `WorkbenchPage`, right-side tabbed inspector/project settings tab, routing/state preservation.
- Priority: P0, because settings scope is a core information-architecture rule for the redesigned product.
- Acceptance criteria: Project settings are accessible as a workbench tab; global system settings are accessed through the top-right gear; selecting the gear replaces the workspace with system settings; returning to the project preserves current workbench state; UI labels clearly communicate whether a setting is project-scoped or global.

### UX-006 - Remove the redundant workbench project context/status band

- Status: Observed
- User observation: The large horizontal area above the video preview, marked in the screenshot, is unnecessary. It shows imported video information, export controls, draft/snapshot status, and other project state, but this information is already available in more meaningful locations: imported media appears in the right-side Media tab, export parameters and actions belong in the Export tab, and the band consumes substantial vertical space that should belong to the video preview.
- My understanding: This band is a duplicate information layer rather than a useful work surface. It makes the workbench feel cluttered and pushes the primary video preview downward. For a professional video/subtitle tool, persistent screen space should be reserved for preview, inspector, and timeline; secondary metadata and workflow controls should live in scoped panels or compact status surfaces.
- Workflow expectation: Users should not have to scan a large top context strip before editing. They should see the video preview immediately under the app header, use the right Media tab to inspect/import/select media, use the Export tab to configure and run export, and use small status indicators only where they directly support the current task.
- Likely root cause: The workbench still carries legacy context/status rows from the previous stacked layout. After moving media, project settings, translation, subtitles, style, and export into the right-side tabs, the old project context strip became redundant.
- Optimization direction: Remove the entire large top project context/status band from the workbench. Move any remaining necessary controls into their correct scoped locations: media details into the Media tab, export/save actions into the Export tab, draft/snapshot actions into a compact command/status area near the timeline or subtitle controls only if they remain genuinely useful. Keep only minimal global workbench status in the top app shell or bottom status bar.
- Affected areas: `apps/web/src/pages/WorkbenchPage.tsx`, right-side Media/Export tabs, snapshot/draft command placement, workbench layout tests, visual snapshots.
- Priority: P0, because it directly restores vertical space to the video preview and removes a confusing duplicate layer from the main editing workspace.
- Acceptance criteria: The red-marked horizontal workbench band no longer appears; the video preview starts much closer to the app header; imported media remains visible in the Media tab; export controls remain available in the Export tab; draft/snapshot state is either removed if nonessential or shown as compact contextual status; no critical command becomes inaccessible.

### UX-007 - Upgrade the timeline into a professional editing timeline

- Status: Observed
- User observation: The current timeline is too rudimentary. It should be deeply optimized and should use a professional video-editing product as the benchmark, with Jianying/CapCut as the initial reference point.
- My understanding: The timeline cannot remain a decorative strip that only shows a simple subtitle bar. In this product, the timeline is one of the three core work areas. It should help users understand video duration, current playhead position, subtitle segments, gaps, overlaps, selection, and editing state at a glance. It should also support efficient navigation and common editing actions instead of forcing users to work through tables and forms only.
- Workflow expectation: A user should be able to use the timeline like they would in a mature editing tool: scrub the playhead, zoom in/out, see time ticks, select subtitle clips, understand clip duration, identify missing translation or timing issues, move or trim subtitle segments when allowed, and keep the preview synchronized with the selected time. The timeline should feel like an editing surface, not just a status visualization.
- Likely root cause: The current timeline component appears to be a simple static representation of subtitle rows with limited visual hierarchy and limited direct manipulation. It does not yet provide the spatial, interactive, and layered behaviors users expect from editing software.
- Optimization direction: Redesign the timeline as a proper timeline editor inspired by Jianying/CapCut and other professional editing tools. Add a time ruler, playhead, zoom control, horizontal scroll, visible subtitle clips with readable labels, selected/hover/focus states, track headers, compact waveform or audio amplitude display when available, gap/overlap/problem markers, and direct click-to-seek behavior. Keep it visually clean in the white Material Design 3 desktop style, but give it the density and affordances of a real editing timeline.
- Affected areas: `apps/web/src/components/TimelineEditor.tsx`, `apps/web/src/components/TimelineStrip.tsx`, `apps/web/src/pages/WorkbenchPage.tsx`, subtitle selection/playhead state, waveform query integration, keyboard shortcuts, responsive timeline layout, timeline tests, visual snapshots.
- Priority: P0, because the timeline defines whether the workbench feels like a serious editing tool.
- Acceptance criteria: The timeline includes a professional time ruler and synchronized playhead; users can click/scrub to seek; subtitle clips are shown as editable/selectable timeline items with meaningful width and labels; zoom and horizontal scrolling work predictably; selected clips synchronize with the subtitle list/right panel and video preview; waveform or audio context is shown when available; subtitle problems such as missing translation, overlap, or timing issues are visually marked; the timeline looks polished rather than placeholder-like.

### UX-008 - Final subtitles must be sentence-level, not processing-chunk-level

- Status: Observed
- User observation: The app currently appears to display subtitles by the large paragraph-like segments used earlier in the processing pipeline. The original reason for splitting the video into larger segments was to reduce model pressure before speech-to-text and translation. That internal chunking should not define the final subtitle display. Real subtitles should be split sentence by sentence, with each subtitle entry corresponding to a natural spoken sentence or readable subtitle cue, not a whole processing paragraph.
- My understanding: There are two different concepts that must be separated. Processing chunks are an internal model orchestration detail used for ASR/translation reliability and performance. Subtitle cues are the user-facing timed text units shown on video, in the subtitle list, and on the timeline. The current output likely leaks internal processing chunks into the final subtitle document, causing subtitles to be too long, hard to read, and visually wrong.
- Workflow expectation: After ASR and translation, the app should produce subtitle cues that match how users expect subtitles to work: one sentence or short readable unit per cue, with reasonable duration, line length, timing, and translation alignment. Processing chunks may still exist internally, but users should never see them as final subtitle rows unless a diagnostic view explicitly exposes them.
- Likely root cause: The subtitle document generation stage may be using ASR segment/chunk boundaries directly as subtitle row boundaries. Translation may also be operating on these larger chunks and storing the translated paragraph as a single subtitle line instead of re-segmenting it into cue-sized units.
- Optimization direction: Add or fix a dedicated subtitle cue segmentation stage after transcription and before final subtitle document creation. This stage should split ASR text into natural sentence/readability units, preserve or infer timing for each cue, and keep source/translation alignment. Prefer word-level or sentence-level timestamps when ASR provides them; otherwise use punctuation, pause detection, character limits, and proportional timing as fallbacks. Translation should either happen per final cue or preserve mapping from translated sentences back to cue boundaries. The pipeline should keep internal chunk IDs for traceability but output sentence-level subtitle cues to the UI and export formats.
- Affected areas: worker ASR pipeline, audio/video chunking, translation pipeline, subtitle document schema, SRT/VTT/export generation, subtitle table, timeline clip rendering, QA diagnostics for long lines/gaps/overlaps, tests around subtitle segmentation.
- Priority: P0, because incorrect subtitle granularity makes the core output wrong even if the UI looks polished.
- Acceptance criteria: A long processing chunk containing multiple spoken sentences becomes multiple subtitle rows/cues; each cue has its own start/end timing; source text and translated text remain aligned by cue; cue text respects readable length and duration limits; UI subtitle list and timeline show sentence-level clips; exported SRT/VTT files use these final cue boundaries rather than processing chunk boundaries; internal chunking remains available only as metadata/diagnostics, not as the visible subtitle unit.

### UX-009 - Integrate the video preview as a professional editing viewer

- Status: Observed
- User observation: The current video preview feels like an external video player embedded into the app. Mature productivity/editing tools integrate the preview area into the workstation; the preview should not look like a separate browser/media player that happens to be placed inside the page. The app should study how real editing software designs its viewer/preview area and framework.
- My understanding: The issue is not basic playback capability. The issue is visual and interaction integration. A professional editing viewer is usually a program monitor: it has a clean preview canvas, consistent app-native controls, timecode, playback state, fit/zoom options, overlay/safe-area/subtitle preview, and tight synchronization with the timeline. Native browser video controls or a self-contained black player frame make the feature feel outsourced rather than part of Diplomat's editing surface.
- Workflow expectation: Users should perceive the preview as the main monitor of the workbench. Playback, current time, subtitle overlay, preview fit, and scrub state should all feel connected to the timeline and right-side settings. The viewer should use Diplomat's own control language, icons, spacing, colors, and interaction states instead of default player chrome.
- Likely root cause: `VideoPreviewPanel` likely relies too heavily on the browser video element's built-in visual model and controls, while the surrounding workbench frame does not provide a dedicated editing-viewer shell. This creates a nested-player impression and visually separates the video from timeline/subtitle editing.
- Optimization direction: Redesign the preview region as an integrated editing viewer. Use the raw video element as the rendering layer, but replace visible native controls with app-native transport controls: play/pause, current time/duration timecode, seek/scrub bridge to timeline, volume/mute if needed, fit/fill/actual-size controls, fullscreen/theater mode, subtitle overlay preview, and optional safe-margin/guide overlays. The viewer frame should align with the workstation layout and Material Design 3 desktop language, with clean boundaries and no unnecessary standalone player chrome. It should resemble the Program Monitor/Viewer concept in professional editing software rather than an embedded consumer player.
- Affected areas: `apps/web/src/components/VideoPreviewPanel.tsx`, `apps/web/src/pages/WorkbenchPage.tsx`, playhead/timeline synchronization, subtitle overlay rendering, preview fit state, keyboard shortcuts, accessibility labels, visual snapshots.
- Priority: P0, because the preview is the user's primary inspection surface and strongly determines whether the app feels professional.
- Acceptance criteria: The preview no longer exposes default/standalone player chrome as the main UI; playback controls are app-native and visually consistent; current time and duration are shown as editing timecode; subtitle overlay preview is integrated; playhead and timeline scrub stay synchronized; fit/zoom controls are available; the viewer frame feels like part of the workbench, not an embedded external player; keyboard and accessibility support remain intact.
