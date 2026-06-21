import type { SubtitleDocument, SubtitleLine } from "@diplomat/shared";
import {
  redoEditorHistory,
  undoEditorHistory,
  updateEditorHistory,
  type EditorHistory
} from "../editor/commands/EditorHistory";

export type MergeDirection = "previous" | "next";
export type OffsetScope = "selected" | "all" | "after_playhead";

export type SubtitleHistory = EditorHistory<SubtitleDocument>;

export type OffsetSubtitleLinesOptions = {
  scope: OffsetScope;
  selectedLineId: string | null;
  currentTimeMs: number;
  offsetMs: number;
};

const minDurationMs = 300;
const snapMs = 50;
const cjkBoundaryPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function snap(value: number) {
  return Math.round(value / snapMs) * snapMs;
}

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: "grapheme" | "word" | "sentence" }
) => {
  segment(input: string): Iterable<{ segment: string }>;
};

function splitGraphemes(value: string) {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (!Segmenter) {
    return Array.from(value);
  }
  return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), (part) => part.segment);
}

function splitText(value: string): [string, string] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [value, ""];
  }

  if (/\s/.test(trimmed)) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return [value, ""];
    }
    const midpoint = Math.ceil(parts.length / 2);
    return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
  }

  const parts = splitGraphemes(trimmed);
  if (parts.length <= 1) {
    return [value, ""];
  }
  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(""), parts.slice(midpoint).join("")];
}

function nextSplitLineId(lines: SubtitleLine[], lineId: string) {
  const existing = new Set(lines.map((line) => line.id));
  let index = 1;
  let candidate = `${lineId}-split-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${lineId}-split-${index}`;
  }
  return candidate;
}

function shouldJoinWithoutSpace(left: string, right: string) {
  const leftTrimmed = left.trim();
  const rightTrimmed = right.trim();
  if (!leftTrimmed || !rightTrimmed) {
    return false;
  }
  return (
    cjkBoundaryPattern.test(leftTrimmed.at(-1) ?? "") &&
    cjkBoundaryPattern.test(rightTrimmed.at(0) ?? "")
  );
}

function joinText(...values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce((joined, value) => {
      if (!joined) {
        return value;
      }
      return shouldJoinWithoutSpace(joined, value) ? `${joined}${value}` : `${joined} ${value}`;
    }, "");
}

export function splitSubtitleLine(
  document: SubtitleDocument,
  lineId: string,
  requestedSplitMs: number
): SubtitleDocument {
  const index = document.lines.findIndex((line) => line.id === lineId);
  if (index < 0) {
    return document;
  }

  const line = document.lines[index]!;
  if (line.endMs - line.startMs < minDurationMs * 2) {
    return document;
  }

  const splitMs = clamp(
    snap(requestedSplitMs),
    line.startMs + minDurationMs,
    line.endMs - minDurationMs
  );
  const [firstSource, secondSource] = splitText(line.sourceText);
  const [firstTranslation, secondTranslation] = splitText(line.translatedText);
  const firstWords = line.words.filter((word) => word.endMs <= splitMs);
  const secondWords = line.words.filter((word) => word.startMs >= splitMs);
  const firstLine: SubtitleLine = {
    ...line,
    endMs: splitMs,
    sourceText: firstSource,
    translatedText: firstTranslation,
    words: firstWords
  };
  const secondLine: SubtitleLine = {
    ...line,
    id: nextSplitLineId(document.lines, line.id),
    startMs: splitMs,
    sourceText: secondSource,
    translatedText: secondTranslation,
    words: secondWords,
    reviewStatus: "draft",
    translationStatus: secondTranslation ? line.translationStatus : "not_requested",
    translationOrigin: secondTranslation ? line.translationOrigin : null,
    translationError: null
  };

  return {
    ...document,
    lines: [
      ...document.lines.slice(0, index),
      firstLine,
      secondLine,
      ...document.lines.slice(index + 1)
    ]
  };
}

export function mergeSubtitleLine(
  document: SubtitleDocument,
  lineId: string,
  direction: MergeDirection
): SubtitleDocument {
  const index = document.lines.findIndex((line) => line.id === lineId);
  const neighborIndex = direction === "previous" ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= document.lines.length) {
    return document;
  }

  const current = document.lines[index]!;
  const neighbor = document.lines[neighborIndex]!;
  const first = direction === "previous" ? neighbor : current;
  const second = direction === "previous" ? current : neighbor;
  const merged: SubtitleLine = {
    ...first,
    startMs: Math.min(first.startMs, second.startMs),
    endMs: Math.max(first.endMs, second.endMs),
    sourceText: joinText(first.sourceText, second.sourceText),
    translatedText: joinText(first.translatedText, second.translatedText),
    words: [...first.words, ...second.words].sort((a, b) => a.startMs - b.startMs),
    notes: joinText(first.notes, second.notes),
    reviewStatus: "draft",
    translationStatus:
      first.translationStatus === second.translationStatus ? first.translationStatus : "edited",
    translationError: first.translationError ?? second.translationError
  };
  const start = Math.min(index, neighborIndex);
  const end = Math.max(index, neighborIndex);

  return {
    ...document,
    lines: [
      ...document.lines.slice(0, start),
      merged,
      ...document.lines.slice(end + 1)
    ]
  };
}

export function offsetSubtitleLines(
  document: SubtitleDocument,
  options: OffsetSubtitleLinesOptions
): SubtitleDocument {
  const shouldOffset = (line: SubtitleLine) => {
    if (options.scope === "all") {
      return true;
    }
    if (options.scope === "selected") {
      return line.id === options.selectedLineId;
    }
    return line.startMs >= options.currentTimeMs;
  };

  return {
    ...document,
    lines: document.lines.map((line) => {
      if (!shouldOffset(line)) {
        return line;
      }
      const duration = line.endMs - line.startMs;
      const maxStart = Math.max(0, document.durationMs - duration);
      const startMs = clamp(snap(line.startMs + options.offsetMs), 0, maxStart);
      return {
        ...line,
        startMs,
        endMs: startMs + duration,
        reviewStatus: "draft"
      };
    })
  };
}

export function updateHistory(
  history: SubtitleHistory,
  nextDocument: SubtitleDocument,
  options: { mergeKey?: string | null; limit?: number } = {}
): SubtitleHistory {
  return updateEditorHistory(history, nextDocument, options);
}

export function undoHistory(history: SubtitleHistory): SubtitleHistory {
  return undoEditorHistory(history);
}

export function redoHistory(history: SubtitleHistory): SubtitleHistory {
  return redoEditorHistory(history);
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const editable = target.closest(
    "input, textarea, select, button, [contenteditable='true'], [role='textbox']"
  );
  return Boolean(editable);
}
