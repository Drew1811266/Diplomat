import { describe, expect, it } from "vitest";
import {
  AnalyzeProjectResponseSchema,
  CreateProjectRequestSchema,
  ProjectResponseSchema,
  SubtitleDocumentRequestSchema
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
      targetLanguage: "en"
    });

    expect(response.projectId).toBe("project-1");
    expect(response.durationMs).toBe(124_000);
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
