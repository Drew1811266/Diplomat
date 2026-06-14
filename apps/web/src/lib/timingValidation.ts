import type { SubtitleLine } from "@diplomat/shared";

export type TimingIssueCode =
  | "negative_time"
  | "end_before_start"
  | "too_short"
  | "overlap_previous"
  | "overlap_next"
  | "overlong_text";

export type TimingIssueSeverity = "warning" | "error";

export type TimingIssue = {
  lineId: string;
  code: TimingIssueCode;
  severity: TimingIssueSeverity;
};

export type TimingValidationOptions = {
  minDurationMs?: number;
  maxCharsPerSecond?: number;
};

export type TimingValidationResult = {
  issues: TimingIssue[];
  byLineId: Record<string, TimingIssue[]>;
};

const defaultOptions = {
  minDurationMs: 300,
  maxCharsPerSecond: 18
};

function addIssue(
  result: TimingValidationResult,
  lineId: string,
  code: TimingIssueCode,
  severity: TimingIssueSeverity
) {
  const issue = { lineId, code, severity };
  result.issues.push(issue);
  result.byLineId[lineId] = [...(result.byLineId[lineId] ?? []), issue];
}

function readableTextLength(line: SubtitleLine) {
  return `${line.sourceText ?? ""} ${line.translatedText ?? ""}`.trim().length;
}

export function validateSubtitleTiming(
  lines: SubtitleLine[],
  options: TimingValidationOptions = {}
): TimingValidationResult {
  const minDurationMs = options.minDurationMs ?? defaultOptions.minDurationMs;
  const maxCharsPerSecond = options.maxCharsPerSecond ?? defaultOptions.maxCharsPerSecond;
  const result: TimingValidationResult = { issues: [], byLineId: {} };

  for (const line of lines) {
    const durationMs = line.endMs - line.startMs;
    if (line.startMs < 0 || line.endMs < 0) {
      addIssue(result, line.id, "negative_time", "error");
    }
    if (line.endMs <= line.startMs) {
      addIssue(result, line.id, "end_before_start", "error");
      continue;
    }
    if (durationMs < minDurationMs) {
      addIssue(result, line.id, "too_short", "warning");
    }

    const charsPerSecond = readableTextLength(line) / Math.max(durationMs / 1000, 0.001);
    if (charsPerSecond > maxCharsPerSecond) {
      addIssue(result, line.id, "overlong_text", "warning");
    }
  }

  const sorted = [...lines]
    .filter((line) => line.endMs > line.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current.startMs < previous.endMs) {
      addIssue(result, previous.id, "overlap_next", "error");
      addIssue(result, current.id, "overlap_previous", "error");
    }
  }

  return result;
}
