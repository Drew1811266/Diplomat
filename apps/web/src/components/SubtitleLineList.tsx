import type { SubtitleLine } from "@diplomat/shared";

type SubtitleLineListProps = {
  lines: SubtitleLine[];
  selectedLineId: string | null;
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

export function SubtitleLineList({ lines, selectedLineId, onSelectLine }: SubtitleLineListProps) {
  return (
    <section className="panel line-list-panel" aria-labelledby="subtitle-lines-title">
      <div className="panel-heading">
        <h2 id="subtitle-lines-title">Subtitle Lines</h2>
        <span>{lines.length} rows</span>
      </div>

      {lines.length ? (
        <ul className="line-list" aria-label="Subtitle lines">
          {lines.map((line) => {
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
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">Analyze a project to generate subtitle rows.</p>
      )}
    </section>
  );
}
