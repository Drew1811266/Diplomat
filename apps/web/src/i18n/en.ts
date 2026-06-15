export const en = {
  app: {
    name: "Diplomat",
    subtitle: "Subtitle Workbench"
  },
  nav: {
    projects: "Projects",
    workbench: "Workbench",
    models: "Models",
    tasks: "Tasks",
    help: "Help",
    settings: "Settings"
  },
  projectCenter: {
    title: "Project Center",
    description: "Open a recent subtitle project or import a video to start a new one.",
    recentProjects: "Recent Projects",
    createProject: "Create Project",
    importVideo: "Import Video",
    untitledProject: "Untitled Project",
    creationTitle: "New Project",
    importFallbackHint:
      "Use the desktop picker or paste a local video path, then create the project.",
    creatingProject: "Creating project...",
    noProjects: "No recent projects",
    noProjectsHint: "Import a video to create your first local project.",
    workerReady: "Worker ready",
    workerStarting: "Worker starting",
    workerUnavailable: "Worker unavailable",
    retryWorker: "Retry Worker",
    search: "Search projects",
    searchPlaceholder: "Name, source path, language, or project id",
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
    actionsFor: "Project actions for {{name}}",
    openProjectFolder: "Open project folder",
    openExportsFolder: "Open export folder",
    openLogsFolder: "Open log folder",
    cleanCache: "Clean cache",
    cleanExports: "Clean exports",
    backupProject: "Backup project",
    importBackup: "Import backup",
    deleteProject: "Delete project",
    confirmDelete: "Confirm delete",
    deleteFiles: "Delete project files",
    deleteConfirmationBody:
      "This removes {{name}} from the project library. File deletion cannot be undone when enabled.",
    backupPackagePath: "Backup package path",
    restoreName: "Restore name",
    table: {
      project: "Project",
      source: "Source",
      languages: "Languages",
      subtitles: "Subtitles",
      duration: "Duration",
      actions: "Project actions"
    }
  },
  toolbar: {
    import: "Import",
    analyze: "Analyze",
    translate: "Translate",
    save: "Save",
    export: "Export"
  },
  workbench: {
    title: "Workbench",
    labels: {
      projectTools: "Project tools",
      videoPreview: "Video preview",
      videoPreviewMedia: "Video preview media",
      inspector: "Inspector",
      timeline: "Timeline"
    },
    timeline: {
      subtitleRows: "{{count}} subtitle rows"
    },
    noProject: "No project selected",
    noDocument: "No subtitle document",
    unsaved: "Unsaved changes",
    saved: "Saved",
    loadingProject: "Loading project...",
    loadingSubtitle: "Loading subtitle document...",
    projectLoadError: "Could not load project.",
    subtitleLoadError: "Could not load subtitle document.",
    previewUnavailable: "Video preview unavailable",
    subtitleGrid: "Subtitle Grid"
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
    line: "Line",
    analysis: "Analysis",
    translation: "Translation",
    export: "Export",
    emptyLine: "Select a subtitle row to edit timing and text.",
    exportDisabledNoLines: "No subtitle rows are available to export.",
    exportDisabledUnsaved: "Save subtitle edits before exporting.",
    exportDisabledTaskActive: "Wait for analysis or translation to finish.",
    exportDisabledDataError: "Resolve project or subtitle errors before exporting.",
    exportDisabledTiming: "Fix timing errors before exporting.",
    exportResult: "{{format}} exported: {{exportPath}}",
    selectModel: "Select model",
    noAsrModelAvailable: "No installed ASR model",
    installAsrModelFirst: "Install an ASR model from Models before starting local transcription.",
    noTranslationModelAvailable: "No installed translation model",
    installTranslationModelFirst: "Install a translation model from Models before starting local translation.",
    translationPairUnsupported: "Selected translation model does not support this language pair.",
    translationModelUnavailable: "Install this translation model before starting translation.",
    localTranslationPending: "Local translation model execution lands in 0.25.",
    runtimeProfile: "{{device}} · {{computeType}} · Batch size {{batchSize}}"
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
    save: "Save",
    close: "Close"
  },
  settings: {
    title: "Settings",
    language: "Interface language",
    theme: "Theme",
    themeLight: "Light",
    worker: "Worker",
    workerUrl: "Worker URL",
    runtime: "Runtime",
    desktopRuntimeUnavailable: "Desktop runtime controls are unavailable in browser mode.",
    workerEndpoint: "Worker endpoint",
    workerStatus: "Worker status",
    workerLauncher: "Worker launcher",
    ffmpegStatus: "FFmpeg status",
    ffprobeStatus: "FFprobe status",
    ffmpegVersion: "FFmpeg version",
    ffprobeVersion: "FFprobe version",
    startWorker: "Start Worker",
    stopWorker: "Stop Worker",
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
    defaults: "Defaults",
    defaultSourceLanguage: "Default source language",
    defaultTargetLanguage: "Default target language",
    defaultExportMode: "Default export mode"
  },
  help: {
    title: "Help Center",
    subtitle: "Operational guide for local subtitle production, diagnostics, and release checks.",
    sections: {
      firstRun: {
        title: "First run",
        items: [
          "Start the desktop app and confirm the Worker is reachable in Settings.",
          "Import a local video from Project Center before opening the Workbench.",
          "Keep source and target language codes consistent across analysis and translation."
        ]
      },
      models: {
        title: "Model management",
        items: [
          "Install only the curated open-source models listed in Models.",
          "Wait for download, checksum verification, and install status before starting jobs.",
          "Use the retry action for interrupted downloads instead of adding manual model paths."
        ]
      },
      localWorkflow: {
        title: "Local workflow",
        items: [
          "Create or import one project per source video.",
          "Run analysis first, then translation when target subtitles are required.",
          "Use Tasks to track queued, running, completed, failed, and canceled jobs."
        ]
      },
      editing: {
        title: "Editing",
        items: [
          "Review timing warnings before export.",
          "Use autosaved drafts and snapshots before larger timing or text changes.",
          "Keep speaker, style, and bilingual layout choices aligned with the final export target."
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
      diagnostics: {
        title: "Diagnostics",
        items: [
          "Use Settings to inspect Worker, FFmpeg, FFprobe, data, model, and log paths.",
          "Open logs from Settings when a background task fails.",
          "Retry failed jobs only after resolving the reported error."
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
      releaseChecklist: {
        title: "Release checklist",
        items: [
          "Use Settings to review the release readiness panel.",
          "Treat blocker checks as release-stopping issues.",
          "Confirm packaging, documentation, FFmpeg, model licenses, sources, and checksums before tagging."
        ]
      }
    }
  },
  models: {
    title: "Models",
    subtitle: "Curated open-source ASR and translation models.",
    taskFilter: "Model task filter",
    loading: "Loading models...",
    updating: "Updating model state...",
    catalogCount: "{{count}} curated models",
    catalog: "Model Catalog",
    noModels: "No models match the current filter.",
    license: "License",
    filters: {
      all: "All",
      asr: "ASR",
      translation: "Translation"
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
    description: "Background analysis, translation, and export task history will appear here."
  },
  status: {
    ready: "Ready",
    running: "Running",
    queued: "Queued",
    completed: "Completed",
    failed: "Failed",
    canceled: "Canceled",
    blocked: "Blocked"
  }
} as const;
