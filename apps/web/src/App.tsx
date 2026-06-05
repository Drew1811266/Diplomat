import { useEffect, useMemo, useState } from "react";
import type {
  ProjectResponse,
  SrtExportMode,
  SrtExportResponse,
  SubtitleDocument,
  SubtitleLine
} from "@diplomat/shared";
import {
  createProject,
  exportSrt,
  fetchWorkerHealth,
  runProjectAnalysis,
  saveSubtitleDocument,
  type WorkerHealth
} from "./api";
import { ExportPanel } from "./components/ExportPanel";
import { ProjectImportPanel, type ProjectFormState } from "./components/ProjectImportPanel";
import { SubtitleEditor } from "./components/SubtitleEditor";
import { SubtitleLineList } from "./components/SubtitleLineList";
import { TaskStatusBar } from "./components/TaskStatusBar";
import "./App.css";

const initialProjectForm: ProjectFormState = {
  projectName: "Untitled Project",
  sourceVideoPath: "",
  sourceLanguage: "zh",
  targetLanguage: "en"
};

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown worker error";
}

export function App() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(initialProjectForm);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [document, setDocument] = useState<SubtitleDocument | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<SrtExportMode>("bilingual");
  const [exportResult, setExportResult] = useState<SrtExportResponse | null>(null);
  const [message, setMessage] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let canceled = false;
    fetchWorkerHealth()
      .then((result) => {
        if (!canceled) {
          setHealth(result);
        }
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(formatUnknownError(err));
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  const selectedLine = useMemo(
    () => document?.lines.find((line) => line.id === selectedLineId) ?? null,
    [document, selectedLineId]
  );

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(formatUnknownError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCreateProject() {
    void runAction(async () => {
      const createdProject = await createProject({
        name: projectForm.projectName.trim(),
        sourceVideoPath: projectForm.sourceVideoPath.trim(),
        sourceLanguage: projectForm.sourceLanguage.trim(),
        targetLanguage: projectForm.targetLanguage.trim()
          ? projectForm.targetLanguage.trim()
          : null
      });
      setProject(createdProject);
      setDocument(null);
      setSelectedLineId(null);
      setExportResult(null);
      setMessage("Project created");
    });
  }

  function handleAnalyzeProject() {
    if (!project) {
      return;
    }

    void runAction(async () => {
      const analysis = await runProjectAnalysis(project.projectId);
      setDocument(analysis.document);
      setSelectedLineId(analysis.document.lines[0]?.id ?? null);
      setExportResult(null);
      setMessage("Analysis completed");
    });
  }

  function handleUpdateLine(nextLine: SubtitleLine) {
    setDocument((currentDocument) => {
      if (!currentDocument) {
        return currentDocument;
      }

      return {
        ...currentDocument,
        lines: currentDocument.lines.map((line) => (line.id === nextLine.id ? nextLine : line))
      };
    });
  }

  function handleSaveSubtitle() {
    if (!project || !document) {
      return;
    }

    void runAction(async () => {
      const savedDocument = await saveSubtitleDocument(project.projectId, document);
      setDocument(savedDocument);
      setMessage("Saved subtitle edits");
    });
  }

  function handleExportSrt() {
    if (!project || !document) {
      return;
    }

    void runAction(async () => {
      const result = await exportSrt(project.projectId, exportMode);
      setExportResult(result);
      setMessage("SRT export completed");
    });
  }

  return (
    <main className="app-shell">
      <TaskStatusBar health={health} message={message} error={error} busy={busy} />

      <ProjectImportPanel
        form={projectForm}
        project={project}
        busy={busy}
        onFormChange={setProjectForm}
        onCreateProject={handleCreateProject}
        onAnalyzeProject={handleAnalyzeProject}
      />

      <div className="workbench-grid" aria-label="Subtitle workbench">
        <SubtitleLineList
          lines={document?.lines ?? []}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
        />
        <SubtitleEditor
          line={selectedLine}
          busy={busy}
          onChangeLine={handleUpdateLine}
          onSave={handleSaveSubtitle}
        />
        <ExportPanel
          mode={exportMode}
          exportResult={exportResult}
          canExport={Boolean(project && document)}
          busy={busy}
          onModeChange={setExportMode}
          onExport={handleExportSrt}
        />
      </div>
    </main>
  );
}
