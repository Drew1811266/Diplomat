import type { SrtExportMode, SrtExportResponse } from "@diplomat/shared";

type ExportPanelProps = {
  mode: SrtExportMode;
  exportResult: SrtExportResponse | null;
  canExport: boolean;
  busy: boolean;
  onModeChange: (mode: SrtExportMode) => void;
  onExport: () => void;
};

const exportModes: SrtExportMode[] = ["bilingual", "source", "target"];

export function ExportPanel({
  mode,
  exportResult,
  canExport,
  busy,
  onModeChange,
  onExport
}: ExportPanelProps) {
  return (
    <section className="panel export-panel" aria-labelledby="export-title">
      <div className="panel-heading">
        <h2 id="export-title">Export</h2>
      </div>

      <label>
        SRT mode
        <select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as SrtExportMode)}
        >
          {exportModes.map((exportMode) => (
            <option key={exportMode} value={exportMode}>
              {exportMode}
            </option>
          ))}
        </select>
      </label>

      <button type="button" onClick={onExport} disabled={busy || !canExport}>
        Export SRT
      </button>

      {exportResult ? <p className="export-result">SRT exported: {exportResult.exportPath}</p> : null}
    </section>
  );
}
