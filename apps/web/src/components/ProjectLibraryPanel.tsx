import type { ProjectResponse } from "@diplomat/shared";

type ProjectLibraryPanelProps = {
  projects: ProjectResponse[];
  selectedProjectId: string | null;
  busy: boolean;
  onReopenProject: (projectId: string) => void;
};

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ProjectLibraryPanel({
  projects,
  selectedProjectId,
  busy,
  onReopenProject
}: ProjectLibraryPanelProps) {
  return (
    <section className="panel project-library-panel" aria-labelledby="project-library-title">
      <div className="panel-heading">
        <h2 id="project-library-title">Recent Projects</h2>
        <span>{projects.length} items</span>
      </div>

      {projects.length === 0 ? (
        <p className="empty-state">No projects yet.</p>
      ) : (
        <ul className="project-library-list" aria-label="Recent projects">
          {projects.map((project) => {
            const isSelected = project.projectId === selectedProjectId;
            return (
              <li key={project.projectId} className={isSelected ? "selected" : undefined}>
                <div className="project-library-row">
                  <div className="project-library-main">
                    <strong>{project.name}</strong>
                    <span>{project.sourceVideoPath}</span>
                  </div>
                  <div className="project-library-meta">
                    <span>
                      {project.sourceLanguage}
                      {project.targetLanguage ? ` to ${project.targetLanguage}` : ""}
                    </span>
                    <span>{formatDuration(project.durationMs)}</span>
                    <span>{project.hasSubtitleDocument ? "Subtitles" : "No subtitles"}</span>
                    <span>{formatUpdatedAt(project.updatedAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onReopenProject(project.projectId)}
                  disabled={busy}
                >
                  Reopen {project.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
