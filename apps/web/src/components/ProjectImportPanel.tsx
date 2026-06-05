import type { ProjectResponse } from "@diplomat/shared";

export type ProjectFormState = {
  projectName: string;
  sourceVideoPath: string;
  sourceLanguage: string;
  targetLanguage: string;
};

type ProjectImportPanelProps = {
  form: ProjectFormState;
  project: ProjectResponse | null;
  busy: boolean;
  onFormChange: (form: ProjectFormState) => void;
  onCreateProject: () => void;
  onAnalyzeProject: () => void;
};

export function ProjectImportPanel({
  form,
  project,
  busy,
  onFormChange,
  onCreateProject,
  onAnalyzeProject
}: ProjectImportPanelProps) {
  function updateField<Key extends keyof ProjectFormState>(key: Key, value: ProjectFormState[Key]) {
    onFormChange({ ...form, [key]: value });
  }

  return (
    <section className="project-strip" aria-label="Project import">
      <div className="project-fields">
        <label>
          Project name
          <input
            value={form.projectName}
            onChange={(event) => updateField("projectName", event.target.value)}
          />
        </label>
        <label className="path-field">
          Source video path
          <input
            value={form.sourceVideoPath}
            placeholder="D:/media/source.mp4"
            onChange={(event) => updateField("sourceVideoPath", event.target.value)}
          />
        </label>
        <label>
          Source language
          <input
            value={form.sourceLanguage}
            onChange={(event) => updateField("sourceLanguage", event.target.value)}
          />
        </label>
        <label>
          Target language
          <input
            value={form.targetLanguage}
            onChange={(event) => updateField("targetLanguage", event.target.value)}
          />
        </label>
      </div>

      <div className="project-actions">
        <button type="button" onClick={onCreateProject} disabled={busy}>
          Create Project
        </button>
        <button type="button" onClick={onAnalyzeProject} disabled={busy || !project}>
          Analyze
        </button>
      </div>

      {project ? (
        <p className="project-summary">
          Project: {project.name} · {project.sourceLanguage}
          {project.targetLanguage ? ` to ${project.targetLanguage}` : ""} · {project.durationMs} ms
        </p>
      ) : null}
    </section>
  );
}
