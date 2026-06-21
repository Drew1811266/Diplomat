export const en = {
  app: {
    name: "Diplomat",
    subtitle: "Subtitle Workbench"
  },
  appShell: {
    activityNav: "Activity navigation",
    contextNavigation: "Context navigation",
    systemUtilities: "System utilities",
    workspaceModesNav: "Workspace modes",
    editorWorkspacesNav: "Editor workspaces",
    projectWorkspacesNav: "Project workspaces",
    statusBar: "Status bar",
    localRuntime: "Local runtime",
    backgroundTasks: "Background tasks",
    backgroundTasksPanel: "Background task status",
    backgroundTasksCount: "{{count}} active",
    tasksUpdating: "Updating",
    tasksUnavailable: "Task list unavailable",
    noBackgroundTasks: "No active background tasks.",
    openTaskQueue: "Open task queue",
    openCurrentPage: "Open current page",
    openProjectContext: "Open project context",
    openRuntimeSettings: "Open runtime settings",
    runtime: {
      ready: "Ready",
      checking: "Checking",
      offline: "Offline"
    }
  },
  commandPalette: {
    title: "Command palette",
    open: "Open command palette",
    search: "Search commands",
    placeholder: "Search pages, settings, models, or tasks",
    hint: "Jump to the right workspace without adding another navigation row.",
    empty: "No commands match the current search.",
    commands: {
      projects: {
        description: "Create, open, recover, and manage project containers."
      },
      workbench: {
        description: "Return to the open project workspace and import project media.",
        disabledDescription: "Open a project before entering the workbench."
      },
      tasks: {
        description: "Review running, queued, failed, and completed local jobs."
      },
      models: {
        description: "Manage ASR and translation models in System Settings."
      },
      runtime: {
        description: "Inspect the local runtime, FFmpeg, paths, and logs."
      },
      help: {
        description: "Open workflow, diagnostics, and release guidance."
      },
      settings: {
        description: "Open app-wide preferences and defaults."
      }
    }
  },
  nav: {
    projects: "Projects",
    workbench: "Workbench",
    tasks: "Tasks",
    help: "Help",
    settings: "Settings",
    projectLibrary: "Project Library",
    projectEditor: "Workbench",
    taskQueue: "Task Queue"
  },
  editorWorkspaces: {
    transcription: "Transcribe",
    translation: "Translate",
    timing: "Timing",
    style: "Style",
    delivery: "Deliver"
  },
  languages: {
    autoDetect: "Auto detect",
    selectLanguage: "Select language",
    zh: "Chinese",
    en: "English",
    ja: "Japanese",
    ko: "Korean",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic"
  },
  projectCenter: {
    title: "Project Library",
    description: "Create and open project containers. Import videos from the workbench after opening a project.",
    startupRegion: "Project start",
    recentProjectCards: "Recent project cards",
    recentProjects: "Recent Projects",
    newProject: "New Project",
    createProject: "Save Project",
    createProjectContainer: "Create project container",
    importVideo: "Import in Workbench",
    projectLibraryActions: "Project library actions",
    projectLibraryToolbar: "Project library toolbar",
    recoverProject: "Recover",
    untitledProject: "Untitled Project",
    creationTitle: "New Project",
    creationNameOnlyHint:
      "Name the project now. Import or replace project videos from the workbench.",
    creationDesktopHint:
      "Name the project now, then import videos from the workbench.",
    creationBrowserHint:
      "Project creation only saves the project container. Video files are managed in the workbench.",
    chooseVideo: "Choose Video",
    noVideoSelected: "No video selected",
    dropVideoHint: "Open a project and drag local videos into the workbench media bin.",
    selectVideoRequired: "Open the project and import a source video from the workbench.",
    unsupportedVideoFile: "Choose a supported video file: MP4, MOV, MKV, WebM, AVI, or M4V.",
    dropUnavailable: "Video drop is unavailable in this desktop session.",
    creatingProject: "Saving project...",
    noProjects: "No recent projects",
    noProjectsHint: "Create a project, then open it to import project videos.",
    visibleProjectCount: "{{visible}}/{{total}} visible",
    projectCount: "{{count}} projects",
    filteredProjectCount: "{{visible}}/{{total}} projects",
    workerReady: "Local runtime ready",
    workerStarting: "Local runtime starting",
    workerUnavailable: "Local runtime unavailable",
    runtimeReady: "Local runtime ready",
    runtimeChecking: "Checking local runtime",
    runtimeOffline: "Local runtime offline",
    retryWorker: "Retry local runtime",
    search: "Search projects",
    searchPlaceholder: "Name, language, or project ID",
    statusFilter: "Status filter",
    statusAll: "All statuses",
    statuses: {
      not_transcribed: "Not transcribed",
      transcribed: "Transcribed",
      translated: "Translated",
      dirty_draft: "Draft changed",
      exported: "Exported",
      failed: "Failed",
      corrupted: "Corrupted",
      migration_failed: "Migration failed"
    },
    diskUsage: "Disk usage",
    updated: "Updated",
    warnings: "Warnings",
    noFilterMatches: "No projects match the current filters.",
    openProjectRowHint: "Double-click to open {{name}}",
    actionsFor: "Project actions for {{name}}",
    openProjectFolder: "Open project folder",
    openExportsFolder: "Open export folder",
    openLogsFolder: "Open log folder",
    cleanCache: "Clean cache",
    cleanExports: "Clean exports",
    backupProject: "Backup project",
    importBackup: "Import backup",
    chooseBackupPackage: "Choose backup package",
    chooseBackupHint: "Select a .diplomat-project.zip backup package from your computer.",
    noBackupPackageSelected: "No backup package selected",
    deleteProject: "Delete project",
    confirmDelete: "Confirm delete",
    deleteFiles: "Delete project files",
    deleteConfirmationBody:
      "This removes {{name}} from the project library. File deletion cannot be undone when enabled.",
    backupPackagePath: "Backup package path",
    restoreName: "Restore name",
    table: {
      project: "Project",
      languages: "Languages",
      status: "Status",
      subtitles: "Subtitles",
      duration: "Duration",
      actions: "Project actions"
    },
    cards: {
      languages: "Languages",
      status: "Status",
      subtitles: "Subtitles",
      duration: "Duration",
      updated: "Updated",
      diskUsage: "Disk usage"
    },
    errors: {
      projectListFailed: "Project library could not be loaded.",
      createFailed: "Project could not be created.",
      maintenanceFailed: "Project action could not be completed.",
      backupImportFailed: "Backup could not be imported."
    }
  },
  toolbar: {
    import: "Import video",
    analyze: "Analyze",
    translate: "Translate",
    save: "Save",
    export: "Export"
  },
  workbench: {
    title: "Workbench",
    workspaces: {
      transcription: "Transcription workspace",
      translation: "Translation workspace",
      timing: "Timing workspace",
      style: "Style workspace",
      delivery: "Delivery workspace"
    },
    productionStage: {
      label: "Current production stage",
      controls: "Controls",
      transcription: {
        title: "Transcription",
        goal: "Create or review subtitles",
        action: "Open transcription controls"
      },
      translation: {
        title: "Translation",
        goal: "Fill missing translations",
        action: "Open translation controls"
      },
      timing: {
        title: "Timing",
        goal: "Fix timing issues",
        action: "Open timing controls"
      },
      style: {
        title: "Style",
        goal: "Preview subtitle styling",
        action: "Open style controls"
      },
      delivery: {
        title: "Delivery",
        goal: "Export subtitles or video",
        action: "Open export controls"
      }
    },
    labels: {
      projectTools: "Project tools",
      projectContext: "Project context",
      videoPreview: "Video preview",
      videoPreviewMedia: "Video preview media",
      inspector: "Inspector",
      timeline: "Timeline"
    },
    layout: {
      resizeInspector: "Resize inspector panel",
      resizeTimeline: "Resize timeline panel",
      collapseInspector: "Collapse inspector",
      expandInspector: "Expand inspector",
      collapseTimeline: "Collapse timeline",
      expandTimeline: "Expand timeline"
    },
    timeline: {
      subtitleRows: "{{count}} subtitle rows"
    },
    media: {
      title: "Project media",
      count: "{{count}} videos",
      dropTitle: "Drop videos here",
      empty: "Use the import button or drop local videos into the workbench.",
      active: "Active",
      missing: "Missing",
      localFile: "Local video file",
      use: "Use",
      remove: "Remove",
      useAsset: "Use {{name}}",
      removeAsset: "Remove {{name}}"
    },
    noProject: "No project selected",
    emptyStateLabel: "Workbench empty state",
    emptyStateDescription: "Create or open a project from Project Library before importing video.",
    openProjectLibrary: "Open Project Library",
    projectSettings: "Project settings",
    noSourceVideo: "No source video imported",
    importVideoToStart:
      "Use Import video to add or replace the current project video.",
    importVideoAction: "Import video",
    noDocument: "No subtitle document",
    unsaved: "Unsaved changes",
    saved: "Saved",
    loadingProject: "Loading project...",
    loadingSubtitle: "Loading subtitle document...",
    projectLoadError: "Could not load project.",
    subtitleLoadError: "Could not load subtitle document.",
    previewUnavailable: "Video preview unavailable",
    subtitleGrid: "Subtitle Grid",
    errors: {
      projectLoadFailed: "Project details could not be loaded.",
      subtitleLoadFailed: "Subtitle document could not be loaded.",
      saveFailed: "Could not save subtitles.",
      saveFailedHint: "Your local edits are still kept in this session.",
      analysisFailed: "Could not start transcription.",
      translationFailed: "Could not start translation.",
      styleFailed: "Could not update subtitle style.",
      exportFailed: "Could not start export.",
      operationFailed: "The operation failed. Retry or open diagnostics if it repeats."
    }
  },
  subtitleGrid: {
    region: "Subtitle grid panel",
    rows: "{{count}} rows",
    filters: {
      label: "Subtitle filters",
      all: "All",
      missing: "Missing translations"
    },
    columns: {
      id: "ID",
      start: "Start",
      end: "End",
      source: "Source",
      translation: "Translation",
      review: "Review",
      status: "Status"
    },
    selectLine: "Select line {{id}}",
    timingIssueCount: "{{count}} timing issue",
    translationQualityIssueCount: "{{count}} quality issue",
    empty: "No subtitle rows",
    noFilterMatches: "No subtitle rows match the current filter.",
    noSourceText: "No source text",
    noTranslatedText: "No translated text",
    reviewStatus: {
      draft: "Draft",
      reviewed: "Reviewed",
      approved: "Approved"
    },
    translationStatus: {
      not_requested: "Not requested",
      queued: "Queued",
      translated: "Translated",
      edited: "Edited",
      failed: "Failed"
    }
  },
  timelineEditor: {
    region: "Timeline editor",
    title: "Timeline",
    zoom: "Zoom timeline",
    blockLabel: "Timeline block {{id}}",
    resizeStart: "Resize start for {{id}}",
    resizeEnd: "Resize end for {{id}}",
    generateWaveform: "Generate waveform"
  },
  editorCommands: {
    toolbar: "Editor commands",
    undo: "Undo",
    redo: "Redo",
    split: "Split line",
    mergePrevious: "Merge previous",
    mergeNext: "Merge next",
    offsetMs: "Offset milliseconds",
    offsetScope: "Offset scope",
    applyOffset: "Apply offset",
    shortcuts: "Keyboard shortcuts",
    scopes: {
      selected: "Selected",
      all: "All",
      afterPlayhead: "After playhead"
    }
  },
  recovery: {
    region: "Recovery",
    autosavedDraft: "Autosaved draft",
    draftMeta: "{{count}} lines · {{updatedAt}}",
    snapshots: "Snapshots",
    restoreDraft: "Restore draft",
    discardDraft: "Discard draft",
    createSnapshot: "Create snapshot",
    restoreSnapshot: "Restore snapshot {{label}}",
    manualSnapshotLabel: "Manual checkpoint",
    batchTimingSnapshotLabel: "Before batch timing"
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    split: "Split selected line",
    undo: "Undo edit",
    redo: "Redo edit"
  },
  inspector: {
    line: "Subtitle line",
    analysis: "Project analysis settings",
    translation: "Project translation settings",
    style: "Project style settings",
    export: "Project export settings",
    projectSettings: "Current project settings",
    projectScopeLabel: "Current project",
    projectScopeDescription: "Applies only to the open project. System defaults stay in Settings.",
    projectSettingsDescription:
      "These language and delivery defaults apply to this project only. App-wide defaults stay in System Settings.",
    emptyLine: "Select a subtitle row to edit timing and text.",
    exportDisabledNoLines: "No subtitle rows are available to export.",
    exportDisabledUnsaved: "Save subtitle edits before exporting.",
    exportDisabledTaskActive: "Wait for analysis or translation to finish.",
    exportDisabledDataError: "Resolve project or subtitle errors before exporting.",
    exportDisabledTiming: "Fix timing errors before exporting.",
    exportResult: "{{format}} exported: {{exportPath}}",
    selectModel: "Select model",
    noAsrModelAvailable: "No installed ASR model",
    installAsrModelFirst: "Install an ASR model from Settings > Models before starting local transcription.",
    noTranslationModelAvailable: "No installed translation model",
    installTranslationModelFirst: "Install a translation model from Settings > Models before starting local translation.",
    translationPairUnsupported: "Selected translation model does not support this language pair.",
    translationModelUnavailable: "Install this translation model before starting translation.",
    localTranslationPending: "Local translation model execution lands in 0.25.",
    advancedOptions: "Advanced options",
    runtimeProfile: "{{device}} · {{computeType}} · Batch size {{batchSize}}",
    emptyGlossary: "No glossary terms",
    translationQualityIssues: "Quality checks"
  },
  fields: {
    projectName: "Project name",
    sourceVideoPath: "Source video path",
    sourceLanguage: "Source language",
    targetLanguage: "Target language",
    startMs: "Start ms",
    endMs: "End ms",
    sourceText: "Source text",
    translatedText: "Translated text",
    provider: "Provider",
    model: "Model",
    installedAsrModel: "Installed ASR model",
    translationModel: "Translation model",
    device: "Device",
    computeType: "Compute type",
    initialPrompt: "Initial prompt",
    translationMode: "Translation mode",
    glossary: "Glossary",
    sourceTerm: "Source term",
    targetTerm: "Target term",
    endpoint: "Endpoint",
    apiKeyEnv: "API key env",
    exportMode: "Export mode",
    exportFormat: "Format"
  },
  translationModes: {
    missing_only: "missing only",
    overwrite_all: "overwrite all"
  },
  exportModes: {
    source: "source",
    target: "target",
    bilingual: "bilingual"
  },
  exportFormats: {
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS"
  },
  videoExport: {
    render: "Render video",
    cancel: "Cancel render",
    retry: "Retry render",
    openExportsFolder: "Open export folder"
  },
  stylePresets: {
    select: "Style preset",
    name: "Preset name",
    save: "Save preset",
    apply: "Apply preset",
    update: "Update preset",
    rename: "Rename",
    delete: "Delete"
  },
  styleEditor: {
    fontFamily: "Font family",
    fontSize: "Font size",
    primaryColor: "Primary color",
    secondaryColor: "Secondary color",
    outline: "Outline",
    shadow: "Shadow",
    backgroundBar: "Background bar",
    backgroundColor: "Background color",
    alignment: "Alignment",
    marginV: "Vertical margin",
    lineSpacing: "Line spacing",
    bilingualLayout: "Bilingual layout",
    safeArea: "Safe area",
    safeAreaMargin: "Safe margin",
    alignments: {
      left: "Left",
      center: "Center",
      right: "Right"
    },
    bilingualLayouts: {
      "source-above-target": "Source above target",
      target_top: "Target above source"
    }
  },
  validation: {
    requiredField: "{{field}} is required.",
    languageCodeLength: "Use 2 to 12 characters.",
    exportErrors: "Fix {{count}} timing error before exporting.",
    exportWarnings: "{{count}} timing warning will be included."
  },
  actions: {
    start: "Start",
    cancel: "Cancel",
    retry: "Retry",
    open: "Open",
    openLogs: "Open logs",
    save: "Save",
    close: "Close",
    addTerm: "Add term",
    removeTerm: "Remove term"
  },
  settings: {
    title: "System Settings",
    categoriesNav: "Settings categories",
    everydaySettings: "Everyday settings",
    advancedTools: "Advanced tools",
    advancedToolsDescription: "Diagnostics, raw details, and release checks for maintenance.",
    categories: {
      general: "General",
      appearance: "Appearance",
      language: "Language",
      runtime: "Runtime",
      models: "Models",
      processing: "Processing & performance",
      subtitles: "Subtitles & translation",
      shortcuts: "Keyboard shortcuts",
      privacy: "Privacy",
      advanced: "Advanced",
      diagnostics: "Diagnostics",
      about: "About",
      release: "Release",
      defaults: "New project defaults"
    },
    language: "Interface language",
    theme: "Theme",
    themeLight: "Light",
    currentState: "Current state",
    readOnlyCategoryNoticeTitle: "Read-only system state",
    readOnlyCategoryNoticeBody:
      "These values show the current app state. Editable preferences appear as form controls.",
    general: "General",
    startupView: "Startup view",
    startupProjectLibrary: "Project Library",
    settingsScope: "Settings scope",
    settingsScopeSystem: "System",
    processingPerformance: "Processing & performance",
    processingMode: "Processing mode",
    processingModeLocal: "Local runtime",
    taskConcurrency: "Task concurrency",
    taskConcurrencySingleHeavy: "One heavy job at a time",
    asrScheduling: "ASR scheduling",
    asrSchedulingReleaseMemory: "Release memory before translation",
    hardwarePolicy: "Hardware policy",
    hardwarePolicyValue: "CPU fallback; GPU preferred",
    subtitlesTranslation: "Subtitles & translation",
    defaultExportFormat: "Default export format",
    currentProjectOverrides:
      "Current project language and export settings are edited in the Workbench inspectors. New project defaults are managed in their own category.",
    privacy: "Privacy",
    defaultProcessing: "Default processing",
    defaultProcessingLocal: "Local device",
    remoteServices: "Remote services",
    remoteServicesDisabled: "Disabled by default",
    modelDownloadSources: "Model download sources",
    modelDownloadSourcesCurated: "Curated open-source sources",
    projectDataLocation: "Project data location",
    projectDataLocationLocal: "Local data directory",
    advanced: "Advanced",
    workerEndpointRaw: "Raw local runtime endpoint",
    runtimeProfile: "Runtime profile",
    runtimeProfileValue: "Development desktop runtime",
    dataContract: "Data contract",
    dataContractStable: "Stable project files and task schema",
    diagnostics: "Diagnostics",
    desktopDiagnosticsUnavailable: "Desktop diagnostics are unavailable in browser mode.",
    runtimeDiagnostics: "Runtime diagnostics",
    diagnosticsDirectory: "Diagnostics directory",
    workerStdoutLog: "Local runtime stdout log",
    workerStderrLog: "Local runtime stderr log",
    about: "About",
    version: "Version",
    application: "Application",
    applicationValue: "Local subtitle production workbench",
    licenseSummary: "License",
    licenseSummaryValue: "MIT application; model licenses vary by package",
    appearance: "Appearance",
    density: "Density",
    densityCompact: "Compact",
    interfaceScale: "Interface scale",
    subtitleEditorFontSize: "Subtitle editor font size",
    timecodeFormat: "Timecode format",
    reducedMotion: "Reduced motion",
    followsSystem: "Follows system",
    resetWorkspaceLayout: "Reset workspace layout",
    resetWorkspaceLayoutBody:
      "This resets panel sizes and collapsed docks for every workspace.",
    resetWorkspaceLayoutAction: "Reset layout",
    shortcuts: "Keyboard shortcuts",
    searchCommands: "Search commands",
    shortcutCategory: "Category",
    shortcutCommand: "Command",
    shortcutBinding: "Binding",
    shortcutAction: "Action",
    rebindShortcut: "Rebind",
    shortcutBindingFor: "Shortcut binding for {{command}}",
    shortcutConflict: "{{binding}} is already assigned to {{command}}.",
    saveShortcut: "Save shortcut",
    cancelShortcutEdit: "Cancel",
    importShortcuts: "Import shortcuts",
    exportShortcuts: "Export shortcuts",
    shortcutImportFailed: "Shortcut config could not be imported.",
    resetShortcuts: "Reset shortcuts",
    noShortcuts: "No shortcuts match the current search.",
    shortcutCategories: {
      editing: "Editing",
      timeline: "Timeline",
      workflow: "Workflow",
      delivery: "Delivery"
    },
    shortcutCommands: {
      splitLine: "Split selected line",
      undoEdit: "Undo edit",
      redoEdit: "Redo edit",
      playPause: "Play or pause preview",
      importVideo: "Import video",
      exportSubtitles: "Export subtitles"
    },
    worker: "Local processing service",
    workerUrl: "Local runtime URL",
    runtime: "Runtime",
    advancedDetails: "Advanced details",
    desktopRuntimeUnavailable: "Desktop runtime controls are unavailable in browser mode.",
    workerEndpoint: "Local runtime endpoint",
    workerStatus: "Local runtime status",
    workerLauncher: "Local runtime launcher",
    ffmpegStatus: "FFmpeg status",
    ffprobeStatus: "FFprobe status",
    ffmpegVersion: "FFmpeg version",
    ffprobeVersion: "FFprobe version",
    startWorker: "Start local runtime",
    stopWorker: "Stop local runtime",
    restartWorker: "Restart local runtime",
    runDiagnostics: "Run diagnostics",
    dataDirectory: "Data directory",
    modelsDirectory: "Models directory",
    logsDirectory: "Logs directory",
    openData: "Open data",
    openModels: "Open models",
    openLogs: "Open logs",
    releaseReadiness: "Release readiness",
    releaseReadinessLoading: "Checking release readiness...",
    releaseReadinessVersion: "Readiness report for Diplomat {{version}}.",
    releaseReady: "Release ready",
    releaseBlocked: "Release blocked",
    releasePassCount: "{{count}} pass",
    releaseWarningCount: "{{count}} warning",
    releaseBlockerCount: "{{count}} blocker",
    releaseCheckRemediation: "Remediation",
    releaseSeverities: {
      pass: "Pass",
      warning: "Warning",
      blocker: "Blocker"
    },
    defaults: "New project defaults",
    projectDefaultsDescription:
      "Used when creating new projects only. Current project language and export settings are edited in the Workbench inspectors.",
    defaultSourceLanguage: "Default source language",
    defaultTargetLanguage: "Default target language",
    defaultExportMode: "Default export mode"
  },
  help: {
    title: "Help Center",
    subtitle: "Operational guide for local subtitle production, diagnostics, and release checks.",
    search: "Search help",
    topicsNav: "Help topics",
    articleSectionsNav: "Article sections",
    noResults: "No matching help topics.",
    context: {
      openFor: "Open help for {{topic}}"
    },
    sections: {
      quickStart: {
        title: "Quick start",
        items: [
          "Start the desktop app and confirm the local runtime is reachable in Settings.",
          "Create a project in Project Library, open it, then import local videos from the Workbench.",
          "Keep source and target language codes consistent across analysis and translation."
        ]
      },
      projectsMedia: {
        title: "Projects and media",
        items: [
          "Create a named project first; video files are imported, replaced, or removed from the Workbench.",
          "Use the media bin dropzone or desktop file picker instead of typing file paths.",
          "Keep one project container per deliverable so exports, logs, drafts, and backups stay together."
        ]
      },
      transcription: {
        title: "Transcribe",
        items: [
          "Choose an installed ASR model from the Transcribe inspector before starting local transcription.",
          "For long videos, let segmentation and ASR complete before loading translation models.",
          "Review confidence and timing warnings before treating generated subtitles as ready."
        ]
      },
      translation: {
        title: "Translate",
        items: [
          "Set source and target languages in current project settings, not in system defaults.",
          "Pick a translation model that supports the active language pair.",
          "Review target subtitles segment by segment instead of overwriting approved text."
        ]
      },
      timingQa: {
        title: "Timing and QA",
        items: [
          "Use the subtitle table, line inspector, video monitor, and timeline as one linked editing surface.",
          "Fix overlaps, empty text, very short durations, and reading-speed warnings before export.",
          "Use autosaved drafts, undo, redo, split, merge, and offset tools for controlled subtitle edits."
        ]
      },
      style: {
        title: "Style",
        items: [
          "Preview subtitle placement against the video safe area before rendering burned-in output.",
          "Apply style presets intentionally; project-specific style choices do not change system defaults.",
          "Check bilingual layout, speaker labels, font size, outline, and shadow before final delivery."
        ]
      },
      export: {
        title: "Export",
        items: [
          "Save subtitle edits before exporting SRT, VTT, ASS, or burned-in video.",
          "Resolve blocker validation before starting video render.",
          "Open the export folder from project actions after render completion."
        ]
      },
      models: {
        title: "Model management",
        items: [
          "Install only the curated open-source models listed in Settings > Models.",
          "Wait for download, checksum verification, and install status before starting jobs.",
          "Use the retry action for interrupted downloads instead of adding manual model paths."
        ]
      },
      tasksRecovery: {
        title: "Tasks and recovery",
        items: [
          "Use Task Queue to inspect real jobs across projects, including running, queued, failed, and completed work.",
          "Cancel or retry tasks from their row actions, and open logs when a task repeatedly fails.",
          "Use recovery checkpoints for long jobs so a failed stage can resume without starting over."
        ]
      },
      runtime: {
        title: "Runtime",
        items: [
          "Use Settings > Runtime to start, stop, restart, and diagnose the local processing service.",
          "Project browsing and saved subtitle editing can continue while the local runtime is offline.",
          "Technical endpoints, ports, and raw logs belong in diagnostics, not the main workflow."
        ]
      },
      shortcuts: {
        title: "Keyboard shortcuts",
        items: [
          "Use the command palette to jump between projects, workspaces, tasks, settings, and help.",
          "Keep playback, selection, save, undo, redo, split, merge, and timeline zoom shortcuts consistent.",
          "When rebinding shortcuts, resolve conflicts before saving the new key map."
        ]
      },
      privacy: {
        title: "Privacy",
        items: [
          "Default ASR, translation, editing, and export flows run locally.",
          "Curated model downloads come from audited open-source sources.",
          "Remote services are not part of the formal v0.3 workflow."
        ]
      },
      troubleshooting: {
        title: "Troubleshooting",
        items: [
          "Start with the visible user-facing error, then open Settings > Diagnostics for technical details.",
          "Check local runtime status, FFmpeg, FFprobe, model installation, disk paths, and task logs.",
          "Retry failed jobs only after resolving the reported cause."
        ]
      }
    }
  },
  models: {
    title: "Models",
    subtitle: "Curated open-source ASR and translation models.",
    taskFilter: "Model task filter",
    search: "Search models",
    searchPlaceholder: "Name, runtime, language, or license",
    statusFilter: "Installation status",
    refresh: "Refresh models",
    loading: "Loading models...",
    updating: "Updating model state...",
    catalogCount: "{{count}} curated models",
    catalogUnavailableTitle: "Model catalog unavailable",
    catalogUnavailableBody:
      "Model management needs the local runtime. Open Runtime settings to start it, restart it, or run diagnostics.",
    openRuntimeSettings: "Open Runtime settings",
    recommendedSetup: "Recommended setup",
    recommendedSetupDescription:
      "Install one ASR model and one translation model for the normal local subtitle workflow.",
    advancedCatalog: "Advanced model catalog",
    advancedCatalogDescription:
      "Open the full catalog only when you need a different runtime, hardware profile, or license.",
    recommendedEmpty: "No model available",
    recommendedEmptyDescription: "The local runtime did not report a model for this task.",
    catalog: "Model Catalog",
    visibleCatalogCount: "{{visible}}/{{total}} visible",
    noModels: "No models match the current filter.",
    license: "License",
    profileAvailability: "{{available}}/{{total}} profiles",
    recommendedProfile: "Recommended profile",
    recommendedTasks: {
      asr: "ASR model",
      translation: "Translation model"
    },
    details: {
      title: "Model details",
      packageDetails: "Model package details",
      selected: "Selected",
      empty: "Select a model to inspect package details."
    },
    reasons: {
      modelNotInstalled: "Model is not installed.",
      modelLicenseAcceptanceRequired: "Model license acceptance is required.",
      modelLicenseAcceptanceIncomplete: "Model license acceptance record is incomplete."
    },
    summary: {
      installed: "Installed",
      usable: "Usable",
      activeDownloads: "Active downloads",
      runtimeProfiles: "Available profiles"
    },
    filters: {
      all: "All",
      asr: "ASR",
      translation: "Translation"
    },
    statusFilters: {
      all: "All statuses"
    },
    tasks: {
      asr: "ASR",
      translation: "Translation"
    },
    tiers: {
      light: "Light",
      high_quality: "High quality"
    },
    statuses: {
      not_installed: "Not installed",
      queued: "Queued",
      downloading: "Downloading",
      verifying: "Verifying",
      installed: "Installed",
      failed: "Failed",
      canceled: "Canceled"
    },
    actions: {
      installModel: "Install {{name}}",
      cancelModel: "Cancel {{name}}",
      retryModel: "Retry {{name}}",
      deleteModel: "Delete {{name}}"
    },
    actionLabels: {
      install: "Install",
      cancel: "Cancel",
      retry: "Retry",
      delete: "Delete"
    },
    table: {
      model: "Model",
      task: "Task",
      runtime: "Runtime",
      languages: "Languages",
      size: "Size",
      license: "License",
      status: "Status",
      hardware: "Hardware",
      actions: "Model actions"
    }
  },
  tasks: {
    title: "Tasks",
    description: "Monitor real local jobs across projects, with progress, recovery, and diagnostics.",
    loading: "Updating",
    error: "Could not load tasks.",
    errorHint: "Task status is temporarily unavailable. Open Runtime diagnostics if it repeats.",
    visibleTaskCount: "{{visible}}/{{total}} visible",
    queue: {
      title: "Task Queue",
      description: "Track running, queued, failed, canceled, and completed local jobs.",
      stage: "Stage",
      status: "Status",
      progress: "Progress",
      updated: "Updated",
      action: "Action",
      notStarted: "Not started"
    },
    filters: {
      search: "Search tasks",
      searchPlaceholder: "Task, project, status, or error",
      status: "Status",
      type: "Type",
      project: "Project",
      allStatuses: "All statuses",
      allTypes: "All types",
      allProjects: "All projects"
    },
    metrics: {
      total: "Total",
      active: "Active",
      failed: "Failed",
      completed: "Completed"
    },
    messages: {
      analysisCanceled: "Analysis canceled",
      analysisCompleted: "Analysis completed",
      analysisQueued: "Analysis queued",
      burnInExportCompleted: "Burn-in export completed",
      modelDownloadQueued: "Model download queued.",
      modelNotInstalled: "Model is not installed",
      queuedBurnInExport: "Queued burn-in export",
      taskCompleted: "Task completed",
      transcribingAudio: "Transcribing audio",
      translationCompleted: "Translation completed",
      waveformQueued: "Waveform queued",
      installTranslationModelBeforeRetrying: "Install the translation model before retrying."
    },
    table: {
      task: "Task",
      project: "Project",
      status: "Status",
      progress: "Progress",
      updated: "Updated",
      resource: "Resource",
      actions: "Actions",
      noTasks: "No background tasks yet.",
      noMatches: "No tasks match the current filters."
    },
    types: {
      analysis: "Analysis",
      translation: "Translation",
      waveform: "Waveform",
      export: "Export"
    },
    resources: {
      localRuntime: "Local runtime"
    },
    actions: {
      cancelTask: "Cancel task {{taskId}}",
      retryTask: "Retry task {{taskId}}",
      openLogs: "Open logs for task {{taskId}}",
      viewDetails: "View details for task {{taskId}}",
      recoverFromCheckpoint: "Recover from checkpoint",
      openDiagnosticLog: "Open diagnostic log"
    },
    details: {
      title: "Task details",
      currentStep: "Current step",
      pipeline: "Pipeline",
      noSelection: "Select a task to inspect progress, recovery, and logs."
    },
    pipelineStages: {
      prepare: "Prepare media",
      segmentation: "Smart segmentation",
      asr: "ASR transcription",
      translation: "Translation",
      export: "Export and render"
    },
    pipelineStatuses: {
      completed: "Completed",
      running: "Running {{progress}}",
      queued: "Queued {{progress}}",
      canceling: "Canceling {{progress}}",
      failed: "Failed {{progress}}",
      canceled: "Canceled {{progress}}",
      waiting: "Waiting"
    },
    overview: {
      title: "Long-video queue",
      description:
        "Diplomat keeps each stage separate so ASR, translation, and export can use hardware resources without competing."
    },
    stages: {
      segmentation: {
        title: "Smart segmentation",
        description: "Audio is split around speech boundaries before transcription starts.",
        status: "Planned"
      },
      asr: {
        title: "ASR transcription",
        description: "Speech-to-text tasks process prepared chunks and write recoverable subtitle drafts.",
        status: "Local"
      },
      translation: {
        title: "Translation",
        description: "Translated chunks use glossary and context after ASR memory is released.",
        status: "Local"
      },
      export: {
        title: "Export and render",
        description: "Subtitle files and burned-in video renders run after validation passes.",
        status: "Recoverable"
      }
    },
    recovery: {
      title: "Recovery controls",
      description: "Canceled or failed jobs keep enough state for retry, diagnostics, and stage-level resume."
    }
  },
  status: {
    ready: "Ready",
    running: "Running",
    queued: "Queued",
    canceling: "Canceling",
    completed: "Completed",
    failed: "Failed",
    canceled: "Canceled",
    blocked: "Blocked"
  }
} as const;
