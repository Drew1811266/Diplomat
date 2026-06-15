import type {
  ModelCatalogResponse,
  ProjectDiagnostics,
  ProjectResponse,
  SubtitleDocument,
  TaskResponse
} from "@diplomat/shared";

function runtimeProfiles(modelId: string, task: "asr" | "translation", provider: string) {
  const translationNote =
    provider === "local-llm" ? "Local LLM translation profile." : "CTranslate2 batch translation profile.";
  return [
    {
      profileId: `${modelId}:cpu:int8`,
      task,
      provider,
      device: "cpu",
      computeType: "int8",
      batchSize: task === "translation" ? 8 : 1,
      recommended: true,
      available: true,
      reason: null,
      notes: task === "translation" ? translationNote : "CPU fallback ASR profile."
    },
    {
      profileId: `${modelId}:cuda:float16`,
      task,
      provider,
      device: "cuda",
      computeType: "float16",
      batchSize: task === "translation" ? 8 : 1,
      recommended: true,
      available: false,
      reason: "CUDA is not available in this Worker runtime.",
      notes: task === "translation" ? translationNote : "CUDA float16 ASR profile."
    }
  ];
}

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
      lineSpacing: 1.15,
      backgroundBar: false,
      backgroundColor: "#000000cc",
      safeAreaMargin: 32
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

export const modelCatalogFixture: ModelCatalogResponse = {
  models: [
    {
      modelId: "asr.faster-whisper.small",
      name: "Faster Whisper Small",
      task: "asr",
      tier: "light",
      runtime: "faster-whisper",
      provider: "faster-whisper",
      version: "2026-06-14",
      languages: ["zh", "en"],
      languagePairs: [],
      modelSizeBytes: 488_000_000,
      downloadSizeBytes: 244_000_000,
      diskRequirementBytes: 600_000_000,
      recommendedHardware: "CPU fallback; NVIDIA GPU recommended.",
      licenseName: "MIT",
      licenseUrl: "https://huggingface.co/Systran/faster-whisper-small",
      sourceUrl: "https://example.invalid/asr-small.bin",
      checksumAlgorithm: "sha256",
      checksum: "0".repeat(64),
      termsSummary: "Open model weights; verify upstream license before release.",
      installation: {
        modelId: "asr.faster-whisper.small",
        status: "not_installed",
        installedPath: null,
        downloadedBytes: 0,
        totalBytes: 244_000_000,
        checksum: "0".repeat(64),
        errorMessage: null,
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:00:00+00:00",
        installedAt: null
      },
      availability: {
        usable: false,
        reason: "Model is not installed."
      },
      runtimeProfiles: runtimeProfiles("asr.faster-whisper.small", "asr", "faster-whisper")
    },
    {
      modelId: "asr.faster-whisper.medium",
      name: "Faster Whisper Medium",
      task: "asr",
      tier: "high_quality",
      runtime: "faster-whisper",
      provider: "faster-whisper",
      version: "2026-06-14",
      languages: ["zh", "en"],
      languagePairs: [],
      modelSizeBytes: 1_530_000_000,
      downloadSizeBytes: 770_000_000,
      diskRequirementBytes: 1_800_000_000,
      recommendedHardware: "NVIDIA GPU recommended.",
      licenseName: "MIT",
      licenseUrl: "https://huggingface.co/Systran/faster-whisper-medium",
      sourceUrl: "https://example.invalid/asr-medium.bin",
      checksumAlgorithm: "sha256",
      checksum: "1".repeat(64),
      termsSummary: "Open model weights; verify upstream license before release.",
      installation: {
        modelId: "asr.faster-whisper.medium",
        status: "installed",
        installedPath: "D:/Diplomat/models/asr-medium",
        downloadedBytes: 770_000_000,
        totalBytes: 770_000_000,
        checksum: "1".repeat(64),
        errorMessage: null,
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:02:00+00:00",
        installedAt: "2026-06-14T00:02:00+00:00"
      },
      availability: {
        usable: true,
        reason: null
      },
      runtimeProfiles: runtimeProfiles("asr.faster-whisper.medium", "asr", "faster-whisper")
    },
    {
      modelId: "translation.opus-mt.zh-en",
      name: "OPUS-MT Chinese to English",
      task: "translation",
      tier: "light",
      runtime: "ct2-marian",
      provider: "ct2-marian",
      version: "2026-06-14",
      languages: ["zh", "en"],
      languagePairs: [["zh", "en"]],
      modelSizeBytes: 310_000_000,
      downloadSizeBytes: 160_000_000,
      diskRequirementBytes: 400_000_000,
      recommendedHardware: "CPU fallback; GPU optional for batch work.",
      licenseName: "CC-BY-4.0",
      licenseUrl: "https://huggingface.co/Helsinki-NLP/opus-mt-zh-en",
      sourceUrl: "https://example.invalid/opus-zh-en.bin",
      checksumAlgorithm: "sha256",
      checksum: "2".repeat(64),
      termsSummary: "Open translation model with attribution requirements.",
      installation: {
        modelId: "translation.opus-mt.zh-en",
        status: "downloading",
        installedPath: null,
        downloadedBytes: 32_000_000,
        totalBytes: 160_000_000,
        checksum: "2".repeat(64),
        errorMessage: null,
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:03:00+00:00",
        installedAt: null
      },
      availability: {
        usable: false,
        reason: "Model download is in progress."
      },
      runtimeProfiles: runtimeProfiles("translation.opus-mt.zh-en", "translation", "ct2-marian")
    },
    {
      modelId: "translation.qwen3.4b",
      name: "Qwen3 4B Translation",
      task: "translation",
      tier: "high_quality",
      runtime: "local-llm",
      provider: "local-llm",
      version: "2026-06-14",
      languages: ["zh", "en"],
      languagePairs: [
        ["zh", "en"],
        ["en", "zh"]
      ],
      modelSizeBytes: 4_000_000_000,
      downloadSizeBytes: 2_500_000_000,
      diskRequirementBytes: 5_000_000_000,
      recommendedHardware: "NVIDIA GPU recommended.",
      licenseName: "Apache-2.0",
      licenseUrl: "https://huggingface.co/Qwen/Qwen3-4B",
      sourceUrl: "https://example.invalid/qwen3-4b.bin",
      checksumAlgorithm: "sha256",
      checksum: "3".repeat(64),
      termsSummary: "Open-weight local LLM candidate.",
      installation: {
        modelId: "translation.qwen3.4b",
        status: "failed",
        installedPath: null,
        downloadedBytes: 0,
        totalBytes: 2_500_000_000,
        checksum: "3".repeat(64),
        errorMessage: "checksum mismatch",
        createdAt: "2026-06-14T00:00:00+00:00",
        updatedAt: "2026-06-14T00:04:00+00:00",
        installedAt: null
      },
      availability: {
        usable: false,
        reason: "checksum mismatch"
      },
      runtimeProfiles: runtimeProfiles("translation.qwen3.4b", "translation", "local-llm")
    }
  ]
};
