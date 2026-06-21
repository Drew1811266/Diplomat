import type { SubtitleLine } from "@diplomat/shared";

export function findActiveSubtitle(lines: SubtitleLine[], timeMs: number): SubtitleLine | null {
  let match: SubtitleLine | null = null;

  for (const line of lines) {
    if (timeMs < line.startMs || timeMs >= line.endMs) {
      continue;
    }

    if (!match || line.endMs - line.startMs < match.endMs - match.startMs) {
      match = line;
    }
  }

  return match;
}
