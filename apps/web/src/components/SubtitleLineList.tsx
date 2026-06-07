import type { SubtitleLine } from "@diplomat/shared";

type SubtitleLineListProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
  filter: "all" | "missing";
  onFilterChange: (filter: "all" | "missing") => void;
  onSelectLine: (lineId: string) => void;
};

function formatTiming(startMs: number, endMs: number) {
  return `${formatTimestamp(startMs)} - ${formatTimestamp(endMs)}`;
}

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds
  ).padStart(3, "0")}`;
}

function isMissingTranslation(line: SubtitleLine) {
  return !line.translatedText.trim() || line.translationStatus === "failed";
}

export function SubtitleLineList({
  lines,
  selectedLineId,
  filter,
  onFilterChange,
  onSelectLine
}: SubtitleLineListProps) {
  const visibleLines = filter === "missing" ? lines.filter(isMissingTranslation) : lines;

  return (
    <section className="panel line-list-panel" aria-labelledby="subtitle-lines-title">
      <div className="panel-heading">
        <h2 id="subtitle-lines-title">Subtitle Lines</h2>
        <span>{visibleLines.length} rows</span>
      </div>

      <div className="line-filter-row" aria-label="Subtitle filters">
        <button
          type="button"
          className={filter === "all" ? "line-filter-button active" : "line-filter-button"}
          onClick={() => onFilterChange("all")}
        >
          All lines
        </button>
        <button
          type="button"
          className={filter === "missing" ? "line-filter-button active" : "line-filter-button"}
          onClick={() => onFilterChange("missing")}
        >
          Missing translations
        </button>
      </div>

      {visibleLines.length ? (
        <ul className="line-list" aria-label="Subtitle lines">
          {visibleLines.map((line) => {
            const selected = line.id === selectedLineId;
            return (
              <li key={line.id}>
                <button
                  type="button"
                  className={selected ? "line-row selected" : "line-row"}
                  aria-pressed={selected}
                  onClick={() => onSelectLine(line.id)}
                >
                  <span className="line-meta">
                    <strong>{line.id}</strong>
                    <span>{formatTiming(line.startMs, line.endMs)}</span>
                  </span>
                  <span className="line-source">{line.sourceText || "No source text"}</span>
                  <span className="line-target">
                    {line.translatedText || "No translated text"}
                  </span>
                  <span className={`line-status-chip status-${line.translationStatus}`}>
                    {line.translationStatus}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">
          {lines.length ? "No subtitle rows match the current filter." : "Analyze a project to generate subtitle rows."}
        </p>
      )}
    </section>
  );
}
