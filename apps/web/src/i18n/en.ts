export const en = {
  app: {
    name: "Diplomat",
    subtitle: "Subtitle Workbench"
  },
  nav: {
    projects: "Projects",
    workbench: "Workbench",
    tasks: "Tasks",
    settings: "Settings"
  },
  projectCenter: {
    title: "Project Center",
    description: "Open a recent subtitle project or import a video to start a new one.",
    recentProjects: "Recent Projects",
    createProject: "Create Project",
    importVideo: "Import Video",
    noProjects: "No recent projects",
    noProjectsHint: "Import a video to create your first local project.",
    workerReady: "Worker ready",
    workerStarting: "Worker starting",
    workerUnavailable: "Worker unavailable",
    retryWorker: "Retry Worker"
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
  inspector: {
    line: "Line",
    analysis: "Analysis",
    translation: "Translation",
    export: "Export",
    emptyLine: "Select a subtitle row to edit timing and text.",
    exportDisabledNoLines: "No subtitle rows are available to export.",
    exportDisabledUnsaved: "Save subtitle edits before exporting.",
    exportResult: "SRT exported: {{exportPath}}"
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
    device: "Device",
    computeType: "Compute type",
    initialPrompt: "Initial prompt",
    translationMode: "Translation mode",
    endpoint: "Endpoint",
    apiKeyEnv: "API key env",
    exportMode: "Export mode"
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
  validation: {
    requiredField: "{{field}} is required.",
    languageCodeLength: "Use 2 to 12 characters."
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
    worker: "Worker",
    defaults: "Defaults",
    defaultExportMode: "Default export mode"
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
