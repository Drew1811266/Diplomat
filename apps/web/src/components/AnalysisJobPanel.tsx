import type { AnalysisJobRequest, TaskResponse } from "@diplomat/shared";

type AnalysisJobPanelProps = {
  disabled: boolean;
  task: TaskResponse | null;
  config: AnalysisJobRequest;
  onConfigChange: (config: AnalysisJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

function isTaskActive(task: TaskResponse | null) {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

export function AnalysisJobPanel({
  disabled,
  task,
  config,
  onConfigChange,
  onStart,
  onCancel,
  onRetry
}: AnalysisJobPanelProps) {
  const active = isTaskActive(task);
  const canRetry = task?.status === "failed" || task?.status === "canceled";
  const progressPercent = Math.round((task?.progress ?? 0) * 100);

  function updateConfig<Key extends keyof AnalysisJobRequest>(
    key: Key,
    value: AnalysisJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  return (
    <section className="analysis-job-panel" aria-label="Analysis job">
      <div className="panel-heading">
        <h2>Analysis</h2>
        <span>{task ? `${task.status} ${progressPercent}%` : "idle"}</span>
      </div>

      <div className="analysis-controls">
        <label>
          ASR provider
          <select
            value={config.provider}
            disabled={active}
            onChange={(event) =>
              updateConfig("provider", event.target.value as AnalysisJobRequest["provider"])
            }
          >
            <option value="fake">fake</option>
            <option value="faster-whisper">faster-whisper</option>
          </select>
        </label>
        <label>
          Model name or path
          <input
            value={config.modelNameOrPath ?? ""}
            disabled={active}
            placeholder={config.provider === "fake" ? "fake-v1" : "tiny"}
            onChange={(event) => updateConfig("modelNameOrPath", event.target.value || null)}
          />
        </label>
        <label>
          Device
          <input
            value={config.device}
            disabled={active}
            onChange={(event) => updateConfig("device", event.target.value)}
          />
        </label>
        <label>
          Compute type
          <input
            value={config.computeType}
            disabled={active}
            onChange={(event) => updateConfig("computeType", event.target.value)}
          />
        </label>
        <label>
          ASR language
          <input
            value={config.sourceLanguage ?? ""}
            disabled={active}
            onChange={(event) => updateConfig("sourceLanguage", event.target.value || null)}
          />
        </label>
        <label className="analysis-prompt-field">
          Initial prompt
          <input
            value={config.initialPrompt ?? ""}
            disabled={active}
            onChange={(event) => updateConfig("initialPrompt", event.target.value || null)}
          />
        </label>
      </div>

      <div className="analysis-task-row">
        <progress value={task?.progress ?? 0} max={1} aria-label="Analysis progress" />
        <span>{task?.message ?? "No analysis job"}</span>
      </div>

      {task?.errorMessage ? <p className="analysis-error">{task.errorMessage}</p> : null}
      {task?.diagnosticLogPath && task.status === "failed" ? (
        <p className="analysis-diagnostic">Diagnostic: {task.diagnosticLogPath}</p>
      ) : null}

      <div className="analysis-actions">
        <button type="button" onClick={onStart} disabled={disabled || active}>
          Start Analysis
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={!active}>
          Cancel Analysis
        </button>
        <button type="button" className="secondary-button" onClick={onRetry} disabled={!canRetry}>
          Retry Analysis
        </button>
      </div>
    </section>
  );
}
