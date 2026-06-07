import { describe, expect, it } from "vitest";
import { SubtitleDocumentSchema, SubtitleLineSchema } from "../src/subtitle";

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

describe("SubtitleDocumentSchema", () => {
  it("accepts a valid Diplomat subtitle document", () => {
    const parsed = SubtitleDocumentSchema.parse(validDocument);
    expect(parsed.lines[0]!.sourceText).toBe("你好");
  });

  it("rejects a subtitle line whose end time is before the start time", () => {
    const invalid = structuredClone(validDocument);
    invalid.lines[0]!.endMs = 900;
    expect(() => SubtitleDocumentSchema.parse(invalid)).toThrow();
  });

  it("rejects unknown style override keys", () => {
    const invalid = structuredClone(validDocument);
    invalid.lines[0]!.styleOverrides = { unexpectedKey: "value" };
    expect(() => SubtitleDocumentSchema.parse(invalid)).toThrow();
  });
});

describe("translation metadata", () => {
  it("defaults M4 translation metadata for older subtitle lines", () => {
    const parsed = SubtitleLineSchema.parse({
      id: "line-1",
      startMs: 0,
      endMs: 1000,
      speakerId: "speaker-1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      sourceText: "Hello",
      translatedText: "",
      words: [],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: ""
    });

    expect(parsed.translationStatus).toBe("not_requested");
    expect(parsed.translationOrigin).toBeNull();
    expect(parsed.translationError).toBeNull();
  });

  it("accepts generated translation metadata", () => {
    const parsed = SubtitleLineSchema.parse({
      id: "line-1",
      startMs: 0,
      endMs: 1000,
      speakerId: "speaker-1",
      sourceLanguage: "en",
      targetLanguage: "zh",
      sourceText: "Hello",
      translatedText: "你好",
      words: [],
      styleOverrides: {},
      reviewStatus: "draft",
      aiOrigin: { engine: "fake-asr", model: "fake-v1" },
      notes: "",
      translationStatus: "translated",
      translationOrigin: { provider: "fake", model: "fake-v1" },
      translationError: null
    });

    expect(parsed.translationOrigin?.provider).toBe("fake");
  });
});
