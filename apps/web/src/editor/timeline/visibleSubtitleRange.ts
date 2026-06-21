import type { SubtitleLine } from "@diplomat/shared";

export type VisibleSubtitleLineEntry = {
  line: SubtitleLine;
  originalIndex: number;
};

type VisibleSubtitleRangeOptions = {
  startMs: number;
  endMs: number;
  overscanMs?: number;
};

export function getVisibleSubtitleLineEntries(
  lines: SubtitleLine[],
  options: VisibleSubtitleRangeOptions
): VisibleSubtitleLineEntry[] {
  const overscanMs = Math.max(0, options.overscanMs ?? 0);
  const rangeStartMs = Math.min(options.startMs, options.endMs) - overscanMs;
  const rangeEndMs = Math.max(options.startMs, options.endMs) + overscanMs;

  return lines.flatMap((line, originalIndex) => {
    const overlapsRange = line.endMs > rangeStartMs && line.startMs < rangeEndMs;
    return overlapsRange ? [{ line, originalIndex }] : [];
  });
}
