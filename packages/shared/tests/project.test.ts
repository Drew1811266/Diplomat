import { describe, expect, it } from "vitest";
import {
  AnalyzeProjectResponseSchema,
  CreateProjectRequestSchema,
  ProjectBackupResponseSchema,
  ProjectImportRequestSchema,
  ProjectListResponseSchema,
  ProjectMaintenanceResponseSchema,
  ProjectResponseSchema,
  ProjectStatusSchema,
  SubtitleDraftResponseSchema,
  SubtitleDocumentRequestSchema,
  SubtitleSnapshotCreateRequestSchema,
  SubtitleSnapshotListResponseSchema,
  SubtitleSnapshotResponseSchema,
  WaveformResponseSchema
} from "../src/project";

const validDocument = {
  schemaVersion: "diplomat.subtitle.v1",
  projectId: "project-1",
  mediaId: "media-1",
  durationMs: 10_000,
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
      endMs: 2500,
      speakerId: "speaker-1",
      sourceLanguage: "zh",
      targetLanguage: "en",
      sourceText: "你好",
      translatedText: "Hello",
      words: [{ text: "你好", startMs: 1000, endMs: 2500, confidence: 0.94 }],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    }
  ]
};

const validProjectDiagnostics = {
  status: "translated",
  warnings: [],
  sourceVideoExists: true,
  projectDirExists: true,
  diskUsageBytes: 4096,
  cacheUsageBytes: 128,
  exportUsageBytes: 2048,
  exportCount: 1,
  subtitleLineCount: 10,
  translatedLineCount: 10,
  activeTaskCount: 0,
  failedTaskCount: 0,
  latestTaskStatus: "completed",
  exportsDir: "D:/Diplomat/projects/project-1/exports",
  cacheDir: "D:/Diplomat/projects/project-1/cache",
  logsDir: "D:/Diplomat/projects/project-1/logs",
  backupsDir: "D:/Diplomat/projects/project-1/backups"
};

describe("CreateProjectRequestSchema", () => {
  it("accepts a valid create project request", () => {
    const request = CreateProjectRequestSchema.parse({
      name: "Launch interview",
      sourceVideoPath: "D:/media/interview.mp4",
      sourceLanguage: "zh",
      targetLanguage: "en"
    });

    expect(request.name).toBe("Launch interview");
    expect(request.targetLanguage).toBe("en");
  });

  it("accepts a null target language", () => {
    const request = CreateProjectRequestSchema.parse({
      name: "Source-only review",
      sourceVideoPath: "D:/media/review.mp4",
      sourceLanguage: "ja",
      targetLanguage: null
    });

    expect(request.targetLanguage).toBeNull();
  });

  it("defaults an omitted target language to null", () => {
    const request = CreateProjectRequestSchema.parse({
      name: "Source-only review",
      sourceVideoPath: "D:/media/review.mp4",
      sourceLanguage: "ja"
    });

    expect(request.targetLanguage).toBeNull();
  });
});

describe("ProjectResponseSchema", () => {
  it("accepts a valid project response", () => {
    const response = ProjectResponseSchema.parse({
      projectId: "project-1",
      name: "Launch interview",
      sourceVideoPath: "D:/media/interview.mp4",
      projectDir: "D:/Diplomat/projects/project-1",
      durationMs: 124_000,
      sourceLanguage: "zh",
      targetLanguage: "en",
      createdAt: "2026-06-07T00:00:00+00:00",
      updatedAt: "2026-06-07T00:01:00+00:00",
      hasSubtitleDocument: true,
      diagnostics: validProjectDiagnostics
    });

    expect(response.projectId).toBe("project-1");
    expect(response.durationMs).toBe(124_000);
    expect(response.hasSubtitleDocument).toBe(true);
  });

  it("accepts a null target language", () => {
    const response = ProjectResponseSchema.parse({
      projectId: "project-1",
      name: "Launch interview",
      sourceVideoPath: "D:/media/interview.mp4",
      projectDir: "D:/Diplomat/projects/project-1",
      durationMs: 124_000,
      sourceLanguage: "zh",
      targetLanguage: null,
      createdAt: "2026-06-07T00:00:00+00:00",
      updatedAt: "2026-06-07T00:01:00+00:00",
      hasSubtitleDocument: false,
      diagnostics: {
        ...validProjectDiagnostics,
        status: "not_transcribed",
        subtitleLineCount: 0,
        translatedLineCount: 0,
        exportCount: 0
      }
    });

    expect(response.targetLanguage).toBeNull();
    expect(response.hasSubtitleDocument).toBe(false);
  });

  it("does not apply request language code length constraints to responses", () => {
    const response = ProjectResponseSchema.parse({
      projectId: "project-1",
      name: "Launch interview",
      sourceVideoPath: "D:/media/interview.mp4",
      projectDir: "D:/Diplomat/projects/project-1",
      durationMs: 124_000,
      sourceLanguage: "z",
      targetLanguage: "english-long-name",
      createdAt: "2026-06-07T00:00:00+00:00",
      updatedAt: "2026-06-07T00:01:00+00:00",
      hasSubtitleDocument: true,
      diagnostics: validProjectDiagnostics
    });

    expect(response.sourceLanguage).toBe("z");
    expect(response.targetLanguage).toBe("english-long-name");
  });
});

describe("ProjectListResponseSchema", () => {
  it("accepts project diagnostics in list responses", () => {
    const response = ProjectListResponseSchema.parse({
      projects: [
        {
          projectId: "project-1",
          name: "Launch interview",
          sourceVideoPath: "D:/media/interview.mp4",
          projectDir: "D:/Diplomat/projects/project-1",
          durationMs: 124_000,
          sourceLanguage: "zh",
          targetLanguage: "en",
          createdAt: "2026-06-07T00:00:00+00:00",
          updatedAt: "2026-06-07T00:01:00+00:00",
          hasSubtitleDocument: true,
          diagnostics: validProjectDiagnostics
        }
      ]
    });

    expect(response.projects[0]?.diagnostics.status).toBe("translated");
    expect(response.projects[0]?.diagnostics.exportCount).toBe(1);
  });

  it("accepts a project list response", () => {
    const response = ProjectListResponseSchema.parse({
      projects: [
        {
          projectId: "project-1",
          name: "Launch interview",
          sourceVideoPath: "D:/media/interview.mp4",
          projectDir: "D:/Diplomat/projects/project-1",
          durationMs: 124_000,
          sourceLanguage: "zh",
          targetLanguage: "en",
          createdAt: "2026-06-07T00:00:00+00:00",
          updatedAt: "2026-06-07T00:01:00+00:00",
          hasSubtitleDocument: true,
          diagnostics: validProjectDiagnostics
        }
      ]
    });

    expect(response.projects[0]?.hasSubtitleDocument).toBe(true);
  });
});

describe("Project management schemas", () => {
  it("rejects unsupported project statuses", () => {
    expect(ProjectStatusSchema.parse("failed")).toBe("failed");
    expect(() => ProjectStatusSchema.parse("unknown")).toThrow();
  });

  it("accepts maintenance and backup responses", () => {
    const maintenance = ProjectMaintenanceResponseSchema.parse({
      projectId: "project-1",
      action: "cleanup_exports",
      filesAffected: 2,
      bytesAffected: 200,
      message: "Cleaned exports."
    });
    const backup = ProjectBackupResponseSchema.parse({
      projectId: "project-1",
      packagePath: "D:/Diplomat/projects/project-1/backups/demo.diplomat-project.zip",
      bytesWritten: 1024,
      message: "Backup created."
    });

    expect(maintenance.bytesAffected).toBe(200);
    expect(backup.bytesWritten).toBe(1024);
  });

  it("accepts an import request with a restore name", () => {
    const request = ProjectImportRequestSchema.parse({
      packagePath: "D:/backups/demo.diplomat-project.zip",
      restoreName: "Restored Demo"
    });

    expect(request.restoreName).toBe("Restored Demo");
  });
});

describe("AnalyzeProjectResponseSchema", () => {
  it("accepts a completed analysis response with a subtitle document", () => {
    const response = AnalyzeProjectResponseSchema.parse({
      projectId: "project-1",
      status: "completed",
      subtitlePath: "D:/Diplomat/projects/project-1/subtitles.json",
      lineCount: 1,
      document: validDocument
    });

    expect(response.status).toBe("completed");
    expect(response.document.lines).toHaveLength(1);
  });
});

describe("SubtitleDocumentRequestSchema", () => {
  it("accepts a subtitle document request", () => {
    const request = SubtitleDocumentRequestSchema.parse({ document: validDocument });

    expect(request.document.projectId).toBe("project-1");
  });
});

describe("Subtitle draft and snapshot schemas", () => {
  it("accepts a subtitle draft response", () => {
    const draft = SubtitleDraftResponseSchema.parse({
      projectId: "project-1",
      updatedAt: "2026-06-14T00:00:00+00:00",
      lineCount: 1,
      document: validDocument
    });

    expect(draft.projectId).toBe("project-1");
    expect(draft.lineCount).toBe(1);
    expect(draft.document.lines[0]?.sourceText).toBe("你好");
  });

  it("accepts snapshot create requests with working documents", () => {
    const request = SubtitleSnapshotCreateRequestSchema.parse({
      reason: "batch_timing",
      label: "Before batch offset",
      document: validDocument
    });

    expect(request.reason).toBe("batch_timing");
    expect(request.label).toBe("Before batch offset");
    expect(request.document?.projectId).toBe("project-1");
  });

  it("accepts snapshot summaries and full snapshot responses", () => {
    const summary = {
      snapshotId: "snapshot-20260614000000000000-abcd1234",
      projectId: "project-1",
      reason: "manual",
      label: "Manual checkpoint",
      createdAt: "2026-06-14T00:00:00+00:00",
      lineCount: 1
    };
    const list = SubtitleSnapshotListResponseSchema.parse({
      projectId: "project-1",
      snapshots: [summary]
    });
    const response = SubtitleSnapshotResponseSchema.parse({
      ...summary,
      document: validDocument
    });

    expect(list.snapshots[0]?.snapshotId).toBe(summary.snapshotId);
    expect(response.document.projectId).toBe("project-1");
  });

  it("rejects unsupported snapshot reasons", () => {
    expect(() =>
      SubtitleSnapshotCreateRequestSchema.parse({
        reason: "unsafe_reason",
        label: null,
        document: validDocument
      })
    ).toThrow();
  });
});

describe("WaveformResponseSchema", () => {
  it("accepts normalized waveform peaks", () => {
    const waveform = WaveformResponseSchema.parse({
      projectId: "project-1",
      durationMs: 1000,
      sampleRate: 8000,
      peakCount: 2,
      peaks: [
        { index: 0, startMs: 0, endMs: 500, min: -0.25, max: 0.8 },
        { index: 1, startMs: 500, endMs: 1000, min: -0.5, max: 0.4 }
      ]
    });

    expect(waveform.peakCount).toBe(2);
    expect(waveform.peaks[0]?.max).toBe(0.8);
  });

  it("rejects out-of-range waveform peak amplitudes", () => {
    expect(() =>
      WaveformResponseSchema.parse({
        projectId: "project-1",
        durationMs: 1000,
        sampleRate: 8000,
        peakCount: 1,
        peaks: [{ index: 0, startMs: 0, endMs: 1000, min: -1.25, max: 0.5 }]
      })
    ).toThrow();
  });

  it("rejects mismatched waveform peak counts", () => {
    expect(() =>
      WaveformResponseSchema.parse({
        projectId: "project-1",
        durationMs: 1000,
        sampleRate: 8000,
        peakCount: 2,
        peaks: [{ index: 0, startMs: 0, endMs: 1000, min: -0.25, max: 0.5 }]
      })
    ).toThrow();
  });
});
