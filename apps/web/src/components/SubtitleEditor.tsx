import type { SubtitleLine } from "@diplomat/shared";

type SubtitleEditorProps = {
  line: SubtitleLine | null;
  busy: boolean;
  onChangeLine: (line: SubtitleLine) => void;
  onSave: () => void;
};

function toInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SubtitleEditor({ line, busy, onChangeLine, onSave }: SubtitleEditorProps) {
  if (!line) {
    return (
      <section className="panel editor-panel" aria-labelledby="subtitle-editor-title">
        <div className="panel-heading">
          <h2 id="subtitle-editor-title">Line Editor</h2>
        </div>
        <p className="empty-state">Select a subtitle row to edit timing and text.</p>
      </section>
    );
  }

  return (
    <section className="panel editor-panel" aria-labelledby="subtitle-editor-title">
      <div className="panel-heading">
        <h2 id="subtitle-editor-title">Line Editor</h2>
        <span>{line.id}</span>
      </div>

      <div className="editor-status-row">
        <span>Translation: {line.translationStatus}</span>
        {line.translationOrigin ? (
          <span>
            {line.translationOrigin.provider} / {line.translationOrigin.model}
          </span>
        ) : null}
      </div>

      <div className="timing-grid">
        <label>
          Start ms
          <input
            type="number"
            min={0}
            value={line.startMs}
            disabled={busy}
            onChange={(event) =>
              onChangeLine({ ...line, startMs: toInteger(event.target.value, line.startMs) })
            }
          />
        </label>
        <label>
          End ms
          <input
            type="number"
            min={0}
            value={line.endMs}
            disabled={busy}
            onChange={(event) =>
              onChangeLine({ ...line, endMs: toInteger(event.target.value, line.endMs) })
            }
          />
        </label>
      </div>

      <label>
        Source text
        <textarea
          rows={5}
          value={line.sourceText}
          disabled={busy}
          onChange={(event) => onChangeLine({ ...line, sourceText: event.target.value })}
        />
      </label>

      <label>
        Translated text
        <textarea
          rows={5}
          value={line.translatedText}
          disabled={busy}
          onChange={(event) =>
            onChangeLine({
              ...line,
              translatedText: event.target.value,
              translationStatus: "edited",
              translationError: null
            })
          }
        />
      </label>

      <div className="editor-actions">
        <button type="button" onClick={onSave} disabled={busy}>
          Save Subtitle
        </button>
      </div>
    </section>
  );
}
