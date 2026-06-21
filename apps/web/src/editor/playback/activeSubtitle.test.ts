import type { SubtitleLine } from "@diplomat/shared";
import { describe, expect, it } from "vitest";
import { findActiveSubtitle } from "./activeSubtitle";

const line = (id: string, startMs: number, endMs: number): SubtitleLine => ({
  id,
  startMs,
  endMs,
  speakerId: null,
  sourceLanguage: "en",
  targetLanguage: "zh",
  sourceText: id,
  translatedText: "",
  words: [],
  styleOverrides: {},
  reviewStatus: "draft",
  aiOrigin: { engine: "test", model: "test" },
  translationStatus: "not_requested",
  translationOrigin: null,
  translationError: null,
  translationQualityIssues: [],
  notes: ""
});

describe("findActiveSubtitle", () => {
  const lines = [line("line-1", 0, 1000), line("line-2", 1200, 2000)];

  it("returns the line containing the time", () => {
    expect(findActiveSubtitle(lines, 500)?.id).toBe("line-1");
  });

  it("includes the start boundary and excludes the end boundary", () => {
    expect(findActiveSubtitle(lines, 0)?.id).toBe("line-1");
    expect(findActiveSubtitle(lines, 1000)).toBeNull();
  });

  it("returns null during gaps", () => {
    expect(findActiveSubtitle(lines, 1100)).toBeNull();
  });

  it("returns the shortest matching line for overlaps", () => {
    const overlapping = [line("wide", 0, 3000), line("narrow", 1000, 1500)];
    expect(findActiveSubtitle(overlapping, 1250)?.id).toBe("narrow");
  });
});
