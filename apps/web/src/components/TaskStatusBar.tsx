import type { WorkerHealth } from "../api";

type TaskStatusBarProps = {
  health: WorkerHealth | null;
  message: string;
  error: string | null;
  busy: boolean;
};

export function TaskStatusBar({ health, message, error, busy }: TaskStatusBarProps) {
  return (
    <header className="task-status-bar">
      <div className="brand-block">
        <h1>Diplomat</h1>
        <span>Subtitle Workbench</span>
      </div>
      <div className="status-cluster" aria-live="polite">
        <strong>Worker: {health?.status ?? "checking"}</strong>
        <span>{busy ? "Working" : message}</span>
      </div>
      {error ? (
        <div className="status-error" role="alert">
          Error: {error}
        </div>
      ) : null}
    </header>
  );
}
