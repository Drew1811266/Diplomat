import type { ProjectDiagnostics, ProjectResponse, SubtitleDocument, TaskResponse } from "@diplomat/shared";

export const projectDiagnosticsFixture: ProjectDiagnostics = {
  status: "not_transcribed",
  warnings: [],
  sourceVideoExists: true,
  projectDirExists: true,
  diskUsageBytes: 4096,
  cacheUsageBytes: 0,
  exportUsageBytes: 0,
  exportCount: 0,
  subtitleLineCount: 0,
  translatedLineCount: 0,
  activeTaskCount: 0,
  failedTaskCount: 0,
  latestTaskStatus: null,
  exportsDir: "D:/Diplomat/projects/project-demo/exports",
  cacheDir: "D:/Diplomat/projects/project-demo/cache",
  logsDir: "D:/Diplomat/projects/project-demo/logs",
  backupsDir: "D:/Diplomat/projects/project-demo/backups"
};

export const projectFixture: ProjectResponse = {
  projectId: "project-demo",
  name: "Demo",
  sourceVideoPath: "D:/media/demo.mp4",
  projectDir: "D:/Diplomat/projects/project-demo",
  durationMs: 12_000,
  sourceLanguage: "zh",
  targetLanguage: "en",
  createdAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:01:00+00:00",
  hasSubtitleDocument: false,
  diagnostics: projectDiagnosticsFixture
};

export const translatedProjectFixture: ProjectResponse = {
  ...projectFixture,
  projectId: "project-translated",
  name: "Translated Demo",
  hasSubtitleDocument: true,
  diagnostics: {
    ...projectDiagnosticsFixture,
    status: "translated",
    subtitleLineCount: 4,
    translatedLineCount: 4
  }
};

export const failedProjectFixture: ProjectResponse = {
  ...projectFixture,
  projectId: "project-failed",
  name: "Failed Demo",
  diagnostics: {
    ...projectDiagnosticsFixture,
    status: "failed",
    failedTaskCount: 1,
    latestTaskStatus: "failed",
    warnings: [{ code: "source_missing", message: "Source video does not exist" }]
  }
};

export const analyzedDocumentFixture: SubtitleDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-demo",
  mediaId: "media-demo",
  durationMs: 12_000,
  speakers: [
    {
      id: "speaker-1",
      displayName: "Speaker 1",
      color: "#0D9488",
      styleId: "default",
      mergedInto: null
    }
  ],
  styles: [
    {
      id: "default",
      name: "Default",
      fontFamily: "Arial",
      fontSize: 36,
      primaryColor: "#FFFFFF",
      secondaryColor: "#14B8A6",
      strokeWidth: 3,
      shadow: 1,
      position: "bottom-center",
      marginV: 48,
      alignment: "center",
      bilingualLayout: "source-above-target",
      lineSpacing: 1.15
    }
  ],
  lines: [
    {
      id: "line-1",
      startMs: 1000,
      endMs: 2400,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "原始字幕文本",
      translatedText: "",
      words: [{ text: "原始字幕文本", startMs: 1000, endMs: 2400, confidence: 0.95 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "mock-asr", model: "mock-v1" },
      translationStatus: "not_requested",
      translationOrigin: null,
      translationError: null,
      notes: ""
    }
  ]
};

export const translatedDocumentFixture: SubtitleDocument = {
  ...analyzedDocumentFixture,
  lines: [
    {
      ...analyzedDocumentFixture.lines[0],
      translatedText: "[en] 原始字幕文本",
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" },
      translationError: null
    }
  ]
};

export const completedAnalysisTaskFixture: TaskResponse = {
  taskId: "task-1",
  projectId: "project-demo",
  type: "analysis",
  status: "completed",
  progress: 1,
  message: "Analysis completed",
  startedAt: "2026-06-07T00:00:00+00:00",
  updatedAt: "2026-06-07T00:00:01+00:00",
  completedAt: "2026-06-07T00:00:01+00:00",
  errorCode: null,
  errorMessage: null,
  diagnosticLogPath: null
};

export const runningAnalysisTaskFixture: TaskResponse = {
  ...completedAnalysisTaskFixture,
  status: "running",
  progress: 0.35,
  message: "Transcribing audio",
  completedAt: null
};

export const completedTranslationTaskFixture: TaskResponse = {
  ...completedAnalysisTaskFixture,
  taskId: "translation-task-1",
  type: "translation",
  message: "Translation completed"
};
