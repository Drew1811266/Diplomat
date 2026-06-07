import type { TaskResponse, TranslationJobRequest } from "@diplomat/shared";

type TranslationJobPanelProps = {
  disabled: boolean;
  task: TaskResponse | null;
  config: TranslationJobRequest;
  onConfigChange: (config: TranslationJobRequest) => void;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

function isTaskActive(task: TaskResponse | null) {
  return task?.status === "queued" || task?.status === "running" || task?.status === "canceling";
}

export function TranslationJobPanel({
  disabled,
  task,
  config,
  onConfigChange,
  onStart,
  onCancel,
  onRetry
}: TranslationJobPanelProps) {
  const active = isTaskActive(task);
  const canRetry = task?.status === "failed" || task?.status === "canceled";
  const progressPercent = Math.round((task?.progress ?? 0) * 100);

  function updateConfig<Key extends keyof TranslationJobRequest>(
    key: Key,
    value: TranslationJobRequest[Key]
  ) {
    onConfigChange({ ...config, [key]: value });
  }

  return (
    <section className="translation-job-panel" aria-label="Translation job">
      <div className="panel-heading">
        <h2>Translation</h2>
        <span>{task ? `${task.status} ${progressPercent}%` : "idle"}</span>
      </div>

      <div className="translation-controls">
        <label>
          Translation provider
          <select
            value={config.provider}
            disabled={active}
            onChange={(event) =>
              updateConfig("provider", event.target.value as TranslationJobRequest["provider"])
            }
          >
            <option value="fake">fake</option>
            <option value="libretranslate">libretranslate</option>
          </select>
        </label>
        <label>
          Source language
          <input
            value={config.sourceLanguage}
            disabled={active}
            onChange={(event) => updateConfig("sourceLanguage", event.target.value)}
          />
        </label>
        <label>
          Target language
          <input
            value={config.targetLanguage}
            disabled={active}
            onChange={(event) => updateConfig("targetLanguage", event.target.value)}
          />
        </label>
        <label>
          Translation mode
          <select
            value={config.mode}
            disabled={active}
            onChange={(event) =>
              updateConfig("mode", event.target.value as TranslationJobRequest["mode"])
            }
          >
            <option value="missing_only">missing only</option>
            <option value="overwrite_all">overwrite all</option>
          </select>
        </label>
        <label className="translation-endpoint-field">
          LibreTranslate endpoint
          <input
            value={config.endpoint ?? ""}
            disabled={active}
            placeholder="http://127.0.0.1:5000"
            onChange={(event) => updateConfig("endpoint", event.target.value || null)}
          />
        </label>
        <label>
          API key env
          <input
            value={config.apiKeyEnv ?? ""}
            disabled={active}
            placeholder="LIBRETRANSLATE_API_KEY"
            onChange={(event) => updateConfig("apiKeyEnv", event.target.value || null)}
          />
        </label>
      </div>

      <div className="analysis-task-row">
        <progress value={task?.progress ?? 0} max={1} aria-label="Translation progress" />
        <span>{task ? `${task.message} (${progressPercent}%)` : "No translation job"}</span>
      </div>

      {task?.errorMessage ? <p className="analysis-error">{task.errorMessage}</p> : null}

      <div className="analysis-actions">
        <button type="button" onClick={onStart} disabled={disabled || active}>
          Start Translation
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={!active}>
          Cancel Translation
        </button>
        <button type="button" className="secondary-button" onClick={onRetry} disabled={!canRetry}>
          Retry Translation
        </button>
      </div>
    </section>
  );
}
